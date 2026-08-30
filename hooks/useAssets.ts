"use client";

import { useMemo } from "react";
import { registry } from "@/lib/contracts";
import { api } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, Network } from "@/types";

async function loadAssets(network: Network, includeInactive?: boolean): Promise<AssetEntry[]> {
  try {
    const fromApi = await api.getAllAssets(network);
    if (fromApi) return includeInactive ? fromApi : fromApi.filter((a) => a.active);
  } catch (err) {
    console.warn("API getAllAssets failed, falling back to on-chain registry:", err);
  }
  
  const all = await registry.getAllAssets(network);
  return includeInactive ? all : all.filter((a) => a.active);
}

export function useAssets(opts?: { includeInactive?: boolean }) {
  const { network } = useWallet();
  const state = useAsync<AssetEntry[]>(
    () => loadAssets(network, opts?.includeInactive),
    [network],
  );
  return { ...state, assets: state.data ?? [] };
}

export interface PlatformStatsData {
  totalAssets: number;
  tvl: bigint;
  totalHolders: number | null;
  assets: AssetEntry[] | null;
}

export function usePlatformStats() {
  const { network } = useWallet();
  return useAsync<PlatformStatsData>(
    async () => {
      try {
        const fromApi = await api.getStats(network);
        if (fromApi) {
          return {
            totalAssets: fromApi.totalAssets,
            tvl: BigInt(fromApi.tvl),
            totalHolders: fromApi.totalHolders,
            assets: null,
          };
        }
      } catch (err) {
        console.warn("API getStats failed, falling back to on-chain registry:", err);
      }
      
      const [assets, tvl] = await Promise.all([
        registry.getAllAssets(network),
        registry.totalValueLocked(network),
      ]);
      const active = assets.filter((a) => a.active);
      return { totalAssets: active.length, tvl, totalHolders: null, assets: active };
    },
    [network],
  );
}

export function useIssuerAssets(issuer: string | null, network: Network) {
  return useAsync<AssetEntry[]>(
    async () => {
      if (!issuer) return [];
      
      try {
        const fromApi = await api.getAssetsByIssuer(issuer, network);
        if (fromApi) return fromApi;
      } catch (err) {
        console.warn("API getAssetsByIssuer failed, falling back to on-chain registry:", err);
      }
      
      return registry.getAssetsByIssuer(network, issuer);
    },
    [issuer, network],
    Boolean(issuer),
  );
}
