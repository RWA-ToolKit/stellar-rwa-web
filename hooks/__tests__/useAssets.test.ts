import { renderHook, waitFor } from "@testing-library/react";
import { useAssets, usePlatformStats, useIssuerAssets } from "../useAssets";
import { registry } from "@/lib/contracts";
import { api } from "@/lib/api";
import type { AssetEntry } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  registry: {
    getAllAssets: jest.fn(),
    totalValueLocked: jest.fn(),
    getAssetsByIssuer: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  api: {
    getAllAssets: jest.fn(),
    getStats: jest.fn(),
    getAssetsByIssuer: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "CONTRACT_A",
    issuer: "GISSUER",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: BigInt(100_000_00), // $100 000 in USD cents
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

// ─── useAssets ────────────────────────────────────────────────────────────────

describe("useAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts in loading state", () => {
    // Mock that never resolves so we can observe the initial state
    (api.getAllAssets as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAssets());

    expect(result.current.loading).toBe(true);
    expect(result.current.assets).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("returns assets from api when api succeeds", async () => {
    const asset = makeAsset();
    (api.getAllAssets as jest.Mock).mockResolvedValue([asset]);

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.assets).toEqual([asset]);
    expect(result.current.error).toBeNull();
    // Contract should not be called when api returns data
    expect(registry.getAllAssets).not.toHaveBeenCalled();
  });

  it("falls back to registry contract when api returns null", async () => {
    const asset = makeAsset();
    (api.getAllAssets as jest.Mock).mockResolvedValue(null);
    (registry.getAllAssets as jest.Mock).mockResolvedValue([asset]);

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.assets).toEqual([asset]);
    expect(registry.getAllAssets).toHaveBeenCalledWith("testnet");
    expect(result.current.error).toBeNull();
  });

  it("filters out inactive assets by default", async () => {
    const active = makeAsset({ id: BigInt(1), active: true });
    const inactive = makeAsset({ id: BigInt(2), active: false });
    (api.getAllAssets as jest.Mock).mockResolvedValue([active, inactive]);

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.assets).toEqual([active]);
  });

  it("includes inactive assets when includeInactive is true", async () => {
    const active = makeAsset({ id: BigInt(1), active: true });
    const inactive = makeAsset({ id: BigInt(2), active: false });
    (api.getAllAssets as jest.Mock).mockResolvedValue([active, inactive]);

    const { result } = renderHook(() => useAssets({ includeInactive: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.assets).toEqual([active, inactive]);
  });

  it("surfaces error and clears loading when api throws", async () => {
    (api.getAllAssets as jest.Mock).mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network failure");
    expect(result.current.assets).toEqual([]);
    // loading must not be stuck true
    expect(result.current.loading).toBe(false);
  });

  it("surfaces error and clears loading when contract fallback throws", async () => {
    (api.getAllAssets as jest.Mock).mockResolvedValue(null);
    (registry.getAllAssets as jest.Mock).mockRejectedValue(new Error("RPC error"));

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("RPC error");
    expect(result.current.loading).toBe(false);
  });
});

// ─── usePlatformStats ─────────────────────────────────────────────────────────

describe("usePlatformStats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts in loading state", () => {
    (api.getStats as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePlatformStats());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("returns stats from api when api succeeds", async () => {
    (api.getStats as jest.Mock).mockResolvedValue({
      totalAssets: 5,
      tvl: "500000",
      totalHolders: 42,
    });

    const { result } = renderHook(() => usePlatformStats());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      totalAssets: 5,
      tvl: BigInt("500000"),
      totalHolders: 42,
      assets: null,
    });
    expect(result.current.error).toBeNull();
    expect(registry.getAllAssets).not.toHaveBeenCalled();
  });

  it("falls back to registry contract when api returns null", async () => {
    const assets = [makeAsset({ id: BigInt(1) }), makeAsset({ id: BigInt(2) })];
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (registry.getAllAssets as jest.Mock).mockResolvedValue(assets);
    (registry.totalValueLocked as jest.Mock).mockResolvedValue(BigInt(200_000_00));

    const { result } = renderHook(() => usePlatformStats());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.totalAssets).toBe(2);
    expect(result.current.data?.tvl).toBe(BigInt(200_000_00));
    expect(result.current.data?.assets).toEqual(assets);
    expect(result.current.error).toBeNull();
  });

  it("surfaces error and clears loading when stats fetch fails", async () => {
    (api.getStats as jest.Mock).mockRejectedValue(new Error("Stats unavailable"));

    const { result } = renderHook(() => usePlatformStats());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Stats unavailable");
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});

// ─── useIssuerAssets ──────────────────────────────────────────────────────────

describe("useIssuerAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty array immediately when issuer is null (not enabled)", async () => {
    const { result } = renderHook(() => useIssuerAssets(null, "testnet"));

    // enabled=false, so loading starts false
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(api.getAssetsByIssuer).not.toHaveBeenCalled();
  });

  it("returns issuer assets from api when api succeeds", async () => {
    const asset = makeAsset({ issuer: "GISSUER1" });
    (api.getAssetsByIssuer as jest.Mock).mockResolvedValue([asset]);

    const { result } = renderHook(() => useIssuerAssets("GISSUER1", "testnet"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([asset]);
    expect(result.current.error).toBeNull();
    expect(registry.getAssetsByIssuer).not.toHaveBeenCalled();
  });

  it("falls back to registry contract when api returns null", async () => {
    const asset = makeAsset({ issuer: "GISSUER1" });
    (api.getAssetsByIssuer as jest.Mock).mockResolvedValue(null);
    (registry.getAssetsByIssuer as jest.Mock).mockResolvedValue([asset]);

    const { result } = renderHook(() => useIssuerAssets("GISSUER1", "testnet"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([asset]);
    expect(registry.getAssetsByIssuer).toHaveBeenCalledWith("testnet", "GISSUER1");
  });

  it("surfaces error and clears loading when fetch fails", async () => {
    (api.getAssetsByIssuer as jest.Mock).mockRejectedValue(new Error("Issuer fetch failed"));

    const { result } = renderHook(() => useIssuerAssets("GISSUER1", "testnet"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Issuer fetch failed");
    expect(result.current.loading).toBe(false);
  });
});
