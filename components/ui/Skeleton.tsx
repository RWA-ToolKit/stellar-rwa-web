/** Shimmering placeholder block used while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/5 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

/** A grid of card-shaped skeletons for asset listings. */
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-7 w-3/4" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-4 w-2/5" />
        </div>
      ))}
    </div>
  );
}
