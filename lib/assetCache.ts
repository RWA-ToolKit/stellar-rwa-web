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

export function cacheAssetEntries(network: Network, assets: AssetEntry[]): void {
  assetsByNetwork.set(
    network,
    new Map(assets.map((asset) => [asset.id.toString(), asset])),
  );
}

export function getCachedAssetEntries(network: Network): AssetEntry[] | null {
  const assets = assetsByNetwork.get(network);
  return assets ? Array.from(assets.values()) : null;
}

/**
 * Load asset entries for `network`, optionally including inactive entries.
 *
 * Closure / dependency audit (#583):
 * - All inputs (`network`, `includeInactive`) are passed explicitly rather than
 *   captured from module-level state.
 * - Hooks calling `loadAssetEntries` (`useAssets`) list `[network, includeInactive]`
 *   in their `useAsync` dependency array, and `useAsync` invokes the latest
 *   `loaderRef.current()` so `refetch()` never reads a stale closure.
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

export function getCachedAsset(network: Network, id: bigint): AssetEntry | null {
  return assetsByNetwork.get(network)?.get(id.toString()) ?? null;
}

export function prefetchAssetMetadata(
  network: Network,
  tokenContract: string,
): Promise<AssetMetadata> {
  const key = metadataKey(network, tokenContract);
  const now = Date.now();
  const cached = metadataPrefetches.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) metadataPrefetches.delete(key);

  const promise = assetToken.getMetadata(network, tokenContract);
  const prefetch = { promise, expiresAt: now + PREFETCH_TTL_MS };
  metadataPrefetches.set(key, prefetch);
  // Stale-closure guard (#583): compare identity (`=== prefetch`) before
  // deleting so a late rejection from a superseded prefetch never evicts a
  // newer entry stored under the same `(network, tokenContract)` key.
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
  const key = metadataKey(network, tokenContract);
  const cached = metadataPrefetches.get(key);
  if (!cached) return null;
  metadataPrefetches.delete(key);
  return cached.expiresAt > Date.now() ? cached.promise : null;
}
