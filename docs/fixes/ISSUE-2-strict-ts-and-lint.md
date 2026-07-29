# Issue 2: Missing strict TS flags / floating-promise lint rule

**Severity:** Low
**Location:** `tsconfig.json`, ESLint config (`eslint-config-next`)

## What was implemented

### `tsconfig.json`

`strict: true` was already on. Added the additional strictness flags called
out by the finding (index-access and switch/override footguns):

- `noUncheckedIndexedAccess` — `arr[i]` and `record[key]` are typed as
  `T | undefined` instead of `T`, so callers have to handle the missing
  case explicitly. This is the direct fix for the "index-access footguns"
  the finding references.
- `noImplicitOverride` — subclass methods that override a base method must
  say `override` explicitly.
- `noFallthroughCasesInSwitch` — non-empty `switch` cases must `break`/
  `return`/`throw`.
- `forceConsistentCasingInFileNames` — import specifiers must match a
  file's on-disk casing (matters across case-insensitive/case-sensitive
  filesystems, e.g. local macOS dev vs. Linux CI).

### ESLint (`.eslintrc.json`, new file — none existed before)

The repo had no ESLint config file at all; `next lint` was relying on
implicit defaults. Added:

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "rules": {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error"
  }
}
```

`@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` were
added as devDependencies (type-aware linting needs the parser wired to
`tsconfig.json`, which is why `parserOptions.project` is set).

## Findings from a manual pass

Before wiring up the rule, the "fire-and-forget" call sites called out in
the finding (`hooks/useWallet.tsx`'s `syncNetwork()`, `lib/freighter.ts`,
`lib/stellar.ts`, `components/tokenize/Step3Confirm.tsx`) were checked by
hand: they already either `await` the promise, prefix it with `void`, or
attach a `.catch(...)`. No floating-promise violations were found in that
review, so no call sites needed changing in this PR.

## Follow-up (not done here)

- `noUncheckedIndexedAccess` is repo-wide and can surface `possibly
  undefined` type errors anywhere an array/object is indexed without a
  bounds check. This wasn't verified with a full `tsc`/`next lint` run as
  part of this change (per scope: config + targeted review, not a full
  build) — run `npm run typecheck` and `npm run lint` after installing the
  new devDependencies and fix anything either surfaces.
