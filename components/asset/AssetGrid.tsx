import type { AssetEntry } from "@/types";
import { AssetCard } from "./AssetCard";

const MAX_VISIBLE_PAGES = 5;

interface AssetGridProps {
  assets: AssetEntry[];
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function AssetGrid({
  assets,
  page,
  totalPages,
  total,
  onPageChange,
}: AssetGridProps) {
  const showPagination =
    Boolean(page && totalPages && totalPages > 1 && onPageChange);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <AssetCard key={asset.id.toString()} asset={asset} />
        ))}
      </div>

      {showPagination && onPageChange && page && totalPages && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total ?? assets.length}
          onChange={onPageChange}
        />
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const half = Math.floor(MAX_VISIBLE_PAGES / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
  if (end - start + 1 < MAX_VISIBLE_PAGES) {
    start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
  }
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-5">
      <p className="text-sm text-base-100/40" aria-live="polite">
        Page {page} of {totalPages} · {total} asset{total === 1 ? "" : "s"}
      </p>
      <nav
        className="flex items-center gap-1"
        aria-label="Pagination"
      >
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          ←
        </button>

        {pages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onChange(1)}
              className="btn-secondary px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Page 1"
            >
              1
            </button>
            {pages[0] > 2 && (
              <span className="px-1 text-sm text-base-100/30" aria-hidden="true">
                …
              </span>
            )}
          </>
        )}

        {pages.map((p) => {
          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isCurrent
                  ? "bg-brand-500/20 text-brand-300 font-semibold"
                  : "text-base-100/60 hover:text-base-100/90 btn-secondary"
              }`}
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`Page ${p}`}
            >
              {p}
            </button>
          );
        })}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-sm text-base-100/30" aria-hidden="true">
                …
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(totalPages)}
              className="btn-secondary px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={`Page ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          →
        </button>
      </nav>
    </div>
  );
}