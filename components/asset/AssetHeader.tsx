import type { AssetDetail } from "@/types";
import { formatUsdCents, truncateAddress } from "@/lib/format";
import { explorerContractUrl } from "@/lib/stellar";
import { AssetTypeBadge } from "./AssetTypeBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import type { Network } from "@/types";

interface AssetHeaderProps {
  asset: AssetDetail;
  network: Network;
}

/** Hero for the asset detail page: name, class, symbol and headline valuation. */
export function AssetHeader({ asset, network }: AssetHeaderProps) {
  const { metadata } = asset;
  return (
    <header className="card overflow-hidden">
      <div className="relative border-b border-white/5 bg-gradient-to-br from-brand-500/[0.07] via-transparent to-gold-500/[0.05] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <AssetTypeBadge type={asset.assetType} />
          <span className="chip border border-white/10 bg-white/5 font-mono text-base-100/70">
            {metadata.symbol}
          </span>
          {metadata.paused && (
            <span className="chip border border-amber-500/30 bg-amber-500/10 text-amber-300">
              Paused
            </span>
          )}
          {!asset.active && (
            <span className="chip border border-white/10 bg-white/5 text-base-100/40">
              Delisted
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-base-100 sm:text-4xl">
          {asset.name}
        </h1>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-base-100/40">Valuation</p>
            <p className="mt-1 text-2xl font-bold text-gold-300 sm:text-3xl">
              {formatUsdCents(metadata.valuation)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-base-100/40">Asset ID</p>
            <p className="mt-1 text-lg font-semibold text-base-100">#{asset.id.toString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 text-xs text-base-100/50 sm:px-8">
        <span className="flex items-center gap-1.5">
          Token
          <a
            href={explorerContractUrl(network, asset.tokenContract)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-base-100/70 hover:text-brand-300"
          >
            {truncateAddress(asset.tokenContract, 6, 6)}
          </a>
          <CopyButton value={asset.tokenContract} />
        </span>
        <span className="flex items-center gap-1.5">
          Issuer
          <span className="font-mono text-base-100/70">{truncateAddress(asset.issuer, 6, 6)}</span>
          <CopyButton value={asset.issuer} />
        </span>
      </div>
    </header>
  );
}
