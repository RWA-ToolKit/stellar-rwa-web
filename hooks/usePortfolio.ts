"use client";

import { assetToken, dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, AssetMetadata, Distribution } from "@/types";
import type { DistributionWithClaim } from "@/hooks/useDividends";

export interface Holding {
  asset: AssetEntry;
  metadata: AssetMetadata;
  balance: bigint;
  /** Distributions for this asset that the connected wallet can still claim. */
  claimableDistributions: DistributionWithClaim[];
  /** Sum of all claimable amounts across distributions for this asset. */
  totalClaimable: bigint;
}

export interface PortfolioData {
  holdings: Holding[];
  /** Total estimated USD value across holdings (valuation × share of supply). */
  totalValueCents: bigint;
  /** Sum of all claimable dividend amounts across all assets. */
  totalClaimable: bigint;
}

/**
 * Aggregates the connected wallet's token balances and claimable dividends
 * across all registered assets. Returns only assets where balance > 0.
 */
export function usePortfolio() {
  const { network, address } = useWallet();

  return useAsync<PortfolioData>(
    async () => {
      if (!address) {
        return { holdings: [], totalValueCents: 0n, totalClaimable: 0n };
      }

      // 1. Fetch all assets from registry (already filtered to active by registry contract)
      const { registry } = await import("@/lib/contracts");
      const allAssets = await registry.getAllAssets(network);

      if (allAssets.length === 0) {
        return { holdings: [], totalValueCents: 0n, totalClaimable: 0n };
      }

      // 2. For each asset, fetch balance + metadata in parallel
      const enriched = await Promise.all(
        allAssets.map(async (asset) => {
          const [balance, metadata] = await Promise.all([
            assetToken.balance(network, asset.tokenContract, address),
            assetToken.getMetadata(network, asset.tokenContract),
          ]);
          return { asset, metadata, balance };
        }),
      );

      // 3. Filter down to assets the wallet actually holds
      const held = enriched.filter(({ balance }) => balance > 0n);

      if (held.length === 0) {
        return { holdings: [], totalValueCents: 0n, totalClaimable: 0n };
      }

      // 4. For held assets, fetch distributions and annotate with claimable
      const holdings: Holding[] = await Promise.all(
        held.map(async ({ asset, metadata, balance }) => {
          let distributions: Distribution[] = [];
          try {
            distributions = await dividend.getDistributionsForAsset(network, asset.tokenContract);
          } catch {
            // dividend contract may not have any distributions yet
          }

          const claimableDistributions: DistributionWithClaim[] = await Promise.all(
            distributions.map(async (d) => {
              const [claimable, claimed] = await Promise.all([
                dividend.claimable(network, d.id, address),
                dividend.hasClaimed(network, d.id, address),
              ]);
              return { ...d, claimable, claimed };
            }),
          );

          const totalClaimable = claimableDistributions.reduce(
            (sum, d) => sum + (d.claimed ? 0n : d.claimable),
            0n,
          );

          return { asset, metadata, balance, claimableDistributions, totalClaimable };
        }),
      );

      // 5. Compute portfolio-level totals
      const totalValueCents = holdings.reduce((sum, { asset, metadata, balance }) => {
        if (metadata.totalSupply === 0n) return sum;
        // proportional share: valuation × (balance / totalSupply)
        // use integer math: (valuation * balance) / totalSupply
        return sum + (asset.valuation * balance) / metadata.totalSupply;
      }, 0n);

      const totalClaimable = holdings.reduce(
        (sum, h) => sum + h.totalClaimable,
        0n,
      );

      return { holdings, totalValueCents, totalClaimable };
    },
    [address, network],
    Boolean(address),
  );
}
