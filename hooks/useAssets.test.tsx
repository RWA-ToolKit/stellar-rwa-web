import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { AssetEntry } from "@/types";

const getAllAssets = vi.fn();
const getAssetsByIssuer = vi.fn();
const totalValueLocked = vi.fn();

vi.mock("@/lib/contracts", () => ({
  registry: {
    getAllAssets: (...args: unknown[]) => getAllAssets(...args),
    getAssetsByIssuer: (...args: unknown[]) => getAssetsByIssuer(...args),
    totalValueLocked: (...args: unknown[]) => totalValueLocked(...args),
  },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

const { useAssets, usePlatformStats, useIssuerAssets } = await import("./useAssets");

function makeAsset(overrides: Partial<AssetEntry>): AssetEntry {
  return {
    id: 1n,
    tokenContract: "TOKEN",
    issuer: "ISSUER",
    name: "Asset",
    assetType: "real_estate",
    valuation: 100n,
    createdAt: 1,
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  getAllAssets.mockReset();
  getAssetsByIssuer.mockReset();
  totalValueLocked.mockReset();
});

describe("useAssets", () => {
  it("filters out inactive assets by default", async () => {
    getAllAssets.mockResolvedValue([
      makeAsset({ id: 1n, active: true }),
      makeAsset({ id: 2n, active: false }),
    ]);

    const { result } = renderHook(() => useAssets());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assets.map((a) => a.id)).toEqual([1n]);
  });

  it("includes inactive assets when includeInactive is set", async () => {
    getAllAssets.mockResolvedValue([
      makeAsset({ id: 1n, active: true }),
      makeAsset({ id: 2n, active: false }),
    ]);

    const { result } = renderHook(() => useAssets({ includeInactive: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assets.map((a) => a.id).sort()).toEqual([1n, 2n].sort());
    expect(result.current.assets).toHaveLength(2);
  });

  it("returns an empty asset list while data is not yet loaded", () => {
    getAllAssets.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAssets());
    expect(result.current.loading).toBe(true);
    expect(result.current.assets).toEqual([]);
  });
});

describe("usePlatformStats", () => {
  it("aggregates totalAssets/tvl/assets from only the active assets", async () => {
    getAllAssets.mockResolvedValue([
      makeAsset({ id: 1n, active: true, valuation: 100n }),
      makeAsset({ id: 2n, active: false, valuation: 200n }),
      makeAsset({ id: 3n, active: true, valuation: 300n }),
    ]);
    totalValueLocked.mockResolvedValue(999n);

    const { result } = renderHook(() => usePlatformStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.totalAssets).toBe(2);
    expect(result.current.data?.tvl).toBe(999n);
    expect(result.current.data?.assets.map((a) => a.id)).toEqual([1n, 3n]);
  });

  it("surfaces an error if either underlying call rejects", async () => {
    getAllAssets.mockResolvedValue([]);
    totalValueLocked.mockRejectedValue(new Error("rpc down"));

    const { result } = renderHook(() => usePlatformStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("rpc down");
    expect(result.current.data).toBeNull();
  });
});

describe("useIssuerAssets", () => {
  it("does not call the registry and returns no data while issuer is null", () => {
    const { result } = renderHook(() => useIssuerAssets(null, "testnet"));

    expect(getAssetsByIssuer).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("fetches issuer assets once an issuer address is provided", async () => {
    getAssetsByIssuer.mockResolvedValue([makeAsset({ id: 5n, issuer: "ISSUER_X" })]);

    const { result, rerender } = renderHook(
      ({ issuer }) => useIssuerAssets(issuer, "testnet"),
      { initialProps: { issuer: null as string | null } },
    );

    expect(getAssetsByIssuer).not.toHaveBeenCalled();

    rerender({ issuer: "ISSUER_X" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAssetsByIssuer).toHaveBeenCalledWith("testnet", "ISSUER_X");
    expect(result.current.data).toEqual([makeAsset({ id: 5n, issuer: "ISSUER_X" })]);
  });
});
