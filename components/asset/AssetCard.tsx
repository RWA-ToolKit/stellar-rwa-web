import Link from "next/link";
import type { AssetEntry } from "@/types";
import { formatUsdCents, truncateAddress } from "@/lib/format";
import { AssetTypeBadge } from "./AssetTypeBadge";

interface AssetCardProps {
  asset: AssetEntry;
  /** Optional holder count when known (registry doesn't track it directly). */
  holders?: number;
  /** Optional total supply string when metadata has been loaded. */
  supply?: string;
}

/** Summary card linking to an asset's detail page. */
export function AssetCard({ asset, holders, supply }: AssetCardProps) {
  return (
    <Link
      href={`/asset/${asset.id}`}
      className="card card-hover group flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <AssetTypeBadge type={asset.assetType} />
        {!asset.active && (
          <span className="chip bg-white/5 text-base-100/40">Inactive</span>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold leading-tight text-base-100 transition-colors group-hover:text-brand-300">
          {asset.name}
        </h3>
        <p className="mt-0.5 text-xs text-base-100/40">Asset #{asset.id.toString()}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-base-100/40">Valuation</dt>
          <dd className="mt-0.5 text-base font-semibold text-gold-300">
            {formatUsdCents(asset.valuation, { compact: true })}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-base-100/40">
            {supply ? "Supply" : "Holders"}
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-base-100">
            {supply ?? (holders !== undefined ? holders.toLocaleString() : "—")}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3 text-xs text-base-100/40">
        <span>Issuer</span>
        <span className="font-mono text-base-100/60">{truncateAddress(asset.issuer)}</span>
      </div>
    </Link>
  );
}
