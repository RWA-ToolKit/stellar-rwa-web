import { describe, it, expect } from "vitest";
import {
  formatUsdCents,
  compactNumber,
  formatTokenAmount,
  parseTokenAmount,
  truncateAddress,
  percent,
  ledgerToApproxDate,
  timeAgo,
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

describe("timeAgo", () => {
  const now = new Date("2025-06-15T12:00:00Z");

  it("returns 'less than a minute ago' for < 60s", () => {
    const date = new Date(now.getTime() - 30_000);
    expect(timeAgo(date, now)).toBe("less than a minute ago");
  });

  it("returns '1 minute ago' for 60–119s", () => {
    const date = new Date(now.getTime() - 90_000);
    expect(timeAgo(date, now)).toBe("1 minute ago");
  });

  it("returns '5 minutes ago'", () => {
    const date = new Date(now.getTime() - 5 * 60_000);
    expect(timeAgo(date, now)).toBe("5 minutes ago");
  });

  it("returns 'about 1 hour ago'", () => {
    const date = new Date(now.getTime() - 3_600_000);
    expect(timeAgo(date, now)).toBe("about 1 hour ago");
  });

  it("returns 'about 3 hours ago'", () => {
    const date = new Date(now.getTime() - 3 * 3_600_000);
    expect(timeAgo(date, now)).toBe("about 3 hours ago");
  });

  it("returns '1 day ago'", () => {
    const date = new Date(now.getTime() - 86_400_000);
    expect(timeAgo(date, now)).toBe("1 day ago");
  });

  it("returns '10 days ago'", () => {
    const date = new Date(now.getTime() - 10 * 86_400_000);
    expect(timeAgo(date, now)).toBe("10 days ago");
  });

  it("returns 'about 1 month ago'", () => {
    const date = new Date(now.getTime() - 35 * 86_400_000);
    expect(timeAgo(date, now)).toBe("about 1 month ago");
  });

  it("returns 'about 1 year ago' for > 365 days", () => {
    const date = new Date(now.getTime() - 400 * 86_400_000);
    expect(timeAgo(date, now)).toBe("about 1 year ago");
  });

  it("returns future tense for dates in the future", () => {
    const date = new Date(now.getTime() + 5 * 60_000);
    expect(timeAgo(date, now)).toBe("in 5 minutes");
  });
});
