import dynamic from "next/dynamic";
import type { AssetDetail } from "@/types";
import { formatTokenAmount, formatUsdCents } from "@/lib/format";

interface AssetStatsProps {
  asset: AssetDetail;
  /** Number of distinct holders, when computed from on-chain balances. */
  holders?: number;
}

// recharts is a heavy dependency; loading it lazily and client-side only
// keeps it out of the initial bundle for routes that render AssetStats.
const AssetStatsChart = dynamic(
  () => import("./AssetStatsChart").then((m) => m.AssetStatsChart),
  {
    ssr: false,
    loading: () => <div className="h-40 w-full animate-pulse rounded-xl bg-white/5" />,
  },
);

/** Compact numeric summary of an asset: supply, decimals, valuation, holders. */
export function AssetStats({ asset, holders }: AssetStatsProps) {
  const { metadata } = asset;
  const rows: { label: string; value: string }[] = [
    {
      label: "Total supply",
      value: `${formatTokenAmount(metadata.totalSupply, metadata.decimals)} ${metadata.symbol}`,
    },
    { label: "Decimals", value: String(metadata.decimals) },
    { label: "Valuation", value: formatUsdCents(metadata.valuation) },
  ];
  if (holders !== undefined) {
    rows.push({ label: "Holders", value: holders.toLocaleString() });
  }

  return (
    <div>
      <AssetStatsChart asset={asset} holders={holders} />
      <dl className="divide-y divide-white/5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2.5">
            <dt className="text-sm text-base-100/50">{r.label}</dt>
            <dd className="text-sm font-semibold text-base-100">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
