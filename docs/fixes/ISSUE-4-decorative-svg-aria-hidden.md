# Issue 4: Decorative SVGs missing `aria-hidden`

**Severity:** Low
**Location:** `app/page.tsx` (inline SVGs in `STEPS` and hero)

## What was implemented

The purely decorative icon SVG rendered for each entry in the "How it works"
`STEPS` list (`app/page.tsx`) is now marked:

```tsx
<svg
  ...
  aria-hidden="true"
  focusable="false"
>
```

- `aria-hidden="true"` removes the icon from the accessibility tree so screen
  readers skip it — the adjacent step title/body text already conveys the
  same information.
- `focusable="false"` prevents legacy IE/Edge behavior where an `<svg>` with
  no explicit `tabindex` can still receive keyboard focus.

The decorative status dot in the hero chip ("Compliant RWA tokenization on
Stellar") was also given `aria-hidden="true"` for the same reason — it's a
purely visual bullet with no semantic meaning of its own.

## Why this is scoped to `app/page.tsx`

The audit finding calls out `app/page.tsx` specifically. The rest of the
codebase has many other inline SVGs (buttons, badges, panel icons); most of
those are either meaningful (interactive, e.g. inside a `<button>`) or already
paired with visible/adjacent text. A broader accessibility pass across every
icon in the app is a larger effort and out of scope for this low-severity,
page-scoped finding — flagged here as a follow-up if the team wants it.

## Follow-up (not done here)

- Audit remaining purely-decorative icons across `components/**` for the same
  `aria-hidden`/`focusable` treatment (e.g. `components/asset/AssetTypeBadge.tsx`,
  `components/layout/SiteHeader.tsx`, panel header icons).
