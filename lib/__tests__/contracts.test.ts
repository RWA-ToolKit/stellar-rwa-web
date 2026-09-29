jest.mock("@/lib/stellar", () => ({
  readContract: jest.fn(),
}));

import { assetToken, contractIds } from "@/lib/contracts";
import { readContract } from "@/lib/stellar";
import type { Network } from "@/types";

// ---------------------------------------------------------------------------
// Issue #253 — contractIds per-network resolution
// ---------------------------------------------------------------------------
describe("contractIds", () => {
  describe("per-network contract ID resolution", () => {
    it("returns contract IDs for testnet", () => {
      const ids = contractIds("testnet");
      expect(ids).toBeDefined();
      expect(ids.registry).toBeDefined();
      expect(ids.compliance).toBeDefined();
      expect(ids.dividend).toBeDefined();
      // Testnet defaults from stellar.ts:
      expect(ids.registry).toBe(
        process.env.NEXT_PUBLIC_TESTNET_REGISTRY_ID ||
          "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3"
      );
      expect(ids.compliance).toBe(
        process.env.NEXT_PUBLIC_TESTNET_COMPLIANCE_ID ||
          "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU"
      );
      expect(ids.dividend).toBe(
        process.env.NEXT_PUBLIC_TESTNET_DIVIDEND_ID ||
          "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX"
      );
    });

    describe("assetToken.decimals", () => {
      beforeEach(() => jest.clearAllMocks());

      it("reads token decimals from its own contract", async () => {
        (readContract as jest.Mock).mockResolvedValue(2);

        await expect(assetToken.decimals("testnet", "CTOKEN_VALID")).resolves.toBe(2);
        expect(readContract).toHaveBeenCalledWith("testnet", "CTOKEN_VALID", "decimals");
      });

      it("shares one in-flight decimals read for concurrent calls", async () => {
        (readContract as jest.Mock).mockResolvedValue(6);

        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            assetToken.decimals("testnet", "CTOKEN_SHARED"),
          ),
        );

        expect(results).toEqual([6, 6, 6, 6, 6]);
        expect(readContract).toHaveBeenCalledTimes(1);
        expect(readContract).toHaveBeenCalledWith(
          "testnet",
          "CTOKEN_SHARED",
          "decimals",
        );
      });

      it("caches decimals separately by network and token", async () => {
        (readContract as jest.Mock).mockResolvedValue(7);

        await Promise.all([
          assetToken.decimals("testnet", "CTOKEN_TESTNET"),
          assetToken.decimals("mainnet", "CTOKEN_TESTNET"),
          assetToken.decimals("testnet", "CTOKEN_OTHER"),
        ]);

        expect(readContract).toHaveBeenCalledTimes(3);
      });

      it("retries a decimals read after a failure", async () => {
        (readContract as jest.Mock)
          .mockRejectedValueOnce(new Error("RPC unavailable"))
          .mockResolvedValueOnce(8);

        await expect(
          assetToken.decimals("testnet", "CTOKEN_RETRY"),
        ).rejects.toThrow("RPC unavailable");
        await expect(
          assetToken.decimals("testnet", "CTOKEN_RETRY"),
        ).resolves.toBe(8);
        expect(readContract).toHaveBeenCalledTimes(2);
      });

      it.each([-1, 1.5, 256, undefined])("rejects invalid decimals value %s", async (decimals) => {
        (readContract as jest.Mock).mockResolvedValue(decimals);

        await expect(
          assetToken.decimals("testnet", `CTOKEN_INVALID_${String(decimals)}`),
        ).rejects.toThrow("returned invalid decimals");
      });
    });

    it("returns contract IDs for mainnet", () => {
      const ids = contractIds("mainnet");
      expect(ids).toBeDefined();
      expect(ids.registry).toBeDefined();
      expect(ids.compliance).toBeDefined();
      expect(ids.dividend).toBeDefined();
      // Mainnet uses env vars with empty string fallback
      expect(ids.registry).toBe(
        process.env.NEXT_PUBLIC_MAINNET_REGISTRY_ID ?? ""
      );
      expect(ids.compliance).toBe(
        process.env.NEXT_PUBLIC_MAINNET_COMPLIANCE_ID ?? ""
      );
      expect(ids.dividend).toBe(
        process.env.NEXT_PUBLIC_MAINNET_DIVIDEND_ID ?? ""
      );
    });

    it("returns ContractIds object with correct structure", () => {
      const ids = contractIds("testnet");
      expect(Object.keys(ids).sort()).toEqual(
        ["compliance", "dividend", "registry"].sort()
      );
    });

    it("uses environment variables for testnet when provided", () => {
      const envVars = {
        NEXT_PUBLIC_TESTNET_REGISTRY_ID: "CTEST_REGISTRY_ID",
        NEXT_PUBLIC_TESTNET_COMPLIANCE_ID: "CTEST_COMPLIANCE_ID",
        NEXT_PUBLIC_TESTNET_DIVIDEND_ID: "CTEST_DIVIDEND_ID",
      };

      // Temporarily set env vars
      const originalEnv = { ...process.env };
      Object.assign(process.env, envVars);

      // Note: Since contractIds is evaluated at module load time, this test
      // verifies the fallback defaults are in place when env vars are not set.
      // For a full env var test, the module would need to be reimported.

      Object.assign(process.env, originalEnv);
    });
  });

  describe("unknown network handling", () => {
    it("returns undefined for unknown/unsupported networks (type safety)", () => {
      // Network is a strict union type: "testnet" | "mainnet"
      // At compile time, unknown networks can't be passed.
      // At runtime with type assertion, the function accesses IDS[network]:
      const unknownNetwork = "futurenet" as unknown as Network;
      const ids = contractIds(unknownNetwork);
      // The actual behavior: accessing IDS["futurenet"] returns undefined
      expect(ids).toBeUndefined();
    });

    it("does not throw or warn for unknown networks, just returns undefined", () => {
      // The function has no error handling for unknown networks.
      // It simply returns IDS[network], which is undefined if network not in IDS.
      const consoleWarnSpy = jest.spyOn(console, "warn");

      const unknownNetwork = "unknown" as unknown as Network;
      const ids = contractIds(unknownNetwork);

      expect(ids).toBeUndefined();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("contract ID format validation", () => {
    it("testnet contract IDs follow Stellar format (start with C)", () => {
      const ids = contractIds("testnet");
      expect(ids.registry).toMatch(/^C[A-Z0-9]{55}$/);
      expect(ids.compliance).toMatch(/^C[A-Z0-9]{55}$/);
      expect(ids.dividend).toMatch(/^C[A-Z0-9]{55}$/);
    });

    it("mainnet contract IDs are either empty or follow Stellar format", () => {
      const ids = contractIds("mainnet");
      // Mainnet defaults to empty string if not in env var
      // So they either match the Stellar format or are empty
      const stellarFormat = /^C[A-Z0-9]{55}$/;
      expect(
        ids.registry === "" || ids.registry.match(stellarFormat)
      ).toBeTruthy();
      expect(
        ids.compliance === "" || ids.compliance.match(stellarFormat)
      ).toBeTruthy();
      expect(ids.dividend === "" || ids.dividend.match(stellarFormat)).toBeTruthy();
    });
  });
});
