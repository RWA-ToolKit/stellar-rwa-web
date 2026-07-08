"use client";

import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "@/types";

export type TypeFilter = AssetType | "all";
export type SortKey = "valuation" | "newest";

export interface FilterValue {
  type: TypeFilter;
  sort: SortKey;
}

interface AssetFilterProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** Per-type counts, used to annotate the filter chips. */
  counts?: Record<TypeFilter, number>;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Assets" },
  ...ASSET_TYPES.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t] })),
];

/** Filter assets by class and choose a sort order. */
export function AssetFilter({ value, onChange, counts }: AssetFilterProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => {
          const active = value.type === opt.value;
          const count = counts?.[opt.value];
          return (
            <button
              key={opt.value}
              onClick={() => onChange({ ...value, type: opt.value })}
              aria-pressed={active}
              className={`chip border transition-colors ${
                active
                  ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
                  : "border-white/10 bg-white/[0.03] text-base-100/60 hover:text-base-100/90"
              }`}
            >
              {opt.label}
              {count !== undefined && (
                <span className={active ? "text-brand-300/70" : "text-base-100/30"}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-base-100/50">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey })}
          className="input w-auto cursor-pointer py-2 pr-8"
        >
          <option value="valuation">Highest valuation</option>
          <option value="newest">Newest</option>
        </select>
      </label>
    </div>
  );
}
