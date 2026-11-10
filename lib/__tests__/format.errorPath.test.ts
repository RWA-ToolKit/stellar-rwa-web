import {
  assetTypeLabel,
  holderSharePercentages,
  ledgerToApproxDate,
  parseTokenAmount,
  parseUsdToCents,
  percent,
  truncateAddress,
} from "@/lib/format";

describe("format — error and rejection path coverage (#666)", () => {
  describe("parseTokenAmount & parseUsdToCents validation errors", () => {
    it.each([
      ["", "Enter a valid number"],
      ["   ", "Enter a valid number"],
      [".", "Enter a valid number"],
      ["12.", "Enter a valid number"],
      ["-10", "Enter a valid number"],
      ["1e6", "Enter a valid number"],
      ["abc", "Enter a valid number"],
      ["1.2.3", "Enter a valid number"],
    ])("rejects malformed input %j with readable message %j", (input, expectedMessage) => {
      expect(() => parseTokenAmount(input, 2)).toThrow(expectedMessage);
      expect(() => parseUsdToCents(input)).toThrow(expectedMessage);
    });

    it("throws a readable precision limit error when decimals exceed token precision", () => {
      expect(() => parseTokenAmount("1.234", 2)).toThrow("Maximum 2 decimal places");
      expect(() => parseTokenAmount("10.1", 0)).toThrow("Maximum 0 decimal places");
      expect(() => parseUsdToCents("99.999")).toThrow("Maximum 2 decimal places");
    });
  });

  describe("non-throwing display helpers degrade gracefully on invalid/edge inputs", () => {
    it("percent returns 0 when whole is zero or negative instead of throwing DivisionByZero", () => {
      expect(percent(100n, 0n)).toBe(0);
      expect(percent(100n, -50n)).toBe(0);
      expect(percent(-25n, 100n)).toBe(0);
      expect(percent(250n, 100n)).toBe(100);
    });

    it("holderSharePercentages returns zeroed strings when supply <= 0n or all balances <= 0n", () => {
      expect(holderSharePercentages([100n, 200n], 0n)).toEqual(["0.00", "0.00"]);
      expect(holderSharePercentages([100n, 200n], -10n)).toEqual(["0.00", "0.00"]);
      expect(holderSharePercentages([0n, -5n], 1000n)).toEqual(["0.00", "0.00"]);
    });

    it("ledgerToApproxDate returns null when targetLedger is 0 or NaN rather than an invalid Date", () => {
      expect(ledgerToApproxDate(0, 1000)).toBeNull();
      expect(ledgerToApproxDate(Number.NaN, 1000)).toBeNull();
    });

    it("truncateAddress and assetTypeLabel return readable strings for short or unknown values", () => {
      expect(truncateAddress("")).toBe("");
      expect(truncateAddress("SHORT")).toBe("SHORT");
      expect(assetTypeLabel("custom_rwa_class")).toBe("Custom Rwa Class");
    });
  });
});
