# Issues #856 & #855 - Linting & Security Dependency Audit

## Issue #856 - ESLint and eslint-config-next Upgrade

### Problem

Lint tooling majors introduce new rules that catch real bugs:
- React 19 hook rules
- Security vulnerabilities
- Performance anti-patterns
- Accessibility violations

Staying behind means missing these checks.

### Current Versions

**package.json:**
```json
{
  "eslint": "^10.13.0",
  "eslint-config-next": "^16.4.2"
}
```

**Latest versions (2026-11-20):**
- eslint: 10.14.0 (minor bump available)
- eslint-config-next: 16.5.1 (minor bump available)

### Upgrade Strategy

#### Phase 1 - Check ESLint Release Notes (PR 1)

Review changes between 10.13.0 and 10.14.0:
```bash
# ESLint changelog typically includes:
# - New recommended rules
# - Deprecations
# - Breaking changes (rarely in minor versions)
```

Expected changes:
- ✅ Minor version: safe upgrade
- ⚠️ Check for new recommended rules that might fail

#### Phase 2 - Upgrade & Lint (PR 2)

```bash
npm install eslint@latest eslint-config-next@latest

# Run lint
npm run lint

# Review any new violations
# Fix violations or update .eslintrc.json
```

#### Phase 3 - Review New Rules (PR 3)

Typical new rules to address:
- React 19 hook dependencies
- Next.js Image optimization
- SEO best practices
- Accessibility rules

Example fixes:
```javascript
// Before: Missing dependency
useEffect(() => {
  console.log(data);
}, []); // Missing 'data'

// After: Include dependency
useEffect(() => {
  console.log(data);
}, [data]);
```

#### Phase 4 - Document ESLint Policy (PR 4)

Add to CONTRIBUTING.md:

```markdown
## Linting Standards

### ESLint Configuration
- **ESLint:** ^10.14.0 (or latest minor)
- **eslint-config-next:** ^16.5.1 (or latest minor)

### Running Linter
- `npm run lint` - Check for violations
- `npm run lint:fix` - Auto-fix violations

### Upgrade Policy
When upgrading eslint or eslint-config-next:
1. Run `npm install eslint@latest eslint-config-next@latest`
2. Run `npm run lint` to check for new violations
3. Fix any new violations in src/
4. Update .eslintrc.json if needed for new rules
5. Document in PR why new rules are enabled/disabled

### Common New Rules
- React 19 hook dependencies
- Next.js Image usage (require alt text, sizes)
- Accessibility (button roles, labels)
- Security (no dangerouslySetInnerHTML)
```

### Version Matrix

| ESLint | Config | React | Status | Breaking |
|--------|--------|-------|--------|----------|
| 10.13 | 16.4 | 18 | Current | No |
| 10.14 | 16.5 | 18 | Available | No |
| 11.0 | 17.0 | 19 | Future | Possible |

### Checklist

- [ ] Review eslint 10.14.0 changelog
- [ ] Upgrade both packages
- [ ] Run `npm run lint` - fix any new violations
- [ ] Run `npm run build` - verify build succeeds
- [ ] Document in CONTRIBUTING.md
- [ ] CI passes

### Benefits

✅ Catch new React 19 hook issues  
✅ Enforce Next.js best practices  
✅ Better accessibility compliance  
✅ Security-focused linting  
✅ Performance recommendations  

---

## Issue #855 - @stellar/freighter-api Audit

### Problem

Wallet-integration libraries are security-sensitive. Outdated versions miss:
- New Freighter extension API changes
- Security fixes for transaction signing
- Compatibility with updated browser extensions
- Key management improvements

### Current Status

**package.json:**
```json
{
  "@stellar/freighter-api": "^6.0.1"
}
```

**Latest versions (2026-11-20):**
- @stellar/freighter-api: 7.2.3 (1+ major version available)

**Gap:** 1 major version behind (significant changes likely)

### Audit Steps

#### Phase 1 - Review Release Notes (PR 1)

Check @stellar/freighter-api releases:
```bash
npm view @stellar/freighter-api versions
# Output shows: 6.0.1, 6.1.0, 7.0.0, 7.1.0, 7.2.3

# Review changelog
# https://github.com/stellar/js-stellar-freighter-api/releases
```

**Expected v7.x changes:**
- API restructuring (possible breaking changes)
- New methods for wallet detection
- Improved transaction signing flow
- Better error handling

#### Phase 2 - Test Current Integration (PR 2)

Review lib/freighter.ts usage:

```typescript
import { isConnected, signTransaction, getPublicKey } from "@stellar/freighter-api";

// Test cases to verify:
// 1. Freighter wallet detection works
// 2. signTransaction returns correct Tx object
// 3. getPublicKey returns valid public key
// 4. Error handling for missing wallet
```

Run existing tests:
```bash
npm run test -- lib/__tests__/freighter.test.ts
```

#### Phase 3 - Upgrade Decision Matrix

| Scenario | Action | Why |
|----------|--------|-----|
| Breaking changes in v7, tests pass | Upgrade v7 | New features, security fixes |
| Breaking changes in v7, tests fail | Document deferral | Wait for guidance on v7 migration |
| No breaking changes in v7 | Upgrade v7 | No risk, benefits from latest |
| Security vulnerability in v6 | Force upgrade to v7 | Security trumps compatibility |

#### Phase 4 - Freighter Extension Compatibility

Check installed Freighter extension version:
1. Open browser console (Freighter installed)
2. Check extension version in browser settings
3. Cross-reference with @stellar/freighter-api compatibility matrix
4. Test wallet connection and signing

#### Phase 5 - Conditional Upgrade (PR 3)

**Option A: Conservative Upgrade (v6.x)**
```json
{
  "@stellar/freighter-api": "^6.1.0"
}
```
- Minimal risk
- Patches only
- Misses v7 features
- If preferred: document as deliberate choice

**Option B: Major Upgrade (v7.x)**
```json
{
  "@stellar/freighter-api": "^7.2.3"
}
```
- Requires review of v7 migration guide
- Update lib/freighter.ts as needed
- Run full test suite
- Thorough integration testing

#### Phase 6 - Integration Tests (PR 4)

If upgrading to v7:
```bash
# Test wallet integration
npm run test -- lib/__tests__/freighter.test.ts --verbose

# Test signing flow
npm run test -- src/__tests__/transactions.test.ts

# Manual testing
npm run dev
# 1. Connect Freighter wallet
# 2. Attempt transaction signing
# 3. Verify signature works
```

### Migration Guide (If Upgrading to v7)

Likely changes in v7:

```typescript
// v6.x API
import { signTransaction, getPublicKey, isConnected } from "@stellar/freighter-api";

// v7.x possible API (hypothetical)
import Freighter from "@stellar/freighter-api";
const freighter = new Freighter();
await freighter.connect();
const tx = await freighter.signTransaction(txEnvelope);
```

### Decision Framework

**Upgrade to v7 if:**
- ✅ Security vulnerabilities in v6
- ✅ v7 has long-term support (LTS) label
- ✅ Core features align with roadmap
- ✅ Tests pass after upgrade

**Stay on v6 if:**
- ⚠️ v7 has breaking changes requiring migration work
- ⚠️ Freighter extension doesn't yet support v7 API
- ⚠️ No critical security issues in v6

### Documentation (Either Path)

Add to CONTRIBUTING.md:

```markdown
## Freighter Wallet Integration

### Version
- **@stellar/freighter-api:** ^6.0.1 (conservative) OR ^7.2.3 (latest)

### Why [chosen version]
[Document decision rationale]

### Testing Freighter Integration
1. Install Freighter extension locally
2. Run `npm run dev`
3. Connect wallet in app
4. Test transaction signing
5. Verify signature on-chain

### Upgrading Freighter
Before upgrading major versions:
1. Review migration guide
2. Run integration tests
3. Test manually with extension
4. Verify on testnet
```

### Checklist

- [ ] Review @stellar/freighter-api releases
- [ ] Read migration guide (if v7)
- [ ] Decide: v6 (conservative) or v7 (latest)
- [ ] Run `npm run test -- freighter.test.ts`
- [ ] Update lib/freighter.ts if needed
- [ ] Manual testing with Freighter extension
- [ ] Document decision in CONTRIBUTING.md

## Related Issues

### Coordination with #856 (ESLint)
- After upgrading freighter-api, ESLint may catch new issues
- Run `npm run lint` after freighter-api upgrade
- Fix any new lint violations

## Benefits

✅ Security fixes for wallet integration  
✅ Latest Freighter extension compatibility  
✅ Better error handling and type safety  
✅ Performance improvements  
✅ Clear version policy documented  

## Risk Assessment

**v6.0.1 (current):**
- Known quantity
- Stable
- May have security gaps
- Missing v7 features

**v7.2.3 (latest):**
- Newer = more fixes
- Possible API differences
- Better wallet detection
- Requires testing

**Recommendation:** Audit first, then decide based on actual gaps/needs.
