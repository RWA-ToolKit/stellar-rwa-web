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
  getCachedAssetEntries,
  loadAssetEntries,
  prefetchAssetMetadata,
  takePrefetchedAssetMetadata,
} from "../assetCache";
import { api } from "@/lib/api";
import { assetToken, registry } from "@/lib/contracts";
import { useAssets } from "@/hooks/useAssets";
import { useAsset } from "@/hooks/useAsset";
import { useWallet } from "@/hooks/useWallet";
import type { AssetEntry, AssetMetadata } from "@/types";

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

jest.mock("@/lib/stellar", () => ({
  isNotFoundError: () => false,
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

describe("error path (#581)", () => {
  beforeEach(() => {
    mockGetMetadata.mockReset();
    mockApiGetAllAssets.mockReset();
    mockRegistryGetAllAssets.mockReset();
    mockRegistryGetAsset.mockReset();
    mockUseWallet.mockReturnValue({ network: "testnet", address: null });
    cacheAssetEntries("testnet", []);
  });

  it("loadAssetEntries falls back to on-chain registry when api.getAllAssets rejects", async () => {
    const entry = makeEntry({ id: BigInt(10), name: "Fallback Asset" });
    mockApiGetAllAssets.mockRejectedValueOnce(new Error("Indexer offline"));
    mockRegistryGetAllAssets.mockResolvedValueOnce([entry]);

    const result = await loadAssetEntries("testnet");
    expect(result).toEqual([entry]);
    expect(getCachedAsset("testnet", BigInt(10))).toEqual(entry);
    expect( getCachedAssetEntries("testnet") ).toEqual([entry]);
  });

  it("loadAssetEntries preserves previously cached entries when both api and registry reject", async () => {
    const existing = makeEntry({ id: BigInt(7), name: "Previously Cached" });
    cacheAssetEntries("testnet", [existing]);

    mockApiGetAllAssets.mockRejectedValueOnce(new Error("Indexer down"));
    mockRegistryGetAllAssets.mockRejectedValueOnce(new Error("Soroban RPC timeout"));

    await expect(loadAssetEntries("testnet")).rejects.toThrow("Soroban RPC timeout");
    expect(getCachedAsset("testnet", BigInt(7))).toEqual(existing);
    expect(getCachedAssetEntries("testnet")).toEqual([existing]);
  });

  it("prefetchAssetMetadata converts synchronous throws into a rejected promise and evicts the cache entry", async () => {
    const token = "CTOKEN_SYNC_ERR";
    takePrefetchedAssetMetadata("testnet", token);

    mockGetMetadata.mockImplementationOnce(() => {
      throw new Error("Synchronous XDR decode error");
    });

    // Fire-and-forget call must not throw synchronously into a component event handler
    let promise!: Promise<AssetMetadata>;
    expect(() => {
      promise = prefetchAssetMetadata("testnet", token);
    }).not.toThrow();

    await expect(promise).rejects.toThrow("Synchronous XDR decode error");
    await Promise.resolve();

    // Entry was evicted, so takePrefetchedAssetMetadata returns null
    expect(takePrefetchedAssetMetadata("testnet", token)).toBeNull();
  });

  it("useAssets surfaces a readable error state instead of crashing when loadAssetEntries rejects", async () => {
    mockApiGetAllAssets.mockRejectedValueOnce(new Error("Indexer 503"));
    mockRegistryGetAllAssets.mockRejectedValueOnce(new Error("Registry RPC unreachable"));

    const { result } = renderHook(() => useAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Registry RPC unreachable");
    expect(result.current.assets).toEqual([]);
  });

  it("useAsset surfaces a readable error state and recovers on retry when prefetched metadata rejects", async () => {
    const entry = makeEntry({ id: BigInt(42), tokenContract: "CTOKEN_ERR_42" });
    cacheAssetEntries("testnet", [entry]);
    takePrefetchedAssetMetadata("testnet", entry.tokenContract);

    mockGetMetadata.mockRejectedValueOnce(new Error("Metadata RPC failed"));
    const prefetched = prefetchAssetMetadata("testnet", entry.tokenContract);
    // Attach a no-op handler so Jest does not flag unhandled rejection before useAsset consumes it
    prefetched.catch(() => {});

    const { result } = renderHook(() => useAsset(BigInt(42)));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Metadata RPC failed");
    expect(result.current.data).toBeNull();
    expect(result.current.notFound).toBe(false);

    // Retry should perform a fresh metadata fetch and recover cleanly
    const metadata = makeMetadata({ name: "Recovered Asset" });
    mockGetMetadata.mockResolvedValueOnce(metadata);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ ...entry, metadata });
  });
});

