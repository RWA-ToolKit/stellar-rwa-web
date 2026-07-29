"use client";

import { getAssetDetail, withFallback } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetDetail } from "@/types";

/**
 * A single asset joined with its on-chain token metadata. Prefers the REST
 * API (one round trip, no SDK); falls back to reading the registry entry
 * then the token contract directly, dynamically importing the Stellar SDK
 * only in that fallback path.
 */
export function useAsset(id: bigint | null) {
  const { network } = useWallet();
  return useAsync<AssetDetail>(
    async () => {
      if (id === null) throw new Error("Missing asset id");
      return withFallback(
        () => getAssetDetail(network, id),
        async () => {
          const { registry, assetToken } = await import("@/lib/contracts");
          const entry = await registry.getAsset(network, id);
          const metadata = await assetToken.getMetadata(network, entry.tokenContract);
          return { ...entry, metadata };
        },
      );
    },
    [id?.toString(), network],
    id !== null,
  );
}

/**
 * The connected wallet's balance of a given asset token, or 0n. This is a
 * live, wallet-specific read that always needs the on-chain contract, so the
 * SDK is dynamically imported here rather than bundled eagerly.
 */
export function useBalance(tokenContract: string | null) {
  const { network, address } = useWallet();
  return useAsync<bigint>(
    async () => {
      if (!tokenContract || !address) return 0n;
      const { assetToken } = await import("@/lib/contracts");
      return assetToken.balance(network, tokenContract, address);
    },
    [tokenContract, address, network],
    Boolean(tokenContract && address),
  );
}
