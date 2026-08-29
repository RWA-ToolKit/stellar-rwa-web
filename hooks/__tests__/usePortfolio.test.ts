import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolio } from "../usePortfolio";
import { registry, assetToken, dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import type { AssetEntry, AssetMetadata, Distribution } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  registry: {
    getAllAssets: jest.fn(),
  },
  assetToken: {
    balance: jest.fn(),
    getMetadata: jest.fn(),
  },
  dividend: {
    getDistributionsForAsset: jest.fn(),
    claimable: jest.fn(),
    hasClaimed: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;

function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "TOKEN_A",
    issuer: "GISSUER",
    name: "Asset A",
    assetType: "real_estate",
    valuation: BigInt(100_000_00),
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    name: "Asset A",
    symbol: "ASA",
    assetType: "real_estate",
    totalSupply: BigInt(1000),
    decimals: 7,
    admin: "GADMIN",
    complianceContract: "COMP_A",
    assetDescription: "Test asset",
    valuation: BigInt(100_000_00),
    paused: false,
    ...overrides,
  };
}

function makeDistribution(overrides: Partial<Distribution> = {}): Distribution {
  return {
    id: BigInt(1),
    assetToken: "TOKEN_A",
    amount: BigInt(500),
    blockTimestamp: 1000,
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("usePortfolio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({ network: "testnet", address: "GUSER123" });
  });

  it("returns empty portfolio when wallet is disconnected", async () => {
    mockUseWallet.mockReturnValue({ network: "testnet", address: null });

    const { result } = renderHook(() => usePortfolio());

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(registry.getAllAssets).not.toHaveBeenCalled();
  });

  it("aggregates holdings across assets and calculates total value and claimables", async () => {
    const asset1 = makeAsset({ id: BigInt(1), tokenContract: "TOKEN_A", valuation: BigInt(10000) });
    const asset2 = makeAsset({ id: BigInt(2), tokenContract: "TOKEN_B", valuation: BigInt(20000) });

    const meta1 = makeMetadata({ totalSupply: BigInt(100) });
    const meta2 = makeMetadata({ totalSupply: BigInt(200) });

    const dist1 = makeDistribution({ id: BigInt(10), assetToken: "TOKEN_A" });

    (registry.getAllAssets as jest.Mock).mockResolvedValue([asset1, asset2]);

    (assetToken.balance as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve(50n); // 50% of supply -> 5000
      if (token === "TOKEN_B") return Promise.resolve(50n); // 25% of supply -> 5000
      return Promise.resolve(0n);
    });

    (assetToken.getMetadata as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve(meta1);
      if (token === "TOKEN_B") return Promise.resolve(meta2);
      return Promise.reject(new Error("Unknown token"));
    });

    (dividend.getDistributionsForAsset as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve([dist1]);
      return Promise.resolve([]);
    });

    (dividend.claimable as jest.Mock).mockResolvedValue(150n);
    (dividend.hasClaimed as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.holdings).toHaveLength(2);
    expect(result.current.data?.totalValueCents).toBe(10000n);
    expect(result.current.data?.totalClaimable).toBe(150n);
  });

  it("returns empty holdings when user balance is 0 for all assets", async () => {
    const asset1 = makeAsset({ id: BigInt(1), tokenContract: "TOKEN_A" });
    (registry.getAllAssets as jest.Mock).mockResolvedValue([asset1]);
    (assetToken.balance as jest.Mock).mockResolvedValue(0n);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(makeMetadata());

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      holdings: [],
      totalValueCents: 0n,
      totalClaimable: 0n,
    });
  });
});
