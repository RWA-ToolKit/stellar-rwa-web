# Contributing

Thanks for helping improve Stellar RWA Web.

## Workflow

1. Create a feature branch from `main`.
2. Keep changes focused on one issue or improvement at a time.
3. Run the relevant tests and type checks before opening a PR.

## Local setup

- Copy [.env.example](.env.example) to `.env.local`.
- The project currently targets Stellar Testnet. Mainnet contract IDs are intentionally empty in the example env file.
- Install dependencies with `npm install` and start the app with `npm run dev`.

## Verification

Run these commands before submitting:

```bash
npm run test
npm run typecheck
```

If you add UI changes, prefer updating or adding a focused component test alongside the implementation.
