import type { AssetEntry } from "@/types";
import { AssetCard } from "./AssetCard";

/** Responsive grid of asset cards. */
export function AssetGrid({
  assets,
  headingLevel,
}: {
  assets: AssetEntry[];
  headingLevel?: 2 | 3;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <AssetCard key={asset.id.toString()} asset={asset} headingLevel={headingLevel} />
      ))}
    </div>
  );
}
