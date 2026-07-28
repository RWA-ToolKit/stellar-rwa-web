import { describe, it, expect, vi, beforeEach } from "vitest";

const readContract = vi.fn();
const invokeContract = vi.fn();

vi.mock("@/lib/stellar", () => ({
  readContract: (...args: unknown[]) => readContract(...args),
  invokeContract: (...args: unknown[]) => invokeContract(...args),
  arg: {
    address: (v: string) => ({ __arg: "address", v }),
    string: (v: string) => ({ __arg: "string", v }),
    symbol: (v: string) => ({ __arg: "symbol", v }),
    bool: (v: boolean) => ({ __arg: "bool", v }),
    u32: (v: number) => ({ __arg: "u32", v }),
    u64: (v: bigint | number) => ({ __arg: "u64", v: BigInt(v) }),
    i128: (v: bigint) => ({ __arg: "i128", v }),
  },
}));

const { registry, assetToken, compliance, dividend } = await import("./contracts");

beforeEach(() => {
  readContract.mockReset();
  invokeContract.mockReset();
});

describe("registry normalisation", () => {
  const rawEntry = {
    id: 7n,
    token_contract: "TOKEN_ID",
    issuer: "ISSUER_ID",
    name: "Downtown Lot 4",
    asset_type: "real_estate",
    valuation: 250_000_00n,
    created_at: 12345,
    active: true,
  };

  it("maps snake_case fields to camelCase for getAsset", async () => {
    readContract.mockResolvedValue(rawEntry);
    const result = await registry.getAsset("testnet", 7n);
    expect(result).toEqual({
      id: 7n,
      tokenContract: "TOKEN_ID",
      issuer: "ISSUER_ID",
      name: "Downtown Lot 4",
      assetType: "real_estate",
      valuation: 250_000_00n,
      createdAt: 12345,
      active: true,
    });
  });

  it("coerces id/valuation to bigint and createdAt to number even from non-bigint raw values", async () => {
    readContract.mockResolvedValue({
      ...rawEntry,
      id: 7 as unknown as bigint,
      valuation: 25000000 as unknown as bigint,
      created_at: "12345" as unknown as number,
    });
    const result = await registry.getAsset("testnet", 7n);
    expect(result.id).toBe(7n);
    expect(typeof result.id).toBe("bigint");
    expect(result.valuation).toBe(25000000n);
    expect(typeof result.valuation).toBe("bigint");
    expect(result.createdAt).toBe(12345);
    expect(typeof result.createdAt).toBe("number");
  });

  it("maps a list of raw entries for getAllAssets and defaults null to an empty array", async () => {
    readContract.mockResolvedValue([rawEntry, { ...rawEntry, id: 8n, active: false }]);
    const result = await registry.getAllAssets("testnet");
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: 8n, active: false });

    readContract.mockResolvedValue(null);
    expect(await registry.getAllAssets("testnet")).toEqual([]);
  });

  it("coerces totalValueLocked/assetCount to bigint, defaulting missing values to 0n", async () => {
    readContract.mockResolvedValue(42);
    expect(await registry.totalValueLocked("testnet")).toBe(42n);

    readContract.mockResolvedValue(undefined);
    expect(await registry.assetCount("testnet")).toBe(0n);
  });
});

describe("asset-token metadata normalisation", () => {
  it("maps snake_case metadata fields to camelCase and coerces bigints/numbers", async () => {
    readContract.mockResolvedValue({
      name: "Downtown Lot 4",
      symbol: "DTL4",
      asset_type: "real_estate",
      total_supply: 1000 as unknown as bigint,
      decimals: "7" as unknown as number,
      admin: "ADMIN_ID",
      compliance_contract: "COMPLIANCE_ID",
      asset_description: "A commercial lot.",
      valuation: 250_000_00n,
      paused: false,
    });

    const result = await assetToken.getMetadata("testnet", "TOKEN_ID");
    expect(result).toEqual({
      name: "Downtown Lot 4",
      symbol: "DTL4",
      assetType: "real_estate",
      totalSupply: 1000n,
      decimals: 7,
      admin: "ADMIN_ID",
      complianceContract: "COMPLIANCE_ID",
      assetDescription: "A commercial lot.",
      valuation: 250_000_00n,
      paused: false,
    });
    expect(typeof result.totalSupply).toBe("bigint");
    expect(typeof result.decimals).toBe("number");
  });

  it("defaults balance/totalSupply to 0n when the contract returns nullish", async () => {
    readContract.mockResolvedValue(null);
    expect(await assetToken.balance("testnet", "TOKEN_ID", "HOLDER")).toBe(0n);
    expect(await assetToken.totalSupply("testnet", "TOKEN_ID")).toBe(0n);
  });
});

describe("compliance status enum normalisation", () => {
  const rawKyc = {
    address: "HOLDER_ID",
    status: "Approved",
    jurisdiction: "US",
    verified_at: 100,
    expires_at: 200,
  };

  it("normalises a plain-string unit enum", async () => {
    readContract.mockResolvedValue(rawKyc);
    const result = await compliance.getRecord("testnet", "COMPLIANCE_ID", "HOLDER_ID");
    expect(result?.status).toBe("Approved");
  });

  it("normalises an array-wrapped unit enum to its first element", async () => {
    readContract.mockResolvedValue({ ...rawKyc, status: ["Suspended"] });
    const result = await compliance.getRecord("testnet", "COMPLIANCE_ID", "HOLDER_ID");
    expect(result?.status).toBe("Suspended");
  });

  it("also coerces verifiedAt/expiresAt to numbers and maps address/jurisdiction", async () => {
    readContract.mockResolvedValue({
      ...rawKyc,
      status: ["Rejected"],
      verified_at: "100" as unknown as number,
      expires_at: "200" as unknown as number,
    });
    const result = await compliance.getRecord("testnet", "COMPLIANCE_ID", "HOLDER_ID");
    expect(result).toEqual({
      address: "HOLDER_ID",
      status: "Rejected",
      jurisdiction: "US",
      verifiedAt: 100,
      expiresAt: 200,
    });
  });

  it("returns null when the contract has no record for the address", async () => {
    readContract.mockResolvedValue(null);
    expect(await compliance.getRecord("testnet", "COMPLIANCE_ID", "HOLDER_ID")).toBeNull();
  });
});

describe("dividend distribution normalisation", () => {
  const rawDist = {
    id: 3n,
    asset_token: "TOKEN_ID",
    payment_token: "USDC_ID",
    total_amount: 1_000_000n,
    distributed: 400_000n,
    snapshot_ledger: 555,
    created_at: 111,
    completed: false,
  };

  it("maps snake_case distribution fields to camelCase", async () => {
    readContract.mockResolvedValue(rawDist);
    const result = await dividend.getDistribution("testnet", 3n);
    expect(result).toEqual({
      id: 3n,
      assetToken: "TOKEN_ID",
      paymentToken: "USDC_ID",
      totalAmount: 1_000_000n,
      distributed: 400_000n,
      snapshotLedger: 555,
      createdAt: 111,
      completed: false,
    });
  });

  it("maps a list of distributions and defaults null to an empty array", async () => {
    readContract.mockResolvedValue([rawDist]);
    const result = await dividend.getDistributionsForAsset("testnet", "TOKEN_ID");
    expect(result).toEqual([
      expect.objectContaining({ id: 3n, assetToken: "TOKEN_ID" }),
    ]);

    readContract.mockResolvedValue(null);
    expect(await dividend.getDistributionsForAsset("testnet", "TOKEN_ID")).toEqual([]);
  });

  it("coerces claimable to bigint, defaulting to 0n", async () => {
    readContract.mockResolvedValue(undefined);
    expect(await dividend.claimable("testnet", 3n, "HOLDER_ID")).toBe(0n);
  });
});
