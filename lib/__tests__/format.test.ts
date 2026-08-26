import { formatUsdCents, formatTokenAmount } from "@/lib/format";

// ---------------------------------------------------------------------------
// Issue #35 — formatUsdCents
// ---------------------------------------------------------------------------
describe("formatUsdCents", () => {
  // --- whole dollar amounts ------------------------------------------------

  it("formats zero cents as $0", () => {
    expect(formatUsdCents(0n)).toBe("$0");
  });

  it("formats exactly $1 (100 cents)", () => {
    expect(formatUsdCents(100n)).toBe("$1");
  });

  it("formats $5,000,000 (500_000_000 cents)", () => {
    expect(formatUsdCents(500_000_000n)).toBe("$5,000,000");
  });

  it("formats whole dollars without cents fraction", () => {
    // 1_000 cents = $10.00 → implementation omits trailing .00 for whole dollars
    expect(formatUsdCents(1_000n)).toBe("$10");
  });

  // --- fractional cents (sub-dollar) ---------------------------------------

  it("formats $0.01 (1 cent)", () => {
    expect(formatUsdCents(1n)).toBe("$0.01");
  });

  it("formats $0.50 (50 cents)", () => {
    expect(formatUsdCents(50n)).toBe("$0.50");
  });

  it("formats $1.99 (199 cents)", () => {
    expect(formatUsdCents(199n)).toBe("$1.99");
  });

  it("formats $1,234.56 (123456 cents)", () => {
    expect(formatUsdCents(123_456n)).toBe("$1,234.56");
  });

  // --- compact mode --------------------------------------------------------

  it("does NOT use compact format below 1,000,000 dollars", () => {
    // $999,999.99 — just under the compact threshold
    expect(formatUsdCents(99_999_999n, { compact: true })).toBe("$999,999.99");
  });

  it("formats exactly $1,000,000 in compact mode as $1M", () => {
    expect(formatUsdCents(100_000_000n, { compact: true })).toBe("$1M");
  });

  it("formats $1,500,000 in compact mode as $1.5M", () => {
    expect(formatUsdCents(150_000_000n, { compact: true })).toBe("$1.5M");
  });

  it("formats $12,300,000 in compact mode as $12.3M", () => {
    expect(formatUsdCents(1_230_000_000n, { compact: true })).toBe("$12.3M");
  });

  it("formats $2,000,000,000 in compact mode as $2B", () => {
    expect(formatUsdCents(200_000_000_000n, { compact: true })).toBe("$2B");
  });

  it("passes large compact values through without compact flag (no shorthand)", () => {
    expect(formatUsdCents(100_000_000n)).toBe("$1,000,000");
  });

  // --- bigint precision ------------------------------------------------
  // formatUsdCents keeps values in bigint until the final string conversion, so
  // it stays exact well past Number.MAX_SAFE_INTEGER (2^53-1 cents ≈ $90T).

  it("preserves precision for a large value within safe integer range", () => {
    // 9_000_000_000_000n cents = $90,000,000,000 — still within Number safe range
    expect(formatUsdCents(9_000_000_000_000n)).toBe("$90,000,000,000");
  });

  it("preserves precision for a value exceeding Number.MAX_SAFE_INTEGER", () => {
    // 10_000_000_000_000_000n cents = $100,000,000,000,000 (~$100 trillion)
    // Converting via Number() would silently round; bigint math does not.
    expect(formatUsdCents(10_000_000_000_000_000n)).toBe("$100,000,000,000,000");
  });
});

// ---------------------------------------------------------------------------
// Issue #36 — formatTokenAmount
// ---------------------------------------------------------------------------
describe("formatTokenAmount", () => {
  // --- decimals = 0 --------------------------------------------------------

  it("formats an integer token with 0 decimals", () => {
    expect(formatTokenAmount(1000n, 0)).toBe("1,000");
  });

  it("formats zero with 0 decimals", () => {
    expect(formatTokenAmount(0n, 0)).toBe("0");
  });

  it("formats 1 with 0 decimals", () => {
    expect(formatTokenAmount(1n, 0)).toBe("1");
  });

  // --- trailing-zero trimming ----------------------------------------------

  it("trims trailing zeros from fractional part", () => {
    // 150000 raw, 5 decimals → 1.50000 → trimmed to "1.5"
    expect(formatTokenAmount(150_000n, 5)).toBe("1.5");
  });

  it("trims all fractional zeros when fraction is exactly zero", () => {
    // 100 raw, 2 decimals → 1.00 → whole only: "1"
    expect(formatTokenAmount(100n, 2)).toBe("1");
  });

  it("keeps significant fractional digits and trims only trailing zeros", () => {
    // 10500 raw, 4 decimals → 1.0500 → "1.05"
    expect(formatTokenAmount(10_500n, 4)).toBe("1.05");
  });

  it("does not trim non-trailing zeros", () => {
    // 1050 raw, 4 decimals → 0.1050 → "0.105"
    expect(formatTokenAmount(1_050n, 4)).toBe("0.105");
  });

  // --- negative amounts ----------------------------------------------------

  it("formats a negative integer token with 0 decimals", () => {
    expect(formatTokenAmount(-500n, 0)).toBe("-500");
  });

  it("formats a negative fractional amount", () => {
    // -199 raw, 2 decimals → -1.99
    expect(formatTokenAmount(-199n, 2)).toBe("-1.99");
  });

  it("formats negative zero-fraction as negative integer", () => {
    // -100 raw, 2 decimals → -1.00 → "-1"
    expect(formatTokenAmount(-100n, 2)).toBe("-1");
  });

  it("trims trailing zeros on negative fractional amounts", () => {
    // -15000 raw, 4 decimals → -1.5000 → "-1.5"
    expect(formatTokenAmount(-15_000n, 4)).toBe("-1.5");
  });

  // --- grouping separators -------------------------------------------------

  it("applies thousand-grouping to whole part", () => {
    // 1_000_000 raw, 0 decimals → "1,000,000"
    expect(formatTokenAmount(1_000_000n, 0)).toBe("1,000,000");
  });

  it("applies thousand-grouping with decimals", () => {
    // 1_234_567_89 raw, 2 decimals → 12,345,678.9 → "12,345,678.9"
    expect(formatTokenAmount(1_234_567_890n, 2)).toBe("12,345,678.9");
  });

  it("applies grouping to negative whole part", () => {
    expect(formatTokenAmount(-1_000_000n, 0)).toBe("-1,000,000");
  });

  // --- standard decimal cases ----------------------------------------------

  it("formats 100000 raw at 2 decimals as 1,000", () => {
    // The README example: 100000n @ 2 decimals → "1,000"
    expect(formatTokenAmount(100_000n, 2)).toBe("1,000");
  });

  it("formats 1 raw at 6 decimals (Stellar-style) as 0.000001", () => {
    expect(formatTokenAmount(1n, 6)).toBe("0.000001");
  });

  it("formats 10_000_000 raw at 7 decimals as 1", () => {
    expect(formatTokenAmount(10_000_000n, 7)).toBe("1");
  });
});
