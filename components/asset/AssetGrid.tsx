import type { AssetEntry } from "@/types";
import { AssetCard } from "./AssetCard";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";

interface AssetGridProps {
  assets: AssetEntry[];
  /** Render card-shaped skeletons instead of `assets` while data loads. */
  loading?: boolean;
  /** Number of skeleton cards to show while loading. */
  skeletonCount?: number;
}

/** Responsive grid of asset cards. */
export function AssetGrid({ assets, loading = false, skeletonCount = 6 }: AssetGridProps) {
  if (loading) return <CardSkeletonGrid count={skeletonCount} />;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <AssetCard key={asset.id.toString()} asset={asset} />
      ))}
    </div>
  );
}
