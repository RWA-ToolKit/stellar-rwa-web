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
 * Load asset entries for `network`, falling back to the on-chain registry if
 * the indexer returns `null` or rejects.
 *
 * Error path (#581):
 * - If `api.getAllAssets()` throws/rejects, `loadAssetEntries` falls back to
 *   `registry.getAllAssets(network)`.
 * - If `registry.getAllAssets(network)` also rejects, previously cached entries
 *   for `network` are left untouched and the rejection propagates to `useAsync`
 *   so `useAssets` exposes a readable `error` state rather than crashing.
 */
export async function loadAssetEntries(
  network: Network,
  includeInactive = false,
): Promise<AssetEntry[]> {
  const fromApi = await api.getAllAssets().catch(() => null);
  const all = fromApi ?? (await registry.getAllAssets(network));
  const assets = includeInactive ? all : all.filter((asset) => asset.active);
  cacheAssetEntries(network, assets);
  return assets;
}

export function getCachedAsset(network: Network, id: bigint): AssetEntry | null {
  return assetsByNetwork.get(network)?.get(id.toString()) ?? null;
}

/**
 * Prefetch token metadata for `(network, tokenContract)` with a 15s TTL.
 *
 * Error path (#581):
 * - Synchronous throws from `assetToken.getMetadata` are converted into a
 *   rejected promise so fire-and-forget callers (e.g. hover prefetch) never
 *   crash a component render or event handler.
 * - Any rejection evicts the prefetch entry immediately so the next call or
 *   `useAsset` retry performs a fresh read.
 */
export function prefetchAssetMetadata(
  network: Network,
  tokenContract: string,
): Promise<AssetMetadata> {
  const key = metadataKey(network, tokenContract);
  const now = Date.now();
  const cached = metadataPrefetches.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) metadataPrefetches.delete(key);

  let promise: Promise<AssetMetadata>;
  try {
    promise = Promise.resolve(assetToken.getMetadata(network, tokenContract));
  } catch (err) {
    promise = Promise.reject(err);
  }
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
  const key = metadataKey(network, tokenContract);
  const cached = metadataPrefetches.get(key);
  if (!cached) return null;
  metadataPrefetches.delete(key);
  return cached.expiresAt > Date.now() ? cached.promise : null;
}
