# Feature: API client, explore page pagination, and tx telemetry hooks

## Summary

This PR addresses three feature requests to improve the architecture and UX of the web app:

1. **API client for read-only data** — reduces N+1 RPC simulations by reading aggregate/list views from the stellar-rwa-api REST layer.
2. **Explore page pagination** — upgrades the grid's pagination to numbered page controls with ellipsis for large asset lists.
3. **Transaction telemetry hooks** — adds optional lifecycle callbacks so operators can wire up analytics/error monitoring (e.g. Sentry) around every on-chain write.

---

## Changes

### Issue #85 — API client (`lib/api.ts`) + hook integration

- **New file: `lib/api.ts`** — typed fetch client that reads from `NEXT_PUBLIC_API_URL`. Endpoints:
  - `GET /assets` (paginated), `GET /assets/:id`, `GET /assets?issuer=...`
  - `GET /stats` (pre-aggregated platform metrics)
  - `GET /assets/:tokenContract/holders`
  - All methods return `null` when the API URL is not configured, triggering graceful fallback to direct RPC reads.
- **`.env.example`** — added `NEXT_PUBLIC_API_URL` with documentation.
- **`hooks/useAssets.ts`** — `useAssets`, `usePlatformStats`, and `useIssuerAssets` now try the API first, falling back to the registry contract.
- **`hooks/useHolders.ts`** — reads aggregated holders from the API when available.
- **`hooks/useHolderTotals.ts`** — reads `totalHolders` from the API stats endpoint when available.
- **`components/home/PlatformStats.tsx`** — prefers `totalHolders` from the API stats response, only instantiates the RPC-based `useHolderTotals` hook as a fallback.

### Issue #86 — Pagination (`AssetExplorer.tsx`)

- Replaced the simple prev/next `Pagination` component with `PaginationBar`:
  - Numbered page buttons with a sliding window of up to 5 visible pages.
  - Ellipsis indicators (`…`) when the window doesn't include the first or last page.
  - Direct page-number links alongside prev/next arrows.
  - Proper `aria-label` and `aria-current` attributes for accessibility.
- The existing 9-items-per-page grid, type filter, and sort remain unchanged.

### Issue #91 — Telemetry (`useTx.ts`, `types/index.ts`)

- **`types/index.ts`** — added `TxTelemetry` interface with three optional callbacks: `onPhase`, `onSuccess`, and `onError`.
- **`hooks/useTx.ts`** — `useTx` now accepts an optional `telemetry` parameter (`TxTelemetry`):
  - `onPhase` fires on each phase transition (building → signing → submitting → confirming → success/error).
  - `onSuccess` fires with `(hash, result)` on completion.
  - `onError` fires with `(errorMessage, phase)` on failure.
  - Telemetry calls are fire-and-forget — they never block the transaction flow.
  - When no telemetry object is provided, a no-op default keeps existing consumers unchanged.

---

## Testing

- `npm run typecheck` — passes cleanly.
- No existing tests break (Jest `--passWithNoTests`).
- Manual verification: all existing UI flows (explore, asset detail, portfolio, issuer dashboard, tokenize wizard) remain unchanged when `NEXT_PUBLIC_API_URL` is not set — all hooks fall back to RPC reads.
- When `NEXT_PUBLIC_API_URL` is configured, list/aggregate views fetch from the API (faster, no RPC simulations for reads).

---

## Configuration

To enable the API client, set in your environment:

```
NEXT_PUBLIC_API_URL=https://rwa-api.example.com
```

When unset or empty, the app behaves exactly as before — all reads go through Soroban RPC.

---

closes #85
closes #86
closes #91
