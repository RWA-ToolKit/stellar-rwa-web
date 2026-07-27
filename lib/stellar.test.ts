import { describe, expect, it } from "vitest";
import { parseContractError } from "@/lib/stellar";

describe("parseContractError", () => {
  it("matches the Error(Contract, #N) code regex", () => {
    expect(parseContractError("Error(Contract, #3)")).toBe(
      "You are not authorized to perform this action.",
    );
  });

  it("matches the code regex with no space after the comma", () => {
    expect(parseContractError("Error(Contract,#4)")).toBe(
      "The requested record was not found.",
    );
  });

  it("falls back to a generic message for an unrecognized code", () => {
    expect(parseContractError("Error(Contract, #99)")).toBe(
      "Contract rejected the call (code 99).",
    );
  });

  it("detects trustline/insufficient-balance failures", () => {
    expect(parseContractError("trustline missing for asset")).toBe(
      "Insufficient balance or a missing trustline for the payment token.",
    );
    expect(parseContractError("insufficient balance for transfer")).toBe(
      "Insufficient balance or a missing trustline for the payment token.",
    );
  });

  it("falls back to a generic message for unrecognized raw errors", () => {
    expect(parseContractError("some opaque host error")).toBe(
      "The contract call could not be completed.",
    );
  });

  describe("cross-contract mislabeling", () => {
    it("applies asset-token-specific codes only when contractKind is assetToken", () => {
      expect(parseContractError("Error(Contract, #6)", "assetToken")).toBe(
        "This asset is currently paused.",
      );
      expect(parseContractError("Error(Contract, #7)", "assetToken")).toBe(
        "The sender is not KYC-approved for this asset.",
      );
      expect(parseContractError("Error(Contract, #8)", "assetToken")).toBe(
        "The recipient is not KYC-approved for this asset.",
      );
    });

    it("does not mislabel the same codes when the error is from another contract", () => {
      expect(parseContractError("Error(Contract, #6)", "registry")).toBe(
        "Contract rejected the call (code 6).",
      );
      expect(parseContractError("Error(Contract, #7)", "compliance")).toBe(
        "Contract rejected the call (code 7).",
      );
      expect(parseContractError("Error(Contract, #8)", "dividend")).toBe(
        "Contract rejected the call (code 8).",
      );
    });

    it("does not mislabel asset-token codes when contractKind is omitted", () => {
      expect(parseContractError("Error(Contract, #6)")).toBe(
        "Contract rejected the call (code 6).",
      );
    });

    it("still applies shared lifecycle codes regardless of contractKind", () => {
      for (const kind of ["registry", "compliance", "assetToken", "dividend"] as const) {
        expect(parseContractError("Error(Contract, #2)", kind)).toBe(
          "Contract is not initialized.",
        );
      }
    });
  });
});
