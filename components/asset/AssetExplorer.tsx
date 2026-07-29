"use client";

import { useMemo, useState, useCallback } from "react";
import { useAssets } from "@/hooks/useAssets";
import { AssetGrid } from "./AssetGrid";
import {
  AssetFilter,
  type FilterValue,
  type TypeFilter,
} from "./AssetFilter";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ASSET_TYPES } from "@/types";

const PAGE_SIZE = 9;
const MAX_VISIBLE_PAGES = 5;

/**
 * Client island powering /explore: loads all registered assets, applies the
 * type filter and sort, and paginates the results with numbered page controls.
 */
export function AssetExplorer() {
  const { assets, loading, error, refetch } = useAssets();
  const [filter, setFilter] = useState<FilterValue>({ type: "all", sort: "valuation" });
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = {
      all: assets.length,
      real_estate: 0,
      invoice: 0,
      commodity: 0,
    };
    for (const a of assets) {
      if (ASSET_TYPES.includes(a.assetType as (typeof ASSET_TYPES)[number])) {
        c[a.assetType as TypeFilter] += 1;
      }
    }
    return c;
  }, [assets]);

  const filtered = useMemo(() => {
    let list = assets;
    if (filter.type !== "all") {
      list = list.filter((a) => a.assetType === filter.type);
    }
    const sorted = [...list].sort((a, b) => {
      if (filter.sort === "valuation") {
        return a.valuation > b.valuation ? -1 : a.valuation < b.valuation ? 1 : 0;
      }
      return b.createdAt - a.createdAt;
    });
    return sorted;
  }, [assets, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateFilter = useCallback((next: FilterValue) => {
    setFilter(next);
    setPage(1);
  }, []);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  return (
    <div className="space-y-8">
      <AssetFilter value={filter} onChange={updateFilter} counts={counts} />

      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter.type === "all" ? "No assets tokenized yet" : "No assets of this type"}
          description={
            filter.type === "all"
              ? "Be the first to bring a real-world asset on-chain."
              : "Try a different asset class or clear the filter."
          }
        />
      ) : (
        <>
          <AssetGrid assets={visible} />
          {totalPages > 1 && (
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              onChange={goToPage}
              total={filtered.length}
            />
          )}
        </>
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onChange,
  total,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  total: number;
}) {
  const pages = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    if (end - start + 1 < MAX_VISIBLE_PAGES) {
      start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between border-t border-white/5 pt-5">
      <p className="text-sm text-base-100/40">
        Page {page} of {totalPages} · {total} asset{total === 1 ? "" : "s"}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary px-3 py-2 text-sm"
          aria-label="Previous page"
        >
          ←
        </button>
        {pages[0] > 1 && (
          <>
            <button onClick={() => onChange(1)} className="btn-secondary px-3 py-2 text-sm">
              1
            </button>
            {pages[0] > 2 && (
              <span className="px-1 text-sm text-base-100/30">…</span>
            )}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              p === page
                ? "bg-brand-500/20 text-brand-300"
                : "text-base-100/60 hover:text-base-100/90 btn-secondary"
            }`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-sm text-base-100/30">…</span>
            )}
            <button onClick={() => onChange(totalPages)} className="btn-secondary px-3 py-2 text-sm">
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary px-3 py-2 text-sm"
          aria-label="Next page"
        >
          →
        </button>
      </nav>
    </div>
  );
}
