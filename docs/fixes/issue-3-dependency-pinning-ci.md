# Issue 3: Enforce `npm ci` in CI and pin critical Stellar SDKs

**Location:** `package.json` (caret ranges)

## Problem

All dependencies used `^` ranges with no CI or lockfile-enforced installs.
Two contributors installing at different times could end up with different
transitive dependency trees, and the Stellar SDK in particular moves fast
enough that an unpinned range risks pulling in breaking changes silently.

## Fix

- Pinned `@stellar/stellar-sdk` and `@stellar/freighter-api` in
  `package.json` to exact versions (`16.0.1` and `6.0.1` respectively)
  instead of `^` ranges.
- Added `.github/workflows/ci.yml`, a GitHub Actions workflow that runs on
  every push/PR to `main` and uses `npm ci` (which installs strictly from
  `package-lock.json`) followed by lint, typecheck, test, and build steps.

## Result

CI now always installs the exact locked dependency tree, and the two
Stellar SDKs most likely to introduce breaking changes are pinned to exact
versions instead of floating on `^` ranges.
