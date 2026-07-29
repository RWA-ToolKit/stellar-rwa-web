# Issue 3: No Prettier config / format check for the web app

**Severity:** Low
**Location:** repo root

## What was implemented

- `.prettierrc.json` — project-wide Prettier config (semicolons, double
  quotes, trailing commas, 100-char print width, 2-space indent), matching
  the style already used across `app/`, `components/`, `hooks/`, and `lib/`.
- `.prettierignore` — excludes `node_modules`, build output (`.next`,
  `build`, `dist`), `coverage`, `package-lock.json`, and the generated
  `next-env.d.ts`.
- `package.json` scripts:
  - `npm run format` — `prettier --write .`
  - `npm run format:check` — `prettier --check .`
- `prettier` added as a devDependency (`^3.3.3`).
- `.github/workflows/format.yml` — new CI workflow that runs
  `npm run format:check` on every push to `main` and on every pull request,
  mirroring how the Rust repos run `rustfmt` in CI.

## Why this is scoped this way

The finding asked for "Prettier + a CI format check" — that's the tooling
gap, not a request to reformat the entire existing codebase in the same
change. This PR adds the config and the CI gate; it does **not** run
`prettier --write .` across all existing files, since that would produce a
large, unreviewed, whitespace-only diff bundled into an unrelated PR.

## Follow-up (not done here)

- Run `npm run format` once across the repo in its own PR (so the formatting
  diff is isolated and easy to review), then the new CI check will pass
  going forward. Until that follow-up lands, `format:check` may fail on
  pre-existing files — it will not fail on newly-added code that already
  follows the config.
