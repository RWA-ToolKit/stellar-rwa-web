# Issue 1: Lazy-load recharts in AssetStats

**Severity:** Low
**Location:** `components/asset/AssetStats.tsx`, `package.json` (recharts)

## Problem

`recharts` is a heavy dependency. Statically importing it in a component
rendered on the asset detail route inflates the client bundle for every
visitor, even before any chart is visible, delaying first paint.

## Fix

- Added `components/asset/AssetStatsChart.tsx`, a small client-only donut
  chart (recharts `PieChart`) visualizing circulating supply vs. holders.
- `AssetStats.tsx` now loads that chart via `next/dynamic` with `ssr: false`
  and a skeleton `loading` placeholder, so recharts is fetched lazily on the
  client instead of being bundled into the initial server-rendered payload.

## Result

Recharts code is now split into its own chunk and only downloaded once the
`AssetStats` component actually mounts in the browser, keeping it off the
critical path for first paint.
