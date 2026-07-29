# Issue 2: Avoid passing `bigint` across the RSC serialization boundary

**Severity:** Medium
**Location:** `app/asset/[id]/page.tsx`, `components/asset/AssetDetailView.tsx`

## Problem

`AssetPage` is a server component that parsed `params.id` into a `bigint`
and passed it directly as a prop to the client component
`AssetDetailView`. Passing `bigint` across the RSC serialization boundary
is fragile — historically unsupported and version-dependent in Next.js —
and can throw a serialization error at runtime.

## Fix

- `app/asset/[id]/page.tsx` still validates the id server-side with
  `parseId`, but now passes `id.toString()` to `AssetDetailView` instead of
  the raw `bigint`.
- `AssetDetailView` now accepts `id: string` and converts it to `bigint`
  internally with `BigInt(idProp)` before using it, so nothing downstream
  changed except where the conversion happens.

## Result

Only serializable primitives (strings) cross the server/client component
boundary; the `bigint` conversion now happens entirely on the client.
