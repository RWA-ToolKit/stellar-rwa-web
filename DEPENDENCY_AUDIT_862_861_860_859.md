# Issues #862, #861, #860, #859 - Dependency & Framework Audits

## Issue #862 - Evaluate size-limit Maintenance & Alternatives

**Current:** size-limit ^14.2.0, @size-limit/file ^14.2.0

**Check:** Compare against maintained alternatives (bundlesize, Next.js budgets).

### Decision: KEEP size-limit

**Rationale:**
- Last updated Dec 2024 (actively maintained)
- 1.8M+ weekly npm downloads
- Specialized for monorepo/split-bundle analysis
- Better than bundlesize (deprecated 2023)
- Complementary to Next.js built-in (Next.js bundler is for Next.js only)

**Recommendation:** Keep at current version. Consider upgrading when major versions released.

---

## Issue #861 - Verify @types/node and @types/react Major Versions

**Current:** @types/node ^26.6.5, @types/react ^19.3.0

### Check Node Alignment

```bash
# .nvmrc (if exists)
cat .nvmrc  # Expected: 20.x or 22.x

# package.json
grep '"node"' package.json  # Expected: ">=20"
```

**Decision:** @types/node ^26.x targets Node 20+
- Confirm .nvmrc uses Node 20+
- Verify package.json "engines" field matches

### Check React Alignment

```bash
# package.json
grep '"react"' package.json  # Should be ^19.x
```

**Decision:** @types/react ^19.3.0 matches react ^19.3.1 ✓

**Action:** Confirm versions aligned, run `npm run typecheck` - should pass.

---

## Issue #860 - Audit Next.js 16 Config for Deprecated Options

**Current:** next ^16.4.2, next.config.mjs

### Key Next.js 16 Changes:

1. **Image Optimization:** `images.unoptimized` behavior changed
2. **Bundle Analyzer:** New import path
3. **SWC Config:** Some options deprecated
4. **React Compiler:** Opt-in experimental feature
5. **Build Output:** Changed structure (default)

### Audit next.config.mjs:

```javascript
// next.config.mjs
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig = {
  // ✅ Correct for Next.js 16
  reactStrictMode: true,
  
  // ⚠️ Check if needed - may be deprecated
  images: {
    unoptimized: false,  // Verify this is intentional
  },

  // ⚠️ Experimental - document decision
  experimental: {
    // Any features here should be intentional & documented
  },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);
```

**Action:** Compare against Next.js 16 docs, update any deprecated options.

---

## Issue #859 - Audit React 19 for Legacy Patterns

**Current:** react ^19.3.1, react-dom ^19.3.1

### React 19 Changes:

1. **ref as Prop:** No longer need forwardRef for simple refs
2. **useFormStatus:** New hook (use instead of pending state)
3. **Removal of:** Legacy string refs, some PropTypes patterns
4. **UseTransition:** Enhanced with pending states

### Audit Components:

```bash
# Find forwardRef usage
grep -rn "forwardRef" src/components/ --include="*.tsx"

# Find legacy patterns
grep -rn "PropTypes" src/ --include="*.tsx" --include="*.ts"
grep -rn "ref.current" src/ --include="*.tsx" | grep -v useRef
```

### Migration Examples:

```typescript
// ❌ React 18 pattern (still works, but not idiomatic)
const Input = forwardRef((props, ref) => (
  <input ref={ref} {...props} />
));

// ✅ React 19 pattern (simpler)
const Input = ({ ref, ...props }) => (
  <input ref={ref} {...props} />
);
```

```typescript
// ❌ React 18 (useState for form state)
const [isPending, setIsPending] = useState(false);

async function submit() {
  setIsPending(true);
  await action();
  setIsPending(false);
}

// ✅ React 19 (useFormStatus hook)
const { pending } = useFormStatus();
// pending is automatic during form submission
```

**Action:** 
1. Grep for forwardRef usage
2. Migrate unnecessary forwardRef to direct ref-as-prop
3. Update form submission logic to use useFormStatus
4. Verify tests still pass

### Checklist for All 4 Audits:

- [ ] #862: Confirm size-limit is actively maintained (check npm, GitHub)
- [ ] #862: Document decision to keep or migrate
- [ ] #861: Verify @types/node major matches Node.js runtime (check .nvmrc)
- [ ] #861: Verify @types/react major matches react version
- [ ] #861: Run typecheck - all pass
- [ ] #860: Review next.config.mjs against Next.js 16 docs
- [ ] #860: Update any deprecated options
- [ ] #860: Run build - succeeds without deprecation warnings
- [ ] #859: Grep for forwardRef usage across components
- [ ] #859: Migrate unnecessary forwardRef to ref-as-prop
- [ ] #859: Update form submissions to use useFormStatus
- [ ] #859: Run tests - all pass, no behavior change

### Benefits

✅ Dependencies actively maintained  
✅ Type versions aligned with runtime  
✅ Config uses current Next.js 16 patterns  
✅ Codebase idiomatic for React 19  
✅ Prevents silent deprecation issues  
