"use client";

import { compliance, assetToken } from "@/lib/contracts";
import { api } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";

export interface Holder {
  address: string;
  balance: bigint;
}

/**
 * Derive an asset's holders. The token contract doesn't enumerate holders, so
 * we read the compliance allowlist (the only addresses that *can* hold it) and
 * keep those with a positive balance, sorted by size.
 *
 * Dual-path: when the indexer API is configured (NEXT_PUBLIC_API_URL set), the
 * pre-aggregated holder list is fetched from GET /assets/{contract}/holders in
 * a single request. Without the API, the fallback reads the compliance
 * allowlist on-chain and then issues one balance RPC call per address — O(n)
 * in the number of KYC-approved addresses, which can be slow for large lists.
 * See README § "Indexer API fast-path vs Soroban RPC fallback".
 */
/**
 * @param refreshKey Bump this (e.g. after a confirmed transfer) to force a
 * refetch even though `complianceId`/`tokenContract`/`network` didn't change.
 */
export function useHolders(
  complianceId: string | null,
  tokenContract: string | null,
  refreshKey = 0,
) {
  const { network } = useWallet();
  return useAsync<Holder[]>(
    async () => {
      if (!complianceId || !tokenContract) return [];

      const fromApi = tokenContract ? await api.getHolders(tokenContract) : null;
      if (fromApi) {
        return fromApi
          .filter((h) => h.balance > 0n)
          .sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
      }

      const addresses = await compliance.getAllowlist(network, complianceId);
      const holders = await Promise.all(
        addresses.map(async (address) => ({
          address,
          balance: await assetToken.balance(network, tokenContract!, address),
        })),
      );
      return holders
        .filter((h) => h.balance > 0n)
        .sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
    },
    [complianceId, tokenContract, network, refreshKey],
    Boolean(complianceId && tokenContract),
  );
}
