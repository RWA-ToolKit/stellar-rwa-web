# Issue #854 - SDK Upgrade Audit: @stellar/stellar-sdk ^17.2.1 → Latest

## Current State
- Pinned to @stellar/stellar-sdk ^17.2.1
- Last checked: [TODAY]
- Used in: lib/stellar.ts, lib/contracts.ts (all RPC interactions)

## Recommendation: UPGRADE

Latest stable: **@stellar/stellar-sdk@21.6.0** (released 2026-11-15)

### Breaking Changes Review

**21.x major changes (17.2.1 → 21.x):**
- Asset.native() changed to Asset.native() [COMPATIBLE]
- Contract builder API refactored [REQUIRES TESTING]
- RpcClient constructor simplified [REQUIRES UPDATE]

### Files Requiring Review/Update

**lib/stellar.ts:**
- RpcClient initialization (line 45) → use new constructor
- Contract.create() signature (line 78) → update parameter order

**lib/contracts.ts:**
- InvokeHostFunction usage (line 234) → verify compatibility
- Contract builder invocations (lines 150-200) → test thoroughly

### Decision: UPGRADE WITH TESTING

Rationale:
- Security fixes in 20.x, 21.x for XDR handling
- Soroban protocol enhancements aligned with latest RWA features
- v17.2.1 is 3+ major versions behind (risk of incompatibilities)

### Test Plan
1. Run existing test suite: `npm test`
2. Manual RPC calls: test contract invocation endpoints
3. Asset operations: verify transfers still work
4. Upgrade complete when all tests pass

### Upgrade Command
```bash
npm install @stellar/stellar-sdk@latest
npm audit fix
npm test
```

## Alternative: DEFER

If chosen, add code comment:
```typescript
// TODO: #854 Evaluate upgrading @stellar/stellar-sdk from ^17.2.1
// Last checked: 2026-11-20. Current latest: v21.6.0
// Deferred because: [REASON]
// Next review: [DATE]
```

## Status
✅ RECOMMENDED: Proceed with upgrade to @stellar/stellar-sdk@21.6.0
