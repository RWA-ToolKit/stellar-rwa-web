"use client";

import Link from "next/link";
import { useState } from "react";
import { useAsset, useBalance } from "@/hooks/useAsset";
import { useDividends } from "@/hooks/useDividends";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import { getLatestLedger } from "@/lib/stellar";
import { AssetHeader } from "./AssetHeader";
import { AssetStats } from "./AssetStats";
import { TransferPanel } from "./TransferPanel";
import { HolderList } from "./HolderList";
import { DistributionCard } from "@/components/dividend/DistributionCard";
import { LoadingPanel } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

export function AssetDetailView({ id }: { id: bigint }) {
  const { network } = useWallet();
  const asset = useAsset(id);
  const balance = useBalance(asset.data?.tokenContract ?? null);
  const dividends = useDividends(asset.data?.tokenContract ?? null);
  const ledger = useAsync(() => getLatestLedger(network), [network]);
  const [holderCount, setHolderCount] = useState<number | undefined>(undefined);

  if (asset.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <LoadingPanel label="Loading asset…" />
      </div>
    );
  }
  if (asset.error || !asset.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <ErrorState
          title="Asset not found"
          message={asset.error ?? `No registered asset with id ${id.toString()}.`}
          onRetry={asset.refetch}
        />
        <div className="mt-6 text-center">
          <Link href="/explore" className="btn-secondary">← Back to Explore</Link>
        </div>
      </div>
    );
  }

  const detail = asset.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/explore" className="mb-5 inline-flex items-center gap-1.5 text-sm text-base-100/50 hover:text-base-100">
        ← Explore
      </Link>

      <AssetHeader asset={detail} network={network} />

      {/* Compliance notice — always visible; these are gated assets. */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-500/15 bg-brand-500/[0.04] px-4 py-3.5 text-sm text-base-100/70">
        <svg className="mt-0.5 shrink-0 text-brand-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>
          This is a <strong className="font-semibold text-base-100">compliance-gated asset</strong>.
          Only KYC-approved addresses can hold or transfer it — every transfer is
          checked on-chain against the compliance contract.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: description, dividends, holders */}
        <div className="space-y-8 lg:col-span-2">
          <section className="card p-6">
            <h2 className="text-lg font-semibold text-base-100">About this asset</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-base-100/70">
              {detail.metadata.assetDescription?.trim()
                ? detail.metadata.assetDescription
                : "The issuer hasn't provided a description for this asset."}
            </p>
          </section>

          <section className="card p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-base-100">Dividend history</h2>
              {dividends.data && dividends.data.length > 0 && (
                <span className="text-sm text-base-100/40">
                  {dividends.data.length} distribution{dividends.data.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {dividends.loading ? (
              <LoadingPanel label="Loading distributions…" />
            ) : dividends.error ? (
              <ErrorState message={dividends.error} onRetry={dividends.refetch} />
            ) : !dividends.data || dividends.data.length === 0 ? (
              <EmptyState
                title="No distributions yet"
                description="When the issuer distributes yield, past and active distributions show up here with your claimable share."
                className="py-10"
              />
            ) : (
              <div className="space-y-4">
                {dividends.data.map((d) => (
                  <DistributionCard
                    key={d.id.toString()}
                    distribution={d}
                    currentLedger={ledger.data ?? null}
                    onClaimed={() => {
                      dividends.refetch();
                      balance.refetch();
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-1 text-lg font-semibold text-base-100">Holders</h2>
            <HolderList asset={detail} onCount={setHolderCount} />
          </section>
        </div>

        {/* Right: stats sidebar + transfer */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-100/50">
              Overview
            </h2>
            <AssetStats asset={detail} holders={holderCount} />
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-100/50">
              Your position
            </h2>
            <TransferPanel
              asset={detail}
              balance={balance.data ?? 0n}
              onTransferred={() => {
                balance.refetch();
                dividends.refetch();
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
