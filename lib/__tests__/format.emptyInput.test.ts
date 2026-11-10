import {
  assetHref,
  assetTypeLabel,
  complianceStatusLabel,
  compactNumber,
  formatRawPlain,
  formatStroopsToXLM,
  formatTokenAmount,
  formatUsdCents,
  holderSharePercentages,
  ledgerToApproxDate,
  parseTokenAmount,
  parseUsdToCents,
  percent,
  titleCase,
  truncateAddress,
} from "@/lib/format";

describe("format — empty/zero/boundary input coverage (#667)", () => {
  it("formats zero stroops and zero USD cents deliberately", () => {
    expect(formatStroopsToXLM(0n)).toBe("0 XLM");
    expect(formatStroopsToXLM(0)).toBe("0 XLM");
    expect(formatUsdCents(0n)).toBe("$0");
    expect(formatUsdCents(0n, { compact: true })).toBe("$0");
  });

  it("formats zero token amounts and zero compact numbers cleanly", () => {
    expect(compactNumber(0)).toBe("0");
    expect(formatTokenAmount(0n, 0)).toBe("0");
    expect(formatTokenAmount(0n, 7)).toBe("0");
    expect(formatRawPlain(0n, 0)).toBe("0");
    expect(formatRawPlain(0n, 7)).toBe("0");
  });

  it("parses explicit zero strings and rejects empty strings in parseTokenAmount / parseUsdToCents", () => {
    expect(parseTokenAmount("0", 0)).toBe(0n);
    expect(parseTokenAmount("0.00", 2)).toBe(0n);
    expect(parseUsdToCents("0")).toBe(0n);
    expect(parseUsdToCents("0.00")).toBe(0n);
    expect(() => parseTokenAmount("", 2)).toThrow("Enter a valid number");
    expect(() => parseUsdToCents("")).toThrow("Enter a valid number");
  });

  it("handles zero/empty inputs across string and percentage helpers", () => {
    expect(assetHref(0n)).toBe("/asset/0");
    expect(truncateAddress("")).toBe("");
    expect(titleCase("")).toBe("");
    expect(assetTypeLabel("")).toBe("");
    expect(complianceStatusLabel("Pending")).toBe("Pending");
    expect(percent(0n, 0n)).toBe(0);
    expect(percent(0n, 100n)).toBe(0);
    expect(holderSharePercentages([], 0n)).toEqual([]);
    expect(holderSharePercentages([], 100n)).toEqual([]);
    expect(holderSharePercentages([0n, 0n], 100n)).toEqual(["0.00", "0.00"]);
    expect(ledgerToApproxDate(0, 0)).toBeNull();
  });
});
