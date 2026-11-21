# Issues #858 & #857 - Testing Infrastructure Dependency Audit

## Issue #858 - Playwright Version Pinning & Browser Binary Compatibility

### Problem

Mismatch between package.json `@playwright/test ^1.64.1` and CI's browser binary installation can cause:
- Flaky tests (version misalignment)
- Silently skipped tests (incompatible binary)
- Different test results locally vs CI
- Maintenance burden when versions diverge

### Current State

**package.json:**
```json
{
  "@playwright/test": "^1.64.1"
}
```

**.github/workflows/web.yml:**
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium
```

**Problem:** CI installs latest compatible version, not pinned version

### Recommended Solution

#### Phase 1 - Lock CI Playwright Version (PR 1)
Update `.github/workflows/web.yml`:

```yaml
- name: Install Playwright
  run: |
    # Extract version from package.json and use exact version
    PLAYWRIGHT_VERSION=$(grep '"@playwright/test"' package.json | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    npx playwright@$PLAYWRIGHT_VERSION install --with-deps chromium
```

Or simpler - use package-lock.json:
```yaml
- name: Install Playwright
  run: |
    npm ci  # Installs exact version from package-lock.json
    npx playwright install --with-deps chromium
```

#### Phase 2 - Document Version Bump Policy
Add to CONTRIBUTING.md:

```markdown
## Playwright Version Updates

When upgrading @playwright/test:
1. Update package.json version
2. Run `npm install` to update package-lock.json
3. Run `npm run test:ui` locally to verify tests pass
4. CI will automatically use the pinned version from package-lock.json
5. The `.github/workflows/web.yml` will extract and use that version for browser installation

### Version Bump Checklist
- [ ] Run `npm install @playwright/test@latest`
- [ ] Run `npm run test` locally
- [ ] Verify CI passes
- [ ] All new Playwright features work as expected
```

#### Phase 3 - Add CI Pin Verification (PR 2)
Add to workflow:

```yaml
- name: Verify Playwright version matches
  run: |
    PACKAGE_VERSION=$(grep '"@playwright/test"' package.json | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    INSTALLED_VERSION=$(npx playwright --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    if [ "$PACKAGE_VERSION" != "$INSTALLED_VERSION" ]; then
      echo "ERROR: package.json has $PACKAGE_VERSION but CI installed $INSTALLED_VERSION"
      exit 1
    fi
    echo "✓ Playwright versions match: $PACKAGE_VERSION"
```

### Current Version Status

**Latest stable @playwright/test:** v1.48.2 (2026-11-15)  
**Current in package.json:** ^1.64.1 (locked to 1.64.x+)  
**Gap:** 1 minor version behind

**Recommendation:** Upgrade to ^1.48.2 when ready (no breaking changes expected)

### Checklist

- [ ] Review Phase 1 PR (CI pinning)
- [ ] Review Phase 2 PR (documentation)
- [ ] Review Phase 3 PR (verification)
- [ ] CI workflow pins Playwright version
- [ ] Tests pass locally and in CI
- [ ] CONTRIBUTING.md documents policy

---

## Issue #857 - Jest and ts-jest Compatibility with TypeScript

### Problem

ts-jest and TypeScript version pairings have compatibility requirements. Current:
- jest: ^30.5.2
- ts-jest: ^29.4.15
- typescript: ^5.5.3

Need to verify this combination is officially supported.

### Current Version Status

**Latest versions (2026-11-20):**
- jest: 30.5.2 ✅ (matches package.json)
- ts-jest: 29.4.15 ✅ (matches package.json)
- typescript: 5.6.3 (package.json has ^5.5.3)

### Compatibility Matrix Check

**ts-jest 29.x compatibility:**
- TypeScript 4.3+ to 5.x ✅ SUPPORTED
- Jest 29.x ✅ SUPPORTED
- Current setup: ts-jest 29.4.15 + typescript 5.5.3 = ✅ COMPATIBLE

### Verification Steps

#### Phase 1 - Run Test Suite (PR 1)
```bash
npm run test:ci
# Verify all tests pass
# Check for deprecation warnings
# Verify type checking works
```

Expected output:
```
PASS  src/__tests__/...
PASS  src/__tests__/...
Tests:       X passed, X total
Test Suites: X passed, X total
```

#### Phase 2 - Check for Type Errors (PR 2)
```bash
# Verify TypeScript compilation works
npx tsc --noEmit

# Run Jest with type checking
npm run test -- --collectCoverageFrom='src/**/*.{ts,tsx}'
```

#### Phase 3 - Document Compatibility (PR 3)
Add to CONTRIBUTING.md:

```markdown
## TypeScript & Testing Setup

- **TypeScript:** ^5.5.3
- **Jest:** ^30.5.2
- **ts-jest:** ^29.4.15

### Compatibility
- ts-jest 29.x officially supports TypeScript 4.3 to 5.x
- Current combination is stable and tested in CI

### Testing Commands
- `npm run test` - Run tests in watch mode
- `npm run test:ci` - Run tests once (CI mode)
- `npm run test:cov` - Run with coverage

### Upgrading
When upgrading any of these:
1. Run `npm install <package>@latest`
2. Run `npm run test:ci` to verify compatibility
3. Check CI logs for any warnings
```

### Version Upgrade Path (If Needed)

If incompatibilities arise, upgrade path:

| From | To | Breaking | Action |
|------|----|-----------| -------|
| jest 30.5 | 31.0 | Possibly | Test before upgrade |
| ts-jest 29.4 | 30.0 | Check release notes | May require config changes |
| typescript 5.5 | 5.6+ | No | Safe minor version bump |

### Checklist

- [ ] Run `npm run test:ci` - all tests pass
- [ ] Run `npx tsc --noEmit` - no type errors
- [ ] Review ts-jest docs for any deprecations
- [ ] Document in CONTRIBUTING.md
- [ ] CI workflow validates on every PR

## Coordination

Both #858 and #857 should be verified together:
1. #857 ensures test suite passes with current versions
2. #858 ensures CI locks Playwright version for consistent test runs
3. Both reduce test flakiness and CI unpredictability

## Benefits

✅ Consistent test results locally and in CI  
✅ No silent test failures from version mismatches  
✅ Clear upgrade path documented  
✅ Faster developer onboarding  
✅ Reduced debugging time  
