import { CardSkeletonGrid } from "@/components/ui/Skeleton";

/**
 * Route-level fallback shown by Next.js while a page (and its client data)
 * is resolving, so navigation never shows a blank frame.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <CardSkeletonGrid count={6} />
    </div>
  );
}
