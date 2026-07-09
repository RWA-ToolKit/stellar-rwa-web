"use client";

import { usePlatformStats } from "@/hooks/useAssets";
import { useHolderTotals } from "@/hooks/useHolderTotals";
import { formatUsdCents, compactNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";

/** Headline platform metrics sourced live from the registry contract. */
export function PlatformStats() {
  const stats = usePlatformStats();
  const holders = useHolderTotals(stats.data?.assets ?? null);

  const items = [
    {
      label: "Assets tokenized",
      value: stats.data ? stats.data.totalAssets.toLocaleString() : null,
    },
    {
      label: "Total value locked",
      value: stats.data ? formatUsdCents(stats.data.tvl, { compact: true }) : null,
    },
    {
      label: "Approved holders",
      value: holders.data !== null && holders.data !== undefined ? compactNumber(holders.data) : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="card p-6 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-base-100/40">
            {item.label}
          </p>
          {stats.error ? (
            <p className="mt-2 text-2xl font-bold text-base-100/30">—</p>
          ) : item.value === null ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-base-100">{item.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
