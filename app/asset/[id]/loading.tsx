import { LoadingPanel } from "@/components/ui/Spinner";

/**
 * Route-level fallback for the asset detail page, shown while the page
 * shell (and its client-fetched asset data) is resolving.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <LoadingPanel label="Loading asset…" />
    </div>
  );
}
