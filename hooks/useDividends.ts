"use client";

import { dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { Distribution } from "@/types";

export interface DistributionWithClaim extends Distribution {
  /** Amount the connected wallet can still claim from this distribution. */
  claimable: bigint;
  claimed: boolean;
}

/**
 * All distributions for an asset token, annotated with the connected wallet's
 * claimable amount and claimed status where a wallet is connected.
 */
export function useDividends(assetToken: string | null) {
  const { network, address } = useWallet();
  return useAsync<DistributionWithClaim[]>(
    async () => {
      if (!assetToken) return [];
      const dists = await dividend.getDistributionsForAsset(network, assetToken);
      if (!address) {
        return dists.map((d) => ({ ...d, claimable: 0n, claimed: false }));
      }
      const annotated = await Promise.all(
        dists.map(async (d) => {
          const [claimable, claimed] = await Promise.all([
            dividend.claimable(network, d.id, address),
            dividend.hasClaimed(network, d.id, address),
          ]);
          return { ...d, claimable, claimed };
        }),
      );
      return annotated;
    },
    [assetToken, address, network],
    Boolean(assetToken),
  );
}
