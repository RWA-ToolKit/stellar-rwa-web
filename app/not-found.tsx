import Link from "next/link";

export const metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist.",
};

/**
 * Branded 404 page, shown for any unmatched route (including paths like
 * /issuer/*, /asset/* segments that don't resolve) instead of the default
 * Next.js not-found screen.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-base-100">Page not found</h1>
      <p className="max-w-md text-sm text-base-100/60">
        We couldn&apos;t find the page you&apos;re looking for. It may have
        moved, or the address might be off — try exploring the tokenized
        assets currently available instead.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Link href="/explore" className="btn-primary">
          Explore assets
        </Link>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </div>
  );
}
