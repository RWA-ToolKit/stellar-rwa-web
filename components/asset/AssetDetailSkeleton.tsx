import { Skeleton } from "@/components/ui/Skeleton";

export function AssetDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link skeleton */}
      <Skeleton className="mb-5 h-4 w-24" />

      {/* Header skeleton */}
      <div className="card overflow-hidden">
        <div className="border-b border-white/5 bg-gradient-to-br from-brand-500/[0.07] via-transparent to-gold-500/[0.05] p-6 sm:p-8">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-10 w-3/4" />
            <div className="flex flex-wrap gap-8 pt-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 px-6 py-3 sm:px-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Compliance notice skeleton */}
      <div className="mt-5 rounded-2xl border border-brand-500/15 bg-brand-500/[0.04] px-4 py-3.5">
        <Skeleton className="h-12 w-full" />
      </div>

      {/* Main content grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-8 lg:col-span-2">
          {/* About section */}
          <div className="card space-y-4 p-6">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Dividend section */}
          <div className="card space-y-4 p-6">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          {/* Holders section */}
          <div className="card space-y-4 p-6">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-3 divide-y divide-white/5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Overview card */}
          <div className="card space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Compliance card */}
          <div className="card space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Transfer card */}
          <div className="card space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
