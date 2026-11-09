/**
 * Unit tests for lib/assetCache.ts
 *
 * Scenarios covered:
 *
 * cacheAssetEntries / getCachedAsset
 *   - Returns null before any entry is cached
 *   - Returns the matching entry after caching
 *   - Replacing a network's map does not affect other networks
 *   - cacheAssetEntries replaces (not merges) the map for a network
 *
 * prefetchAssetMetadata
 *   - Calls the factory exactly once within the TTL window (dedup)
 *   - Returns a fresh promise after the TTL expires
 *   - Evicts the entry on rejection so the next call retries
 *   - Concurrent callers share the same in-flight promise
 *
 * takePrefetchedAssetMetadata
 *   - Returns the cached promise and removes it (one-shot)
 *   - Returns null when nothing is cached for the key
 *   - Returns null after the TTL has expired
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import {
  cacheAssetEntries,
  getCachedAsset,
  prefetchAssetMetadata,
  takePrefetchedAssetMetadata,
} from "../assetCache";
import { api } from "@/lib/api";
import { assetToken, registry } from "@/lib/contracts";
import { useAssets } from "@/hooks/useAssets";
import { useAsset } from "@/hooks/useAsset";
import { useWallet } from "@/hooks/useWallet";
import type { AssetEntry, AssetMetadata, Network } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  api: {
    getAllAssets: jest.fn(),
    getAsset: jest.fn(),
  },
}));

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
  registry: {
    getAllAssets: jest.fn(),
    getAsset: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockGetMetadata = assetToken.getMetadata as jest.Mock;
const mockApiGetAllAssets = api.getAllAssets as jest.Mock;
const mockRegistryGetAllAssets = registry.getAllAssets as jest.Mock;
const mockRegistryGetAsset = registry.getAsset as jest.Mock;
const mockUseWallet = useWallet as jest.Mock;

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "CTOKEN_A",
    issuer: "GISSUER",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: BigInt(500_000_00),
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    name: "Test Asset",
    symbol: "TST",
    assetType: "real_estate",
    totalSupply: BigInt(1_000_000),
    decimals: 7,
    admin: "GADMIN",
    complianceContract: "COMPLIANCE",
    assetDescription: "A test asset",
    valuation: BigInt(500_000_00),
    paused: false,
    ...overrides,
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Reset the module-level Maps between tests by re-importing the module with
 * a fresh registry.  We use jest.resetModules() so the module-level Maps are
 * recreated on each import.
 */

// ─── tests ────────────────────────────────────────────────────────────────────

describe("cacheAssetEntries / getCachedAsset", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Seed an empty map for testnet and mainnet to start clean
    cacheAssetEntries("testnet", []);
    cacheAssetEntries("mainnet", []);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null before any entry has been cached for a network", () => {
    expect(getCachedAsset("testnet", BigInt(99))).toBeNull();
  });

  it("returns the matching entry after caching", () => {
    const entry = makeEntry({ id: BigInt(1) });
    cacheAssetEntries("testnet", [entry]);
    expect(getCachedAsset("testnet", BigInt(1))).toEqual(entry);
  });

  it("returns null for an id not in the cached list", () => {
    const entry = makeEntry({ id: BigInt(1) });
    cacheAssetEntries("testnet", [entry]);
    expect(getCachedAsset("testnet", BigInt(2))).toBeNull();
  });

  it("cacheAssetEntries replaces (not merges) the network map", () => {
    const entryA = makeEntry({ id: BigInt(1), name: "Asset A" });
    const entryB = makeEntry({ id: BigInt(2), name: "Asset B" });
    cacheAssetEntries("testnet", [entryA]);
    // Replace with a map that only contains entryB; entryA should be gone
    cacheAssetEntries("testnet", [entryB]);
    expect(getCachedAsset("testnet", BigInt(1))).toBeNull();
    expect(getCachedAsset("testnet", BigInt(2))).toEqual(entryB);
  });

  it("caching for one network does not affect another network", () => {
    const testnetEntry = makeEntry({ id: BigInt(1), name: "Testnet Asset" });
    const mainnetEntry = makeEntry({ id: BigInt(1), name: "Mainnet Asset" });
    cacheAssetEntries("testnet", [testnetEntry]);
    cacheAssetEntries("mainnet", [mainnetEntry]);
    expect(getCachedAsset("testnet", BigInt(1))?.name).toBe("Testnet Asset");
    expect(getCachedAsset("mainnet", BigInt(1))?.name).toBe("Mainnet Asset");
  });
});

describe("prefetchAssetMetadata", () => {
  const TOKEN = "CTOKEN_PREFETCH";

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Consume any prior cached entry so each test starts fresh
    takePrefetchedAssetMetadata("testnet", TOKEN);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls getMetadata once and returns the same promise on repeated calls within TTL", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    const p2 = prefetchAssetMetadata("testnet", TOKEN);

    expect(p1).toBe(p2);
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    await expect(p1).resolves.toEqual(metadata);
  });

  it("makes a fresh call after the 15 s TTL expires", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    await p1;

    // Consume the entry so it leaves the prefetch map (simulating take)
    takePrefetchedAssetMetadata("testnet", TOKEN);

    // Advance time past the 15 s TTL
    jest.advanceTimersByTime(15_001);

    mockGetMetadata.mockResolvedValue({ ...metadata, name: "Fresh" });
    const p2 = prefetchAssetMetadata("testnet", TOKEN);

    expect(p2).not.toBe(p1);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toMatchObject({ name: "Fresh" });
  });

  it("evicts the entry on rejection so the next call retries", async () => {
    const err = new Error("RPC down");
    mockGetMetadata.mockRejectedValueOnce(err);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    // Wait for the rejection handler to run
    await expect(p1).rejects.toThrow("RPC down");

    // Allow microtasks / promise chains to flush
    await Promise.resolve();

    // After rejection the entry must be gone; a new call should invoke factory again
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);
    const p2 = prefetchAssetMetadata("testnet", TOKEN);
    expect(p2).not.toBe(p1);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toEqual(metadata);
  });

  it("concurrent callers all receive the same in-flight promise", () => {
    mockGetMetadata.mockReturnValue(new Promise(() => {})); // never resolves

    const calls = [
      prefetchAssetMetadata("testnet", TOKEN),
      prefetchAssetMetadata("testnet", TOKEN),
      prefetchAssetMetadata("testnet", TOKEN),
    ];

    expect(calls[0]).toBe(calls[1]);
    expect(calls[1]).toBe(calls[2]);
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
  });

  it("uses separate cache entries for different (network, contract) keys", async () => {
    const metaA = makeMetadata({ name: "A" });
    const metaB = makeMetadata({ name: "B" });
    mockGetMetadata
      .mockResolvedValueOnce(metaA)
      .mockResolvedValueOnce(metaB);

    const pA = prefetchAssetMetadata("testnet", "TOKEN_A");
    const pB = prefetchAssetMetadata("testnet", "TOKEN_B");

    expect(pA).not.toBe(pB);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);

    await expect(pA).resolves.toMatchObject({ name: "A" });
    await expect(pB).resolves.toMatchObject({ name: "B" });

    // Clean up
    takePrefetchedAssetMetadata("testnet", "TOKEN_A");
    takePrefetchedAssetMetadata("testnet", "TOKEN_B");
  });
});

describe("takePrefetchedAssetMetadata", () => {
  const TOKEN = "CTOKEN_TAKE";

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Drain any leftover entry
    takePrefetchedAssetMetadata("testnet", TOKEN);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when nothing is cached", () => {
    expect(takePrefetchedAssetMetadata("testnet", TOKEN)).toBeNull();
  });

  it("returns the cached promise and removes it (one-shot semantics)", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const prefetched = prefetchAssetMetadata("testnet", TOKEN);
    const taken = takePrefetchedAssetMetadata("testnet", TOKEN);

    expect(taken).toBe(prefetched);
    await expect(taken).resolves.toEqual(metadata);

    // Second take must return null — it's been removed
    expect(takePrefetchedAssetMetadata("testnet", TOKEN)).toBeNull();
  });

  it("returns null after the TTL has expired", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    prefetchAssetMetadata("testnet", TOKEN);
    await Promise.resolve(); // let promise settle

    // Advance time past the 15 s TTL without consuming it
    jest.advanceTimersByTime(15_001);

    const taken = takePrefetchedAssetMetadata("testnet", TOKEN);
    expect(taken).toBeNull();
  });
});

describe("stale closure / dependency array (#583)", () => {
  beforeEach(() => {
    mockGetMetadata.mockReset();
    mockApiGetAllAssets.mockReset();
    mockRegistryGetAllAssets.mockReset();
    mockRegistryGetAsset.mockReset();
    mockUseWallet.mockReset();
    mockUseWallet.mockReturnValue({ network: "testnet" });
    cacheAssetEntries("testnet", []);
    cacheAssetEntries("mainnet", []);
    takePrefetchedAssetMetadata("testnet", "CTOKEN_1");
    takePrefetchedAssetMetadata("testnet", "CTOKEN_2");
  });

  it("re-runs useAssets with updated includeInactive and network without reading a stale closure", async () => {
    const activeAsset = makeEntry({ id: BigInt(1), name: "Active Asset", active: true });
    const inactiveAsset = makeEntry({ id: BigInt(2), name: "Inactive Asset", active: false });
    mockApiGetAllAssets.mockResolvedValue([activeAsset, inactiveAsset]);

    const { result, rerender } = renderHook(
      ({ includeInactive }: { includeInactive: boolean }) =>
        useAssets({ includeInactive }),
      { initialProps: { includeInactive: false } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assets).toEqual([activeAsset]);
    expect(getCachedAsset("testnet", BigInt(2))).toBeNull();

    // Flip includeInactive -> true and verify the hook does not read a stale closure
    rerender({ includeInactive: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assets).toEqual([activeAsset, inactiveAsset]);
    expect(getCachedAsset("testnet", BigInt(2))).toEqual(inactiveAsset);
  });

  it("re-runs useAsset when id or network changes and never reads a stale id closure on refetch", async () => {
    const entry1 = makeEntry({ id: BigInt(1), tokenContract: "CTOKEN_1", name: "Asset One" });
    const entry2 = makeEntry({ id: BigInt(2), tokenContract: "CTOKEN_2", name: "Asset Two" });
    cacheAssetEntries("testnet", [entry1, entry2]);

    const meta1 = makeMetadata({ name: "Asset One", symbol: "ONE" });
    const meta2 = makeMetadata({ name: "Asset Two", symbol: "TWO" });
    const meta2Refreshed = makeMetadata({ name: "Asset Two v2", symbol: "TWO" });

    mockGetMetadata.mockImplementation(async (_net: Network, contract: string) => {
      if (contract === "CTOKEN_1") return meta1;
      return meta2;
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: bigint | null }) => useAsset(id),
      { initialProps: { id: BigInt(1) } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.id).toBe(BigInt(1));
    expect(result.current.data?.metadata.symbol).toBe("ONE");

    // Change id to 2n — must not read stale id=1n
    rerender({ id: BigInt(2) });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.id).toBe(BigInt(2));
    expect(result.current.data?.metadata.symbol).toBe("TWO");

    // Manual refetch must also invoke the latest loader closure (id=2n)
    mockGetMetadata.mockResolvedValueOnce(meta2Refreshed);
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.metadata.name).toBe("Asset Two v2");
  });

  it("does not evict a newer prefetch entry when a stale in-flight prefetch rejects after TTL expiry", async () => {
    jest.useFakeTimers();
    try {
      let rejectFirst!: (reason?: unknown) => void;
      mockGetMetadata.mockImplementationOnce(
        () =>
          new Promise<AssetMetadata>((_, reject) => {
            rejectFirst = reject;
          }),
      );

      const firstPromise = prefetchAssetMetadata("testnet", "CTOKEN_1");

      // Advance past TTL so a second prefetch replaces the map entry
      jest.advanceTimersByTime(15_001);

      const freshMeta = makeMetadata({ name: "Fresh Metadata" });
      mockGetMetadata.mockResolvedValueOnce(freshMeta);
      const secondPromise = prefetchAssetMetadata("testnet", "CTOKEN_1");
      expect(secondPromise).not.toBe(firstPromise);

      // Now reject the stale first promise; its .catch closure must not delete secondPromise
      rejectFirst(new Error("Stale RPC failure"));
      await expect(firstPromise).rejects.toThrow("Stale RPC failure");
      await Promise.resolve();

      const taken = takePrefetchedAssetMetadata("testnet", "CTOKEN_1");
      expect(taken).toBe(secondPromise);
      await expect(taken).resolves.toEqual(freshMeta);
    } finally {
      jest.useRealTimers();
    }
  });
});
