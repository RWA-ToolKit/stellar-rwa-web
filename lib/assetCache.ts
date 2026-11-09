import { api } from "@/lib/api";
import { assetToken, registry } from "@/lib/contracts";
import type { AssetEntry, AssetMetadata, Network } from "@/types";

const PREFETCH_TTL_MS = 15_000;
const assetsByNetwork = new Map<Network, Map<string, AssetEntry>>();
const metadataPrefetches = new Map<
  string,
  { promise: Promise<AssetMetadata>; expiresAt: number }
>();

function metadataKey(network: Network, tokenContract: string): string {
  return `${network}:${tokenContract}`;
}

/**
 * Replace the cached asset map for `network`.
 *
 * Empty / zero input behavior (#582):
 * - Passing `assets = []` stores an empty `Map` for `network` so
 *   `getCachedAssetEntries(network)` returns `[]` (distinct from `null` when
 *   no entries have ever been cached for that network).
 * - Asset ID `0n` (`BigInt(0)`) is a valid Soroban registry ID (the first
 *   registered asset) and is keyed as `"0"` without falsy coercion.
 */
export function cacheAssetEntries(network: Network, assets: AssetEntry[]): void {
  assetsByNetwork.set(
    network,
    new Map((assets ?? []).map((asset) => [asset.id.toString(), asset])),
  );
}

export function getCachedAssetEntries(network: Network): AssetEntry[] | null {
  const assets = assetsByNetwork.get(network);
  return assets ? Array.from(assets.values()) : null;
}

/**
 * Load asset entries for `network` and populate the cache.
 *
 * Empty / null behavior (#582):
 * - If the indexer returns `[]` (an empty array), `fromApi ?? ...` keeps `[]`
 *   without falling back to `registry.getAllAssets(network)`.
 * - Only `null` (indexer unavailable/disabled) triggers the on-chain fallback.
 * - When all entries are inactive and `includeInactive` is `false`, `[]` is
 *   cached and returned.
 */
export async function loadAssetEntries(
  network: Network,
  includeInactive = false,
): Promise<AssetEntry[]> {
  const fromApi = await api.getAllAssets();
  const all = fromApi ?? await registry.getAllAssets(network);
  const assets = includeInactive ? all : all.filter((asset) => asset.active);
  cacheAssetEntries(network, assets);
  return assets;
}

/**
 * Look up a single cached asset by `id` (`0n` is a valid asset ID).
 * Returns `null` if `id` is nullish or not present in `network`'s cache.
 */
export function getCachedAsset(
  network: Network,
  id: bigint | null | undefined,
): AssetEntry | null {
  if (id === null || id === undefined) return null;
  return assetsByNetwork.get(network)?.get(id.toString()) ?? null;
}

/**
 * Prefetch token metadata for `(network, tokenContract)` with a 15s TTL.
 * Rejects without caching if `tokenContract` is empty or whitespace-only.
 */
export function prefetchAssetMetadata(
  network: Network,
  tokenContract: string,
): Promise<AssetMetadata> {
  const normalizedContract = tokenContract?.trim() ?? "";
  if (!normalizedContract) {
    return Promise.reject(new Error("tokenContract is required"));
  }
  const key = metadataKey(network, normalizedContract);
  const now = Date.now();
  const cached = metadataPrefetches.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) metadataPrefetches.delete(key);

  const promise = assetToken.getMetadata(network, normalizedContract);
  const prefetch = { promise, expiresAt: now + PREFETCH_TTL_MS };
  metadataPrefetches.set(key, prefetch);
  promise.catch(() => {
    if (metadataPrefetches.get(key) === prefetch) {
      metadataPrefetches.delete(key);
    }
  });
  return promise;
}

export function takePrefetchedAssetMetadata(
  network: Network,
  tokenContract: string,
): Promise<AssetMetadata> | null {
  const normalizedContract = tokenContract?.trim() ?? "";
  if (!normalizedContract) return null;
  const key = metadataKey(network, normalizedContract);
  const cached = metadataPrefetches.get(key);
  if (!cached) return null;
  metadataPrefetches.delete(key);
  return cached.expiresAt > Date.now() ? cached.promise : null;
}
