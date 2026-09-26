"use client";

import { assetToken as tokenContract, dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { Distribution } from "@/types";

export interface DistributionWithClaim extends Distribution {
  /** Amount the connected wallet can still claim from this distribution. */
  claimable: bigint;
  claimed: boolean;
  /** Decimal scale reported by this distribution's payment token. */
  paymentTokenDecimals: number;
}

/**
 * All distributions for an asset token, annotated with the connected wallet's
 * claimable amount and claimed status where a wallet is connected.
 *
 * Callers should invoke the returned `refetch` after a successful claim
 * (see ClaimButton's `onClaimed`) so a distribution's row flips to
 * "claimed" without requiring a manual page refresh.
 */
export function useDividends(assetTokenId: string | null) {
  const { network, address } = useWallet();
  return useAsync<DistributionWithClaim[]>(
    async () => {
      if (!assetTokenId) return [];
      const dists = await dividend.getDistributionsForAsset(network, assetTokenId);
      const annotated = await Promise.all(
        dists.map(async (d) => {
          const paymentTokenDecimals = await tokenContract.decimals(network, d.paymentToken);
          if (!address) {
            return { ...d, paymentTokenDecimals, claimable: 0n, claimed: false };
          }
          const [claimable, claimed] = await Promise.all([
            dividend.claimable(network, d.id, address),
            dividend.hasClaimed(network, d.id, address),
          ]);
          return { ...d, paymentTokenDecimals, claimable, claimed };
        }),
      );
      return annotated;
    },
    [assetTokenId, address, network],
    Boolean(assetTokenId),
  );
}
