"use client";

import { compliance, assetToken } from "@/lib/contracts";
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
 */
export function useHolders(complianceId: string | null, tokenContract: string | null) {
  const { network } = useWallet();
  return useAsync<Holder[]>(
    async () => {
      if (!complianceId || !tokenContract) return [];
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
    [complianceId, tokenContract, network],
    Boolean(complianceId && tokenContract),
  );
}
