import type { AssetType } from "@/types";
import { assetTypeLabel } from "@/lib/format";

interface Style {
  bg: string;
  text: string;
  icon: JSX.Element;
}

const STYLES: Record<AssetType, Style> = {
  real_estate: {
    bg: "bg-sky-500/10 border-sky-500/20",
    text: "text-sky-300",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  invoice: {
    bg: "bg-violet-500/10 border-violet-500/20",
    text: "text-violet-300",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    ),
  },
  commodity: {
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-300",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m12 2 3 6 6 .5-4.5 4 1.5 6-6-3.2L6 19l1.5-6L3 8.5 9 8l3-6Z" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const FALLBACK: Style = {
  bg: "bg-white/5 border-white/10",
  text: "text-base-100/60",
  icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

/** Colour-coded badge for an asset's class. */
export function AssetTypeBadge({ type, className = "" }: { type: string; className?: string }) {
  const style = STYLES[type as AssetType] ?? FALLBACK;
  return (
    <span className={`chip border ${style.bg} ${style.text} ${className}`}>
      {style.icon}
      {assetTypeLabel(type)}
    </span>
  );
}
