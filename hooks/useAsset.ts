"use client";

import { registry, assetToken } from "@/lib/contracts";
import { getCachedAsset, takePrefetchedAssetMetadata } from "@/lib/assetCache";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetDetail } from "@/types";

/**
 * A single asset joined with its on-chain token metadata. Reuses the list and
 * intent-prefetched metadata when available, otherwise reads the contracts.
 */
export function useAsset(id: bigint | null) {
  const { network } = useWallet();
  return useAsync<AssetDetail>(
    async () => {
      if (id === null) throw new Error("Missing asset id");
      const entry =
        getCachedAsset(network, id) ?? (await registry.getAsset(network, id));
      const metadataRequest =
        takePrefetchedAssetMetadata(network, entry.tokenContract) ??
        assetToken.getMetadata(network, entry.tokenContract);
      const metadata = await metadataRequest;
      return { ...entry, metadata };
    },
    [id?.toString(), network],
    id !== null,
  );
}

/** The connected wallet's balance of a given asset token, or 0n. */
export function useBalance(tokenContract: string | null) {
  const { network, address } = useWallet();
  return useAsync<bigint>(
    () =>
      tokenContract && address
        ? assetToken.balance(network, tokenContract, address)
        : Promise.resolve(0n),
    [tokenContract, address, network],
    Boolean(tokenContract && address),
  );
}
