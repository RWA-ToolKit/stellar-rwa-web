"use client";

import { getHolders as apiGetHolders, withFallback } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";

export interface Holder {
  address: string;
  balance: bigint;
}

/**
 * An asset's holders. Sourced from the stellar-rwa-api's
 * `index_compliance_and_holders` job, which is the single source of truth
 * for "holder" = allowlist ∩ positive balance (sorted by balance
 * descending) — the web app no longer derives this independently, so the
 * two can't drift on sorting or edge cases.
 *
 * Only if the API is unavailable do we fall back to deriving holders
 * directly: read the compliance allowlist (the only addresses that *can*
 * hold the asset) and keep those with a positive balance.
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
      return withFallback(
        () => apiGetHolders(network, tokenContract),
        async () => {
          const { compliance, assetToken } = await import("@/lib/contracts");
          const addresses = await compliance.getAllowlist(network, complianceId);
          const holders = await Promise.all(
            addresses.map(async (address) => ({
              address,
              balance: await assetToken.balance(network, tokenContract, address),
            })),
          );
          return holders
            .filter((h) => h.balance > 0n)
            .sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
        },
      );
    },
    [complianceId, tokenContract, network, refreshKey],
    Boolean(complianceId && tokenContract),
  );
}
