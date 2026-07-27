"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useAsset } from "@/hooks/useAsset";
import { IssuerAssetSelector } from "@/components/issuer/IssuerAssetSelector";
import { TokenPanel } from "@/components/issuer/panels/TokenPanel";
import { CompliancePanel } from "@/components/issuer/panels/CompliancePanel";
import { DistributionPanel } from "@/components/issuer/panels/DistributionPanel";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { AssetTypeBadge } from "@/components/asset/AssetTypeBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatUsdCents } from "@/lib/format";
import type { AssetEntry } from "@/types";

type Tab = "token" | "compliance" | "distributions";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "token",
    label: "Token",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "distributions",
    label: "Distributions",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function IssuerDashboard() {
  const { address } = useWallet();
  const [selectedAsset, setSelectedAsset] = useState<AssetEntry | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("token");

  // Reload the full asset detail (including metadata like paused status) on
  // demand after mutating actions.
  const assetDetail = useAsset(selectedAsset?.id ?? null);

  const handleAssetSelect = useCallback((asset: AssetEntry) => {
    setSelectedAsset(asset);
    setActiveTab("token");
  }, []);

  const handleMutated = useCallback(() => {
    assetDetail.refetch();
  }, [assetDetail]);

  // Wallet gate
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/50">
            Connect the wallet used to register your assets. Only the asset admin
            can access issuer controls.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Left sidebar: asset selector */}
      <aside className="lg:col-span-1">
        <div className="card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-100/40">
            Your assets
          </h2>
          <IssuerAssetSelector
            selected={selectedAsset}
            onSelect={handleAssetSelect}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:col-span-3">
        {!selectedAsset ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 text-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-base-100/20"
            >
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm text-base-100/40">Select an asset to manage</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Asset context header */}
            <AssetContextBar
              asset={selectedAsset}
              loading={assetDetail.loading}
              paused={assetDetail.data?.metadata.paused}
              error={assetDetail.error}
            />

            {/* Tab bar */}
            <div className="flex gap-1 rounded-2xl border border-white/5 bg-white/[0.02] p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-white/10 text-base-100"
                      : "text-base-100/50 hover:text-base-100"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Panel content */}
            {assetDetail.loading ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="card p-5 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : assetDetail.error ? (
              <ErrorState
                message={assetDetail.error}
                onRetry={assetDetail.refetch}
              />
            ) : assetDetail.data ? (
              <>
                {activeTab === "token" && (
                  <TokenPanel
                    asset={assetDetail.data}
                    onMinted={handleMutated}
                    onPauseToggled={handleMutated}
                  />
                )}
                {activeTab === "compliance" && (
                  <CompliancePanel
                    asset={assetDetail.data}
                    onChanged={handleMutated}
                  />
                )}
                {activeTab === "distributions" && (
                  <DistributionPanel
                    asset={assetDetail.data}
                    onCreated={handleMutated}
                  />
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Compact bar showing the currently managed asset ----

function AssetContextBar({
  asset,
  loading,
  paused,
  error,
}: {
  asset: AssetEntry;
  loading: boolean;
  paused?: boolean;
  error?: string | null;
}) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <AssetTypeBadge type={asset.assetType} />
        {loading ? (
          <Skeleton className="h-4 w-16" />
        ) : paused ? (
          <span className="chip border border-amber-500/30 bg-amber-500/10 text-amber-300">
            Paused
          </span>
        ) : null}
        <span className="text-base font-semibold text-base-100">{asset.name}</span>
        <span className="text-sm text-base-100/40">#{asset.id.toString()}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gold-300">
          {formatUsdCents(asset.valuation, { compact: true })}
        </p>
        {error && <p className="text-[11px] text-red-400/80">Metadata unavailable</p>}
      </div>
    </div>
  );
}
