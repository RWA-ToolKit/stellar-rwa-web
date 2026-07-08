"use client";

import { registry, assetToken } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetDetail } from "@/types";

/**
 * A single asset joined with its on-chain token metadata. Reads the registry
 * entry first, then the token contract it points at.
 */
export function useAsset(id: bigint | null) {
  const { network } = useWallet();
  return useAsync<AssetDetail>(
    async () => {
      if (id === null) throw new Error("Missing asset id");
      const entry = await registry.getAsset(network, id);
      const metadata = await assetToken.getMetadata(network, entry.tokenContract);
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
