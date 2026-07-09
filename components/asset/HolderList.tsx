"use client";

import { useEffect } from "react";
import { useHolders, type Holder } from "@/hooks/useHolders";
import { formatTokenAmount, percent, truncateAddress } from "@/lib/format";
import { useWallet } from "@/hooks/useWallet";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AssetDetail } from "@/types";

interface HolderListProps {
  asset: AssetDetail;
  /** Notified with the holder count once resolved (feeds AssetStats). */
  onCount?: (count: number) => void;
}

export function HolderList({ asset, onCount }: HolderListProps) {
  const { metadata } = asset;
  const { address } = useWallet();
  const { data, loading, error } = useHolders(metadata.complianceContract, asset.tokenContract);

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
    return <p className="py-4 text-sm text-red-400/80">Couldn&apos;t load holders.</p>;
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

  return (
    <ul className="divide-y divide-white/5">
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
    </ul>
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
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-base-100/80">
          {truncateAddress(holder.address, 6, 6)}
        </span>
        {isYou && (
          <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300">You</span>
        )}
        <CopyButton value={holder.address} />
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-base-100">
          {formatTokenAmount(holder.balance, decimals)} {symbol}
        </p>
        <p className="text-xs text-base-100/40">{share.toFixed(2)}% of supply</p>
      </div>
    </li>
  );
}
