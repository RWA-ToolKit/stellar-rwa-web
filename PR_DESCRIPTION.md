# Improve holder reconciliation, compliance visibility, and distributions

## Summary

This PR addresses four holder and issuer workflow gaps:

1. **Portfolio reconciliation** — holders can export their loaded positions,
   balances, token contracts, and estimated USD values as a CSV.
2. **Allowlist expiry visibility** — holder transfer views show approval expiry,
   issuer allowlist rows show the expiry ledger, and re-approving a suspended
   address preserves its existing expiry.
3. **Explorer links** — Stellar account and contract addresses in asset detail,
   holder, compliance, and issuer views link directly to the relevant network
   explorer.
4. **Distribution claim deadlines** — issuers can set an optional claim
   deadline ledger, and holders see the deadline or an explicit
   “Claim deadline passed” state.

## Validation

- `npm run typecheck`
- `npm test -- --runInBand components/dividend/DistributionCard.test.tsx components/issuer/panels/DistributionPanel.test.tsx`
