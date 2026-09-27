"use client";

import { useEffect } from "react";
import { useHolders, type Holder } from "@/hooks/useHolders";
import { formatTokenAmount, holderSharePercentages, truncateAddress } from "@/lib/format";
import { useWallet } from "@/hooks/useWallet";
import { explorerAddressUrl } from "@/lib/stellar";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { AssetDetail } from "@/types";

interface HolderListProps {
  asset: AssetDetail;
  /** Notified with the holder count once resolved (feeds AssetStats). */
  onCount?: (count: number) => void;
  /** Bump to force a refetch (e.g. after a confirmed transfer). */
  refreshKey?: number;
}

export function HolderList({ asset, onCount, refreshKey }: HolderListProps) {
  const { metadata } = asset;
  const { address } = useWallet();
  const { data, loading, error, refetch } = useHolders(
    metadata.complianceContract,
    asset.tokenContract,
    refreshKey,
  );

  const holders = data ?? [];

  useEffect(() => {
    if (data && onCount) onCount(data.length);
  }, [data, onCount]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-base-100/55">
        <Spinner size={16} /> Loading holders…
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load holders"
        message={error}
        onRetry={refetch}
        className="py-8"
      />
    );
  }
  if (holders.length === 0) {
    return (
      <EmptyState
        title="No holders yet"
        description="Once the issuer distributes this asset to approved addresses, holders appear here."
        className="py-10"
      />
    );
  }

  const shares = holderSharePercentages(
    holders.map((holder) => holder.balance),
    metadata.totalSupply,
  );

  return (
    <ul className="divide-y divide-white/5">
      {holders.map((h, index) => (
        <HolderRow
          key={h.address}
          holder={h}
          decimals={metadata.decimals}
          symbol={metadata.symbol}
          share={shares[index] ?? "0.00"}
          isYou={h.address === address}
        />
      ))}
    </ul>
  );
}

function HolderRow({
  holder,
  decimals,
  symbol,
  share,
  isYou,
}: {
  holder: Holder;
  decimals: number;
  symbol: string;
  share: string;
  isYou: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2">
        <a
          href={explorerAddressUrl(useWallet().network ?? "testnet", holder.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-base-100/80 hover:text-brand-300"
        >
          {truncateAddress(holder.address, 6, 6)}
        </a>
        {isYou && (
          <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300">You</span>
        )}
        <CopyButton value={holder.address} />
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-base-100">
          {formatTokenAmount(holder.balance, decimals)} {symbol}
        </p>
        <p className="text-xs text-base-100/55">{share}% of supply</p>
      </div>
    </li>
  );
}
