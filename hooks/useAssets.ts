"use client";

import { useMemo } from "react";
import { getAllAssets, getStats, withFallback } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, Network } from "@/types";

/**
 * Fetch all registered assets. Prefers the REST API (no Stellar SDK needed);
 * falls back to a direct on-chain registry read, dynamically importing the
 * SDK only when the API is unavailable.
 */
async function fetchAllAssets(network: Network): Promise<AssetEntry[]> {
  return withFallback(
    () => getAllAssets(network),
    async () => {
      const { registry } = await import("@/lib/contracts");
      return registry.getAllAssets(network);
    },
  );
}

/** All registered assets on the active network (active ones only by default). */
export function useAssets(opts?: { includeInactive?: boolean }) {
  const { network } = useWallet();
  const state = useAsync<AssetEntry[]>(
    () => fetchAllAssets(network),
    [network],
  );
  const assets = useMemo(() => {
    const list = state.data ?? [];
    return opts?.includeInactive ? list : list.filter((a) => a.active);
  }, [state.data, opts?.includeInactive]);

  return { ...state, assets };
}

/** Platform-wide headline stats, preferring the API's aggregated `/stats`. */
export function usePlatformStats() {
  const { network } = useWallet();
  return useAsync(
    async () => {
      return withFallback(
        async () => {
          const [stats, assets] = await Promise.all([
            getStats(network),
            fetchAllAssets(network),
          ]);
          return {
            totalAssets: stats.totalAssets,
            tvl: stats.totalValueLocked,
            assets: assets.filter((a) => a.active),
          };
        },
        async () => {
          const { registry } = await import("@/lib/contracts");
          const [assets, tvl] = await Promise.all([
            registry.getAllAssets(network),
            registry.totalValueLocked(network),
          ]);
          const active = assets.filter((a) => a.active);
          return { totalAssets: active.length, tvl, assets: active };
        },
      );
    },
    [network],
  );
}

/** Assets issued by a specific address (for the issuer dashboard). */
export function useIssuerAssets(issuer: string | null, network: Network) {
  return useAsync<AssetEntry[]>(
    async () => {
      if (!issuer) return [];
      const { registry } = await import("@/lib/contracts");
      return registry.getAssetsByIssuer(network, issuer);
    },
    [issuer, network],
    Boolean(issuer),
  );
}
