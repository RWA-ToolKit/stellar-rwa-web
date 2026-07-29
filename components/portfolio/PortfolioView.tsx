"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { HoldingRow } from "@/components/portfolio/HoldingRow";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { truncateAddress } from "@/lib/format";

function HoldingsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-7 w-28 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The full portfolio UI — requires a connected wallet. */
export function PortfolioView() {
  const { address } = useWallet();
  const { data, loading, error, refetch } = usePortfolio();

  // Passed to HoldingRow so a successful claim triggers a re-fetch
  const handleClaimed = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
            <path d="M6 7V5a2 2 0 0 1 4 0v2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/50">
            Your holdings and claimable dividends appear here once you connect a
            Freighter wallet.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <HoldingsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load portfolio"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.holdings.length === 0) {
    return (
      <EmptyState
        title="No holdings yet"
        description="You don't hold any tokenized assets on this network. Browse the explore page to discover available assets."
        icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3h18v18H3z" rx="2" />
            <path d="M3 9h18M9 21V9" strokeLinecap="round" />
          </svg>
        }
        action={
          <Link href="/explore" className="btn-primary">
            Explore assets
          </Link>
        }
      />
    );
  }

  // Separate holdings with and without claimable dividends for section ordering
  const withClaimable = data.holdings.filter((h) => h.totalClaimable > 0n);
  const withoutClaimable = data.holdings.filter((h) => h.totalClaimable === 0n);
  const ordered = [...withClaimable, ...withoutClaimable];

  return (
    <div className="space-y-8">
      <PortfolioSummary data={data} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-base-100">Your Holdings</h2>
          <p className="text-sm text-base-100/40">
            Connected as{" "}
            <span className="font-mono text-base-100/60">{truncateAddress(address)}</span>
          </p>
        </div>

        {withClaimable.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-300">
              {withClaimable.length}
            </span>
            <p className="text-xs text-brand-300/80 font-medium">
              {withClaimable.length === 1 ? "asset has" : "assets have"} claimable dividends
            </p>
          </div>
        )}

        <div className="space-y-4">
          {ordered.map((holding) => (
            <HoldingRow
              key={holding.asset.id.toString()}
              holding={holding}
              onClaimed={handleClaimed}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
