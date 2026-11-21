import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { registry } from "@/lib/contracts";
import type { AssetEntry, Network } from "@/types";
import {
  cacheAssetEntries,
  getCachedAsset,
  getCachedAssetEntries,
  loadAssetEntries,
} from "@/lib/assetCache";

vi.mock("@/lib/api", () => ({
  api: { getAllAssets: vi.fn() },
}));

vi.mock("@/lib/contracts", () => ({
  registry: { getAllAssets: vi.fn() },
  assetToken: { getMetadata: vi.fn() },
}));

function makeAsset(id: number, network: Network): AssetEntry {
  return {
    id: BigInt(id),
    name: `${network}-asset-${id}`,
    symbol: `A${id}`,
    active: true,
  } as unknown as AssetEntry;
}

describe("assetCache network switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not surface cached testnet data after switching to mainnet", () => {
    cacheAssetEntries("testnet", [makeAsset(1, "testnet")]);

    expect(getCachedAssetEntries("testnet")).toHaveLength(1);
    expect(getCachedAssetEntries("mainnet")).toBeNull();
    expect(getCachedAsset("mainnet", 1n)).toBeNull();
  });

  it("keeps per-network caches isolated when both are populated", () => {
    cacheAssetEntries("testnet", [makeAsset(1, "testnet")]);
    cacheAssetEntries("mainnet", [makeAsset(2, "mainnet")]);

    expect(getCachedAsset("testnet", 1n)?.name).toBe("testnet-asset-1");
    expect(getCachedAsset("testnet", 2n)).toBeNull();
    expect(getCachedAsset("mainnet", 2n)?.name).toBe("mainnet-asset-2");
    expect(getCachedAsset("mainnet", 1n)).toBeNull();
  });

  it("does not leak an in-flight testnet load into mainnet after a switch", async () => {
    let resolveTestnet: (assets: AssetEntry[]) => void = () => {};
    const testnetAssets = new Promise<AssetEntry[]>((resolve) => {
      resolveTestnet = resolve;
    });

    vi.mocked(api.getAllAssets).mockReturnValueOnce(testnetAssets as never);

    const inFlight = loadAssetEntries("testnet");

    // Switch to mainnet before the testnet request resolves.
    expect(getCachedAssetEntries("mainnet")).toBeNull();

    resolveTestnet([makeAsset(1, "testnet")]);
    await inFlight;

    // Testnet data lands only in the testnet cache.
    expect(getCachedAssetEntries("testnet")).toHaveLength(1);
    expect(getCachedAssetEntries("mainnet")).toBeNull();
    expect(getCachedAsset("mainnet", 1n)).toBeNull();
  });

  it("falls back to the registry for the selected network only", async () => {
    vi.mocked(api.getAllAssets).mockResolvedValueOnce(null as never);
    vi.mocked(registry.getAllAssets).mockResolvedValueOnce([
      makeAsset(7, "mainnet"),
    ] as never);

    const assets = await loadAssetEntries("mainnet");

    expect(registry.getAllAssets).toHaveBeenCalledWith("mainnet");
    expect(assets).toHaveLength(1);
    expect(getCachedAsset("mainnet", 7n)).not.toBeNull();
    expect(getCachedAsset("testnet", 7n)).toBeNull();
  });
});
