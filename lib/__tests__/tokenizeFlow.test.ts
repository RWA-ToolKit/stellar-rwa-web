import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateTokenContract,
  registerAsset,
  type TokenizeFormData,
  type ValidatedToken,
} from "@/lib/tokenizeFlow";
import { assetToken, registry, type WriteCtx } from "@/lib/contracts";
import type { AssetMetadata } from "@/types";

// Mock the contracts module
vi.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: vi.fn(),
  },
  registry: {
    registerAsset: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Issue #256 — tokenizeFlow step validation and failure attribution
// ---------------------------------------------------------------------------
describe("tokenizeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Step 1: validateTokenContract
  // =========================================================================
  describe("validateTokenContract (step 1)", () => {
    const mockValidMetadata: AssetMetadata = {
      name: "Test Asset",
      symbol: "TST",
      assetType: "RealWorldAsset",
      totalSupply: 1000000n,
      decimals: 6,
      admin: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      complianceContract: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      assetDescription: "A test RWA",
      valuation: 100000000n,
      paused: false,
    };

    describe("valid inputs", () => {
      it("passes when token contract is reachable and has valid metadata", async () => {
        vi.mocked(assetToken.getMetadata).mockResolvedValue(mockValidMetadata);

        const result = await validateTokenContract(
          "testnet",
          "CTEST_TOKEN_ID"
        );

        expect(result).toEqual({
          tokenContract: "CTEST_TOKEN_ID",
          metadata: mockValidMetadata,
        });
        expect(assetToken.getMetadata).toHaveBeenCalledWith(
          "testnet",
          "CTEST_TOKEN_ID"
        );
      });

      it("passes when token contract has name and symbol", async () => {
        const metadata: AssetMetadata = {
          ...mockValidMetadata,
          name: "MyAsset",
          symbol: "MYA",
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        const result = await validateTokenContract("testnet", "CTEST_ID");
        expect(result.metadata.name).toBe("MyAsset");
        expect(result.metadata.symbol).toBe("MYA");
      });
    });

    describe("invalid inputs", () => {
      it("throws when token contract is unreachable or doesn't exist", async () => {
        vi.mocked(assetToken.getMetadata).mockRejectedValue(
          new Error("Network error")
        );

        try {
          await validateTokenContract("testnet", "CINVALID_TOKEN_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "Could not read the token contract"
          );
          expect((e as Error).message).toContain(
            "Make sure the address is correct"
          );
        }
      });

      it("throws when getMetadata call fails with simulation error", async () => {
        vi.mocked(assetToken.getMetadata).mockRejectedValue(
          new Error("Simulation failed: contract not found")
        );

        try {
          await validateTokenContract("testnet", "CNONEXISTENT");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "Could not read the token contract"
          );
        }
      });

      it("throws when metadata is missing name", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          name: "", // Empty name
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "doesn't look like a valid asset-token"
          );
          expect((e as Error).message).toContain("missing name or symbol");
        }
      });

      it("throws when metadata is missing symbol", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          symbol: "", // Empty symbol
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "doesn't look like a valid asset-token"
          );
          expect((e as Error).message).toContain("missing name or symbol");
        }
      });

      it("throws when both name and symbol are missing", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          name: "",
          symbol: "",
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "doesn't look like a valid asset-token"
          );
        }
      });

      it("throws when metadata name is falsy (null or undefined)", async () => {
        const metadata = {
          ...mockValidMetadata,
          name: null as unknown as string,
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "doesn't look like a valid asset-token"
          );
        }
      });

      it("throws when metadata symbol is falsy (null or undefined)", async () => {
        const metadata = {
          ...mockValidMetadata,
          symbol: undefined as unknown as string,
        };

        vi.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect((e as Error).message).toContain(
            "doesn't look like a valid asset-token"
          );
        }
      });
    });

    describe("error messaging", () => {
      it("reports validation error specifically (doesn't mention registry or registration)", async () => {
        vi.mocked(assetToken.getMetadata).mockResolvedValue({
          ...mockValidMetadata,
          name: "",
        });

        try {
          await validateTokenContract("testnet", "CTEST_ID");
          expect.fail("Expected error");
        } catch (e) {
          const message = (e as Error).message;
          expect(message).toContain("token contract");
          expect(message).not.toContain("registry");
        }
      });
    });
  });

  // =========================================================================
  // Step 2: registerAsset
  // =========================================================================
  describe("registerAsset (step 2)", () => {
    const mockWriteCtx: WriteCtx = {
      network: "testnet",
      source: "GTEST_ISSUER",
      sign: vi.fn(),
    };

    const mockFormData: TokenizeFormData = {
      tokenContract: "CTEST_TOKEN_ID",
      name: "Test Asset",
      assetType: "RealWorldAsset",
      valuation: 100000000n,
    };

    describe("valid inputs", () => {
      it("calls registry.registerAsset with correct parameters", async () => {
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 123n,
        });

        await registerAsset(mockWriteCtx, mockFormData);

        expect(registry.registerAsset).toHaveBeenCalledWith(
          mockWriteCtx,
          {
            issuer: mockWriteCtx.source,
            tokenContract: mockFormData.tokenContract,
            name: mockFormData.name,
            assetType: mockFormData.assetType,
            valuation: mockFormData.valuation,
          }
        );
      });

      it("returns the asset ID from the transaction return value", async () => {
        const assetId = 42n;
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: assetId,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(assetId);
      });

      it("returns null when transaction has no return value", async () => {
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: undefined,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("returns null when return value is null", async () => {
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: null,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("converts various return value types to BigInt", async () => {
        // Test with string return value
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: "999" as unknown,
        });

        let result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(999n);

        // Test with number return value
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 888,
        });

        result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(888n);

        // Test with bigint return value
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 777n,
        });

        result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(777n);
      });
    });

    describe("error handling", () => {
      it("returns null if return value cannot be converted to BigInt", async () => {
        vi.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: "not_a_number",
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("propagates registry.registerAsset errors", async () => {
        const error = new Error("Registry write failed");
        vi.mocked(registry.registerAsset).mockRejectedValue(error);

        try {
          await registerAsset(mockWriteCtx, mockFormData);
          expect.fail("Expected error to be thrown");
        } catch (e) {
          expect(e).toBe(error);
        }
      });
    });
  });

  // =========================================================================
  // Multi-step flow
  // =========================================================================
  describe("multi-step tokenization flow", () => {
    const mockValidMetadata: AssetMetadata = {
      name: "RWA Token",
      symbol: "RWA",
      assetType: "RealWorldAsset",
      totalSupply: 1000000n,
      decimals: 6,
      admin: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      complianceContract: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      assetDescription: "Real world asset",
      valuation: 500000000n,
      paused: false,
    };

    const mockWriteCtx: WriteCtx = {
      network: "testnet",
      source: "GISSUER",
      sign: vi.fn(),
    };

    const mockFormData: TokenizeFormData = {
      tokenContract: "CTOKEN",
      name: "Asset Name",
      assetType: "Bond",
      valuation: 250000000n,
    };

    it("step 1 failure prevents step 2 from running", async () => {
      // Step 1 fails: token contract validation
      vi.mocked(assetToken.getMetadata).mockRejectedValue(
        new Error("Contract not found")
      );

      try {
        await validateTokenContract("testnet", mockFormData.tokenContract);
        expect.fail("Expected step 1 to fail");
      } catch (e) {
        expect((e as Error).message).toContain("Could not read");
      }

      // Step 2 should not be called
      expect(registry.registerAsset).not.toHaveBeenCalled();
    });

    it("can complete both steps successfully in sequence", async () => {
      // Step 1: Validate token contract
      vi.mocked(assetToken.getMetadata).mockResolvedValue(mockValidMetadata);

      const validated = await validateTokenContract(
        "testnet",
        mockFormData.tokenContract
      );
      expect(validated.metadata.name).toBe(mockValidMetadata.name);

      // Step 2: Register asset
      vi.mocked(registry.registerAsset).mockResolvedValue({
        hash: "tx_hash",
        returnValue: 100n,
      });

      const assetId = await registerAsset(mockWriteCtx, mockFormData);
      expect(assetId).toBe(100n);

      // Verify both were called
      expect(assetToken.getMetadata).toHaveBeenCalledWith(
        "testnet",
        mockFormData.tokenContract
      );
      expect(registry.registerAsset).toHaveBeenCalled();
    });

    it("step 1 validation with missing symbol fails before step 2", async () => {
      const invalidMetadata = { ...mockValidMetadata, symbol: "" };
      vi.mocked(assetToken.getMetadata).mockResolvedValue(invalidMetadata);

      try {
        await validateTokenContract("testnet", mockFormData.tokenContract);
        expect.fail("Expected validation to fail");
      } catch (e) {
        expect((e as Error).message).toContain("asset-token");
        expect((e as Error).message).toContain("symbol");
      }

      expect(registry.registerAsset).not.toHaveBeenCalled();
    });
  });

  describe("step-level failure attribution", () => {
    it("validateTokenContract errors mention step 1 context", async () => {
      vi.mocked(assetToken.getMetadata).mockRejectedValue(
        new Error("RPC error")
      );

      try {
        await validateTokenContract("testnet", "CTEST");
        expect.fail("Expected error");
      } catch (e) {
        const message = (e as Error).message;
        // Error message should indicate it's about the token contract (step 1),
        // not the registry or registration
        expect(message).toContain("token contract");
      }
    });

    it("registerAsset can distinguish failures from step 2 context", async () => {
      const ctx: WriteCtx = {
        network: "testnet",
        source: "GISSUER",
        sign: vi.fn(),
      };

      const data: TokenizeFormData = {
        tokenContract: "CTOKEN",
        name: "Asset",
        assetType: "RWA",
        valuation: 100000000n,
      };

      vi.mocked(registry.registerAsset).mockRejectedValue(
        new Error("Authorization failed")
      );

      try {
        await registerAsset(ctx, data);
        expect.fail("Expected error");
      } catch (e) {
        // Error propagates directly from registry.registerAsset (step 2)
        expect((e as Error).message).toContain("Authorization");
      }
    });
  });
});
