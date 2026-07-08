"use client";

import { useMemo } from "react";
import { registry } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, Network } from "@/types";

/** All registered assets on the active network (active ones only by default). */
export function useAssets(opts?: { includeInactive?: boolean }) {
  const { network } = useWallet();
  const state = useAsync<AssetEntry[]>(
    () => registry.getAllAssets(network),
    [network],
  );
  const assets = useMemo(() => {
    const list = state.data ?? [];
    return opts?.includeInactive ? list : list.filter((a) => a.active);
  }, [state.data, opts?.includeInactive]);

  return { ...state, assets };
}

/** Platform-wide headline stats sourced from the registry contract. */
export function usePlatformStats() {
  const { network } = useWallet();
  return useAsync(
    async () => {
      const [assets, tvl] = await Promise.all([
        registry.getAllAssets(network),
        registry.totalValueLocked(network),
      ]);
      const active = assets.filter((a) => a.active);
      return {
        totalAssets: active.length,
        tvl,
        assets: active,
      };
    },
    [network],
  );
}

/** Assets issued by a specific address (for the issuer dashboard). */
export function useIssuerAssets(issuer: string | null, network: Network) {
  return useAsync<AssetEntry[]>(
    () => (issuer ? registry.getAssetsByIssuer(network, issuer) : Promise.resolve([])),
    [issuer, network],
    Boolean(issuer),
  );
}
