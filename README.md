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

- **Contracts:** https://github.com/RWA-ToolKit/stellar-rwa-contracts
- **API + Docs:** https://github.com/RWA-ToolKit/stellar-rwa-api-docs

## Stellar integration

The app is a pure client of Soroban smart contracts — there is no backend of its
own. It talks to Stellar in two ways:

- **Reads** are Soroban RPC `simulateTransaction` calls against deployed contract
  methods (`get_all_assets`, `get_metadata`, `balance`, `is_allowed`, …). No
  wallet, no fees, no signing — see `lib/stellar.ts` → `readContract`.
- **Writes** are real transactions: build → simulate → assemble footprint & fees
  → **sign with Freighter** → submit → poll to confirmation. See
  `lib/stellar.ts` → `invokeContract` and `hooks/useTx.ts`.

The four Soroban contracts it invokes:

| Contract    | Role                                               |
|-------------|----------------------------------------------------|
| registry    | Index of tokenized assets + total value locked     |
| asset-token | Compliant RWA token; transfers gated by compliance |
| compliance  | KYC allowlist + jurisdiction rules (the gate)      |
| dividend    | Proportional yield/dividend distribution           |

### The on-chain compliance gate

Asset transfers are enforced by the contract, not the UI. On every `transfer`,
the asset-token contract makes cross-contract calls into the compliance contract
for **both** parties:

```
transfer(from, to, amount)
  ├─ compliance.is_allowed(from)   ── cross-contract call ──▶ compliance contract
  ├─ compliance.is_allowed(to)     ── cross-contract call ──▶ compliance contract
  └─ move balances
```

If either party isn't KYC-approved the transaction reverts. The transfer form in
`/asset/[id]` reads this status up front and disables the action with a clear
reason when the connected wallet can't transfer.

### Network & deployed contracts (Testnet)

Network passphrase: `Test SDF Network ; September 2015` · RPC:
`https://soroban-testnet.stellar.org`

| Contract    | Contract ID | Explorer |
|-------------|-------------|----------|
| registry    | `CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3` | [view](https://stellar.expert/explorer/testnet/contract/CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3) |
| compliance  | `CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU` | [view](https://stellar.expert/explorer/testnet/contract/CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU) |
| dividend    | `CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX` | [view](https://stellar.expert/explorer/testnet/contract/CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX) |
| asset-token (sample) | `CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ` | [view](https://stellar.expert/explorer/testnet/contract/CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ) |

Registry, compliance and dividend ids are configured via `NEXT_PUBLIC_*` env vars;
per-asset token ids are discovered at runtime from the registry.

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
