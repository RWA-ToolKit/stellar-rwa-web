# Issues #864, #863 - Dependency Audits (date-fns Tree-Shaking & Tailwind v4)

## Issue #864 - Review date-fns Usage for Tree-Shaking Correctness

### Problem

date-fns is tree-shakeable only with **named imports**; namespace/default imports bloat bundle.

### Current State

```
package.json: date-fns ^4.1.0
lib/format.ts: ?
components/ui/DataFreshness.tsx: ?
```

### Solution

#### Phase 1 - Audit Current Imports (PR 1)

**Run grep to find all date-fns imports:**

```bash
grep -rn "from ['\"]date-fns" src/ --include="*.ts" --include="*.tsx"
```

Expected findings:
```typescript
// ✅ GOOD - Tree-shakeable (named imports)
import { formatDistance } from 'date-fns';
import { format, parseISO } from 'date-fns';

// ❌ BAD - Not tree-shakeable (default/namespace)
import dateFns from 'date-fns';  // ❌
import * as dateFns from 'date-fns';  // ❌
```

**Document findings in AUDIT_DATE_FNS_RESULTS.md:**

```markdown
# date-fns Tree-Shaking Audit Results

Date: 2026-11-20

## Status: ✅ COMPLIANT

All date-fns imports use named imports (tree-shakeable).

### Imports Found

- lib/format.ts
  - `import { formatDistance } from 'date-fns'` ✅
  - `import { format, parseISO } from 'date-fns'` ✅

- components/ui/DataFreshness.tsx
  - `import { formatDistance } from 'date-fns'` ✅

### Tree-Shaking Impact

With all named imports, unused date-fns functions are eliminated from production bundle.

Estimated savings: 10-15KB (gzipped) if only 2-3 functions used out of 100+
```

#### Phase 2 - Add ESLint Rule (PR 2)

**Update .eslintrc.json (or eslint.config.js):**

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["date-fns"],
            "importNames": ["default"],
            "message": "Default imports from date-fns are not tree-shakeable. Use named imports instead: import { formatDistance } from 'date-fns'"
          }
        ]
      }
    ]
  }
}
```

**Or in eslint.config.mjs:**

```javascript
export default [
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["date-fns"],
              importNames: ["default"],
              message: "Use named imports: import { formatDistance } from 'date-fns'",
            },
          ],
        },
      ],
    },
  },
];
```

#### Phase 3 - Add CI Check (PR 3)

**Update .github/workflows/lint.yml:**

```yaml
- name: Check date-fns imports
  run: |
    # Fail if any default imports from date-fns found
    if grep -r "import.*from ['\"]date-fns['\"]" src/ | grep -E "import \*|import .*date" | grep -v "import {"; then
      echo "ERROR: Default/namespace imports from date-fns found!"
      echo "Use named imports instead: import { formatDistance } from 'date-fns'"
      exit 1
    fi
    echo "✅ All date-fns imports are tree-shakeable"
```

#### Phase 4 - Document Best Practices (PR 4)

**Create docs/DEPENDENCIES.md:**

```markdown
# Dependency Best Practices

## date-fns

**Rule:** Always use named imports from date-fns.

### ✅ Correct

```typescript
import { formatDistance, format, parseISO } from 'date-fns';

export function formatTimestamp(timestamp: string) {
  return format(parseISO(timestamp), 'yyyy-MM-dd HH:mm:ss');
}

export function formatRelative(date: Date) {
  return formatDistance(date, new Date(), { addSuffix: true });
}
```

### ❌ Incorrect

```typescript
// WRONG - not tree-shakeable
import * as dateFns from 'date-fns';
import dateFns from 'date-fns';  // No default export anyway

dateFns.formatDistance(...);
```

### Why?

date-fns is designed for tree-shaking: unused functions are removed at build time.
Default imports prevent tree-shaking, bloating your production bundle by ~20-30KB (gzipped).

### Bundle Impact

With proper named imports + tree-shaking:
- Unused functions eliminated: ✅
- Bundle size: ~5KB (for 2-3 functions used)

With default import (no tree-shaking):
- All 100+ functions included: ❌
- Bundle size: ~30KB

**Always use named imports.**
```

### Checklist

- [ ] Grep all date-fns imports
- [ ] Confirm all are named imports (tree-shakeable)
- [ ] Add ESLint rule preventing default imports
- [ ] Update CI to check for tree-shaking compliance
- [ ] Document in DEPENDENCIES.md
- [ ] Verify no violations: `npm run lint`

---

## Issue #863 - Audit Tailwind v4 Migration Readiness

### Problem

Tailwind v3 → v4 changes configuration format substantially; need readiness assessment now.

### Current State

```
package.json: tailwindcss ^3.4.6
tailwind.config.ts: TypeScript config
postcss.config.mjs: PostCSS setup
```

### Tailwind v4 Key Changes

1. **CSS-based configuration** (instead of JS)
2. **New CSS variable system** for theming
3. **Built-in CSS reset** (@import "tailwindcss";)
4. **Breaking changes** in class names, breakpoints
5. **New package structure** (@tailwindcss/*)

### Solution

#### Phase 1 - Review Current Configuration (PR 1)

**Audit tailwind.config.ts:**

```typescript
// tailwind.config.ts (current, Tailwind v3)
import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',  // ⚠️ Changed in v4
  theme: {
    extend: {
      colors: {
        // Custom palette - needs migration check
        primary: '#2563eb',
        'dark-first': '#1a1a2e',  // ⚠️ Check if still supported
      },
      spacing: {
        // Custom spacing - should be compatible
      },
    },
  },
  plugins: [
    // List any plugins used
  ],
} satisfies Config
```

**Document findings:**

```markdown
# Tailwind v4 Migration Readiness Assessment

Date: 2026-11-20

## Current Setup

- **Framework:** React (Vite)
- **Tailwind:** v3.4.6
- **Dark Mode:** Class-based (darkMode: 'class')
- **Custom Theme:** Yes (custom color palette)
- **Plugins Used:** [List plugins]

## v3 → v4 Breaking Changes

### Configuration Format
- **v3:** JavaScript/TypeScript config file
- **v4:** CSS-based config (@tailwindcss/config)
- **Impact:** 🔴 **Major** - Full rewrite of tailwind.config.ts

### Dark Mode
- **v3:** `darkMode: 'class'` in JS config
- **v4:** CSS variables or media query (configure in CSS)
- **Impact:** 🟡 **Medium** - Requires CSS updates

### Color Palette
- **v3:** Extend colors in theme.extend.colors
- **v4:** CSS variables in root
- **Impact:** 🟡 **Medium** - Custom palette needs variable migration

### Content Glob
- **v3:** `content: ['./src/**/*.{js,ts,jsx,tsx}']`
- **v4:** `@import "tailwindcss";` in CSS (auto-scanning)
- **Impact:** 🟢 **Low** - Mostly automatic

## Migration Path

### Phase 1: Preparation (This Release)
- [ ] Document current customizations
- [ ] Audit all plugins compatibility
- [ ] Create v4-compatible CSS config draft

### Phase 2: v4.0 Release Support
- [ ] Update package.json (cut v4.0 release)
- [ ] Rewrite tailwind.config.css (or switch to CSS config)
- [ ] Migrate darkMode to CSS variables
- [ ] Test all custom colors still work
- [ ] Update PostCSS config if needed

### Phase 3: Post-Release Optimization
- [ ] Leverage new CSS features
- [ ] Optimize custom theme via CSS variables
- [ ] Update documentation

## Blocking Customizations

**None identified** - all current customizations appear compatible with v4.

### Custom Colors (Compatible)
```css
/* v4 CSS config */
@theme {
  --colors-primary: #2563eb;
  --colors-dark-first: #1a1a2e;
}
```

### Dark Mode (Requires Update)
```css
/* v3 (JS) → v4 (CSS) */
@media (prefers-color-scheme: dark) {
  @theme {
    --colors-bg: #1a1a1a;
  }
}
```

## Risk Assessment

**Risk Level:** 🟡 **Medium**

**Why:**
- Configuration rewrite needed but straightforward
- Custom colors easily portable to CSS variables
- No major blocking customizations identified
- Vite integration stable in v4

**Mitigation:**
- Schedule migration for v1.1.0 release
- Create feature branch for v4 migration
- Thorough testing of dark mode and custom colors
- Keep v3 on maintenance until v4 fully stable (1 release cycle)

## Recommendation

**Timeline:** Migrate to Tailwind v4 in next major release (v1.1.0)

**Effort:** 2-3 days (config rewrite, testing, documentation)

**Benefits:**
- Smaller CSS bundle (~5-10% reduction with v4 optimizations)
- CSS-first configuration (easier to reason about)
- Access to new Tailwind features
- Future-proofed (v3 will eventually EOL)

## References

- [Tailwind v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)
- [CSS Configuration API](https://tailwindcss.com/docs/configuration)
- [v4 Release Notes](https://tailwindcss.com/blog/tailwindcss-v4)
```

#### Phase 2 - Automated Dependency Check (PR 2)

**Create scripts/check-tailwind-migration.js:**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const tailwindVersion = require("../package.json").devDependencies.tailwindcss;
const majorVersion = parseInt(tailwindVersion.replace("^", ""));

console.log(`\n📦 Tailwind CSS Version Check\n`);
console.log(`Current version: ${tailwindVersion}`);

if (majorVersion < 4) {
  console.log(
    `\n⚠️  Running Tailwind v${majorVersion} - v4 migration recommended\n`
  );
  console.log("Next steps:");
  console.log("1. Review docs/DEPENDENCIES.md for migration guide");
  console.log("2. Create feature branch: git checkout -b feat/tailwind-v4");
  console.log("3. Update tailwind.config.ts → tailwind.config.css");
  console.log("4. Update PostCSS config");
  console.log("5. Test dark mode and custom colors\n");
  process.exit(0);
} else {
  console.log(`\n✅ Running Tailwind v${majorVersion}\n`);
}
```

**Add to package.json scripts:**

```json
{
  "scripts": {
    "check:tailwind": "node scripts/check-tailwind-migration.js"
  }
}
```

#### Phase 3 - Create Migration Guide (PR 3)

**Create docs/TAILWIND_V4_MIGRATION.md:**

```markdown
# Tailwind CSS v4 Migration Guide

## Overview

This guide covers migrating from Tailwind CSS v3.x to v4.x.

## Changes Summary

| Feature | v3 | v4 | Notes |
|---------|----|----|-------|
| Config Format | JS/TS | CSS-based | Rewrite needed |
| Dark Mode | JS config | CSS | Variables or media query |
| Colors | theme.extend | CSS variables | Easy migration |
| Plugins | @tailwindcss/forms | @tailwindcss/* | Same but new structure |

## Step-by-Step Migration

### 1. Update package.json

```json
{
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

### 2. Create tailwind.config.css

**New file: tailwind.config.css**

```css
@import "tailwindcss";

@theme {
  /* Custom colors */
  --colors-primary: #2563eb;
  --colors-dark-first: #1a1a2e;

  /* Custom spacing if needed */
  --spacing-gutter: 1.5rem;
}

/* Dark mode configuration */
@media (prefers-color-scheme: dark) {
  @theme {
    --colors-background: #1a1a1a;
    --colors-text: #ffffff;
  }
}
```

### 3. Delete Old Config

```bash
rm tailwind.config.ts
```

### 4. Update index.css

```css
/* Old v3 style */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* New v4 style */
@import "tailwindcss";
@import "./tailwind.config.css"; /* Import custom config */
```

### 5. Test

```bash
npm run dev
npm run build
```

## Validation

- [ ] Dev server starts without errors
- [ ] Dark mode toggle works
- [ ] Custom colors render correctly
- [ ] No console warnings
- [ ] Build completes successfully
- [ ] Bundle size reasonable

## Troubleshooting

**Issue:** Colors not applying
**Solution:** Ensure CSS variables are in root scope, check @theme syntax

**Issue:** Dark mode not working
**Solution:** Verify media query in CSS, check prefers-color-scheme

**Issue:** Build errors
**Solution:** Ensure PostCSS v8.4.47+, tailwindcss v4.0+
```

### Checklist

- [ ] Audit current tailwind.config.ts
- [ ] Document custom colors and dark mode setup
- [ ] Identify any blocking customizations (none expected)
- [ ] Create migration readiness assessment document
- [ ] Add check script to package.json
- [ ] Create migration guide
- [ ] Schedule v4 migration for next release (v1.1.0)
- [ ] Test v4 in feature branch before merging
- [ ] Update CI to test both v3 and v4 (until v3 EOL)

## Benefits

✅ CSS-based configuration (easier to understand)  
✅ Better dark mode support  
✅ Smaller CSS bundles  
✅ Access to v4 new features  
✅ Future-proofed  
