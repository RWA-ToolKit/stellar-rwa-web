"use client";

import { getStats, withFallback } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry } from "@/types";

/**
 * Count the distinct KYC-approved addresses across a set of assets. Prefers
 * the API's aggregated `/stats.total_holders`, which is computed once
 * server-side instead of re-derived per page load. Falls back to reading
 * only each asset's `compliance_contract` field (not the full
 * `AssetMetadata`) and unioning the resulting allowlists, deduped by
 * compliance contract since assets can share one. Returns 0 for an empty
 * set.
 */
export function useHolderTotals(assets: AssetEntry[] | null) {
  const { network } = useWallet();
  const key = assets ? assets.map((a) => a.id.toString()).join(",") : "";
  return useAsync<number>(
    async () => {
      if (!assets || assets.length === 0) return 0;
      return withFallback(
        async () => (await getStats(network)).totalHolders,
        async () => {
          const { assetToken, compliance } = await import("@/lib/contracts");
          const complianceContracts = await Promise.all(
            assets.map((a) => assetToken.getComplianceContract(network, a.tokenContract)),
          );
          const uniqueContracts = Array.from(new Set(complianceContracts));
          const lists = await Promise.all(
            uniqueContracts.map((c) => compliance.getAllowlist(network, c)),
          );
          const unique = new Set<string>();
          for (const list of lists) for (const addr of list) unique.add(addr);
          return unique.size;
        },
      );
    },
    [key, network],
    assets !== null,
  );
}
