import { describe, it, expect } from "vitest";
import {
  formatUsdCents,
  parseUsdToCents,
  parseTokenAmount,
  formatTokenAmount,
} from "./format";

describe("parseUsdToCents / formatUsdCents symmetry", () => {
  const cases: Array<[string, string]> = [
    ["5,000,000", "$5,000,000"],
    ["0", "$0"],
    ["0.50", "$0.50"],
    ["1,234.56", "$1,234.56"],
    ["1000000.99", "$1,000,000.99"],
    ["10", "$10"],
  ];

  it.each(cases)("round-trips %s -> %s", (input, expected) => {
    const cents = parseUsdToCents(input);
    expect(formatUsdCents(cents)).toBe(expected);
  });

  it("re-parsing a formatted value yields the same cents", () => {
    for (const [input] of cases) {
      const cents = parseUsdToCents(input);
      const reformatted = formatUsdCents(cents).replace(/[$,]/g, "");
      expect(parseUsdToCents(reformatted)).toBe(cents);
    }
  });
});

describe("parseTokenAmount", () => {
  it("strips thousands separators", () => {
    expect(parseTokenAmount("1,000.50", 2)).toBe(100050n);
    expect(parseTokenAmount("1,000,000", 0)).toBe(1000000n);
  });

  it("allows a trailing dot with no fractional digits", () => {
    expect(parseTokenAmount("100.", 2)).toBe(10000n);
  });

  it("throws when there are more decimal places than allowed", () => {
    expect(() => parseTokenAmount("1.234", 2)).toThrow("Maximum 2 decimal places");
  });

  it("throws on empty input", () => {
    expect(() => parseTokenAmount("", 2)).toThrow("Enter a valid number");
  });

  it("throws on a lone decimal point", () => {
    expect(() => parseTokenAmount(".", 2)).toThrow("Enter a valid number");
  });

  it("handles leading zeros", () => {
    expect(parseTokenAmount("007.5", 2)).toBe(750n);
    expect(parseTokenAmount("00", 2)).toBe(0n);
  });

  it("round-trips through formatTokenAmount", () => {
    const raw = parseTokenAmount("1,234.5", 2);
    expect(formatTokenAmount(raw, 2)).toBe("1,234.5");
  });
});
