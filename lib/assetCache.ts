import { assetToken } from "@/lib/contracts";
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
