"use client";

import { useEffect } from "react";
import { useHolders, type Holder } from "@/hooks/useHolders";
import { formatTokenAmount, percent, truncateAddress } from "@/lib/format";
import { useWallet } from "@/hooks/useWallet";
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
      <div className="flex items-center gap-2 py-6 text-sm text-base-100/40">
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

  // Address / balance / share is genuinely tabular data, so a real table gives
  // assistive tech column headers instead of a bare list of rows.
  return (
    <table className="w-full text-left">
      <caption className="sr-only">Token holders with balance and share of supply</caption>
      <thead>
        <tr className="border-b border-white/5 text-xs uppercase tracking-wide text-base-100/40">
          <th scope="col" className="py-2 pr-3 font-medium">Address</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Balance</th>
          <th scope="col" className="py-2 text-right font-medium">Share of supply</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {holders.map((h) => (
          <HolderRow
            key={h.address}
            holder={h}
            decimals={metadata.decimals}
            symbol={metadata.symbol}
            supply={metadata.totalSupply}
            isYou={h.address === address}
          />
        ))}
      </tbody>
    </table>
  );
}

function HolderRow({
  holder,
  decimals,
  symbol,
  supply,
  isYou,
}: {
  holder: Holder;
  decimals: number;
  symbol: string;
  supply: bigint;
  isYou: boolean;
}) {
  const share = percent(holder.balance, supply);
  return (
    <tr>
      <th scope="row" className="py-3 pr-3 text-left font-normal">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-base-100/80">
            {truncateAddress(holder.address, 6, 6)}
          </span>
          {isYou && (
            <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300">You</span>
          )}
          <CopyButton value={holder.address} />
        </div>
      </th>
      <td className="py-3 pr-3 text-right text-sm font-semibold text-base-100">
        {formatTokenAmount(holder.balance, decimals)} {symbol}
      </td>
      <td className="py-3 text-right text-xs text-base-100/40">{share.toFixed(2)}%</td>
    </tr>
  );
}
