import { describe, it, expect } from "vitest";
import {
  formatUsdCents,
  compactNumber,
  formatTokenAmount,
  parseTokenAmount,
  truncateAddress,
  percent,
  ledgerToApproxDate,
} from "@/lib/format";

describe("formatUsdCents", () => {
  it("formats whole dollar amounts", () => {
    expect(formatUsdCents(500000000n)).toBe("$5,000,000");
  });

  it("formats zero", () => {
    expect(formatUsdCents(0n)).toBe("$0");
  });

  it("formats cents correctly", () => {
    expect(formatUsdCents(199n)).toBe("$1.99");
  });

  it("uses compact format for large values", () => {
    expect(formatUsdCents(500000000n, { compact: true })).toBe("$5M");
  });
});

describe("compactNumber", () => {
  it("compacts billions", () => {
    expect(compactNumber(2_500_000_000)).toBe("2.5B");
  });

  it("compacts millions", () => {
    expect(compactNumber(5_000_000)).toBe("5M");
  });

  it("compacts thousands", () => {
    expect(compactNumber(12_300)).toBe("12.3K");
  });

  it("leaves small numbers as-is", () => {
    expect(compactNumber(42)).toBe("42");
  });
});

describe("formatTokenAmount", () => {
  it("formats whole tokens", () => {
    expect(formatTokenAmount(100000n, 2)).toBe("1,000");
  });

  it("formats fractional tokens", () => {
    expect(formatTokenAmount(100050n, 2)).toBe("1,000.5");
  });

  it("handles zero decimals", () => {
    expect(formatTokenAmount(42n, 0)).toBe("42");
  });
});

describe("parseTokenAmount", () => {
  it("parses a decimal string to base units", () => {
    expect(parseTokenAmount("1,000.5", 2)).toBe(100050n);
  });

  it("handles no fractional part", () => {
    expect(parseTokenAmount("100", 2)).toBe(10000n);
  });

  it("throws on malformed input", () => {
    expect(() => parseTokenAmount("abc", 2)).toThrow("Enter a valid number");
  });

  it("throws when too many decimal places", () => {
    expect(() => parseTokenAmount("1.123", 2)).toThrow("Maximum 2 decimal places");
  });
});

describe("truncateAddress", () => {
  it("truncates a long address", () => {
    const addr = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
    expect(truncateAddress(addr)).toBe("GAIQ…SRAA");
  });

  it("returns short strings untouched", () => {
    expect(truncateAddress("GAIQ")).toBe("GAIQ");
  });
});

describe("percent", () => {
  it("calculates percentage", () => {
    expect(percent(50n, 100n)).toBe(50);
  });

  it("returns 0 for zero whole", () => {
    expect(percent(10n, 0n)).toBe(0);
  });

  it("clamps to 100", () => {
    expect(percent(200n, 100n)).toBe(100);
  });
});

describe("ledgerToApproxDate", () => {
  it("returns null for zero target ledger", () => {
    expect(ledgerToApproxDate(0, 100)).toBeNull();
  });

  it("returns a Date for a valid target", () => {
    const result = ledgerToApproxDate(110, 100);
    expect(result).toBeInstanceOf(Date);
  });
});
