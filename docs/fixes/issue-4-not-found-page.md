# Issue 4: Add a branded 404 page

**Location:** `app/` (no `not-found.tsx`)

## Problem

Visiting any unknown path (including missing routes like stray segments
under `/issuer` or `/asset`) showed the default Next.js 404 page, with no
branding and no way back into the app.

## Fix

Added `app/not-found.tsx`. Next.js automatically renders this for any route
that doesn't match a page, replacing the default 404 screen. It follows the
same visual language as the existing `app/error.tsx` boundary (icon, title,
message, action buttons) and links back to `/explore` and `/`.

## Result

Unmatched routes now show a branded, on-theme 404 page that points users
back to Explore instead of a generic framework default.
