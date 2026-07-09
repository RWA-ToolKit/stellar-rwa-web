# Stellar RWA Web

A Next.js web app for tokenizing **real-world assets** on Stellar. Asset issuers
tokenize real estate, invoices and commodities as **compliance-gated tokens**,
manage KYC allowlists, and distribute dividends; investors browse and hold
compliant asset tokens.

Every asset token enforces compliance on-chain — only KYC-approved addresses can
hold or transfer it, checked via a cross-contract call into the compliance
contract on each transfer.

## Tech stack

- **Next.js 14** (app router) + **TypeScript**
- **Tailwind CSS** — dark-first design system
- **@stellar/stellar-sdk** — Soroban RPC (simulate for reads, sign + submit for writes)
- **@stellar/freighter-api** — wallet connection & signing
- **Recharts**, **date-fns**

## Sister repositories

- **Contracts:** https://github.com/your-org/stellar-rwa-contracts
- **API + Docs:** https://github.com/your-org/stellar-rwa-api-docs

The four Soroban contracts this app talks to:

| Contract    | Role                                             |
|-------------|--------------------------------------------------|
| registry    | Index of tokenized assets + total value locked   |
| asset-token | Compliant RWA token; transfers gated by compliance |
| compliance  | KYC allowlist + jurisdiction rules (the gate)    |
| dividend    | Proportional yield/dividend distribution         |

## Getting started

```bash
cp .env.example .env.local   # Testnet contract ids are pre-filled
npm install
npm run dev                  # http://localhost:3000
```

Install the [Freighter](https://freighter.app) browser extension and point it at
**Testnet** to interact with the deployed contracts.

### Scripts

| Script            | Purpose                          |
|-------------------|----------------------------------|
| `npm run dev`     | Local dev server                 |
| `npm run build`   | Production build                 |
| `npm run start`   | Serve the production build       |
| `npm run lint`    | Next.js ESLint                   |
| `npm run typecheck` | `tsc --noEmit`                 |

## Configuration

All configuration is via `NEXT_PUBLIC_*` env vars (see `.env.example`): the
default network, Soroban RPC URLs, and the registry / compliance / dividend
contract ids per network. Asset-token contract ids are discovered at runtime
from the registry.

## Architecture

```
app/            Route segments (landing, explore, asset/[id], …)
components/     UI, wallet, asset, compliance, dividend, layout components
hooks/          Wallet context + async data hooks (assets, asset, compliance, dividends, holders)
lib/            stellar.ts (RPC engine), contracts.ts (typed bindings),
                freighter.ts (wallet), format.ts (USD cents / token amounts)
types/          Domain types mirroring the contracts
```

- **Reads** simulate a contract invocation via Soroban RPC — no wallet, no fees.
- **Writes** build → simulate → assemble → sign (Freighter) → submit → poll,
  surfacing each phase to the UI and mapping contract errors to friendly text.
- Monetary valuations are stored on-chain as **USD cents** (`i128`); token
  amounts are integers in each token's own `decimals` base.

## Pages

| Route          | Status | Description                                            |
|----------------|--------|--------------------------------------------------------|
| `/`            | ✅     | Landing: live platform stats, featured assets, how-it-works |
| `/explore`     | ✅     | Browse assets — filter by type, sort, paginate         |
| `/asset/[id]`  | ✅     | Asset detail: stats, holders, dividends, gated transfer |
| `/asset/new`   | ⏳     | Tokenize a new asset (multi-step)                      |
| `/issuer`      | ⏳     | Issuer dashboard                                        |
| `/issuer/compliance` | ⏳ | Manage KYC allowlist                                  |
| `/issuer/dividends`  | ⏳ | Create/manage distributions                          |
| `/portfolio`   | ⏳     | Investor holdings                                      |
