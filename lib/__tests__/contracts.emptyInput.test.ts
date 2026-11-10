jest.mock("@/lib/stellar", () => ({
  ...jest.requireActual("@/lib/stellar"),
  invokeContract: jest.fn(),
  readContract: jest.fn(),
}));

import {
  assetToken,
  compliance,
  dividend,
  registry,
} from "@/lib/contracts";
import { invokeContract, readContract } from "@/lib/stellar";

describe("contracts client — empty/zero/null input & response handling (#662)", () => {
  const account = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
  const tokenId = "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";
  const complianceId = "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";
  const ctx = { network: "testnet" as const, source: account, sign: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registry.getAllAssets returns [] when readContract resolves with null or []", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(registry.getAllAssets("testnet")).resolves.toEqual([]);

    (readContract as jest.Mock).mockResolvedValueOnce([]);
    await expect(registry.getAllAssets("testnet")).resolves.toEqual([]);
  });

  it("registry.getAssetsByIssuer and getAssetsByType handle empty string inputs and null responses", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(registry.getAssetsByIssuer("testnet", account)).resolves.toEqual([]);

    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(registry.getAssetsByType("testnet", "")).resolves.toEqual([]);
  });

  it("registry.totalValueLocked and assetCount coerce null/undefined/0n to 0n", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(registry.totalValueLocked("testnet")).resolves.toBe(0n);

    (readContract as jest.Mock).mockResolvedValueOnce(0n);
    await expect(registry.assetCount("testnet")).resolves.toBe(0n);
  });

  it("assetToken.decimals accepts 0 decimals as a valid integer boundary", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(0);
    await expect(assetToken.decimals("testnet", "CTOKEN_ZERO_DECIMALS")).resolves.toBe(0);
  });

  it("assetToken.balance, allowance, and totalSupply coerce null/0n to 0n", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(assetToken.balance("testnet", tokenId, account)).resolves.toBe(0n);

    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(assetToken.allowance("testnet", tokenId, account, account)).resolves.toBe(0n);

    (readContract as jest.Mock).mockResolvedValueOnce(0n);
    await expect(assetToken.totalSupply("testnet", tokenId)).resolves.toBe(0n);
  });

  it("compliance.getRecord returns null and getAllowlist returns [] on empty/null responses", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(compliance.getRecord("testnet", complianceId, account)).resolves.toBeNull();

    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(compliance.getAllowlist("testnet", complianceId)).resolves.toEqual([]);

    (readContract as jest.Mock).mockResolvedValueOnce(false);
    await expect(compliance.isJurisdictionBlocked("testnet", complianceId, "")).resolves.toBe(false);
  });

  it("dividend read/write helpers handle empty distributions, 0n amounts, and 0 deadline", async () => {
    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(dividend.getDistributionsForAsset("testnet", tokenId)).resolves.toEqual([]);

    (readContract as jest.Mock).mockResolvedValueOnce(null);
    await expect(dividend.claimable("testnet", 0n, account)).resolves.toBe(0n);

    (invokeContract as jest.Mock).mockResolvedValueOnce({ hash: "zero-dist" });
    await dividend.createDistribution(ctx, tokenId, complianceId, 0n, [], 0);
    expect(invokeContract).toHaveBeenCalledWith(
      "testnet",
      account,
      expect.any(String),
      "create_distribution",
      expect.any(Array),
      ctx.sign,
      undefined,
    );
  });
});
