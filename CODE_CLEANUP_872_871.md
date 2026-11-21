# Issues #872, #871 - Nested Ternaries & Status Colors Cleanup

## Issue #872 - Simplify Nested Ternaries in CompliancePanel

### Problem

Deeply nested ternary expressions for status rendering are hard to read and error-prone when adding new states.

### Current State

```typescript
// components/asset/CompliancePanel.tsx
export function CompliancePanel({ status }: Props) {
  return (
    <div>
      {status === 'approved' ? (
        <div className="text-green-600">
          <span>✓ Approved</span>
        </div>
      ) : status === 'pending' ? (
        <div className="text-yellow-600">
          <span>⏳ Pending Review</span>
        </div>
      ) : status === 'revoked' ? (
        <div className="text-red-600">
          <span>✗ Revoked</span>
        </div>
      ) : (
        <div className="text-gray-600">
          <span>? Unknown</span>
        </div>
      )}
    </div>
  );
}
```

**Problems:**
- 4 levels of nesting, hard to read
- Adding 5th state = another level of nesting
- Easy to accidentally remove/duplicate parentheses
- Color/icon changes scattered throughout

### Solution

#### Phase 1 - Use Switch Statement (PR 1)

**Refactor with explicit switch:**

```typescript
// components/asset/CompliancePanel.tsx
export function CompliancePanel({ status }: Props) {
  const renderStatus = () => {
    switch (status) {
      case 'approved':
        return (
          <div className="text-green-600">
            <span>✓ Approved</span>
          </div>
        );
      
      case 'pending':
        return (
          <div className="text-yellow-600">
            <span>⏳ Pending Review</span>
          </div>
        );
      
      case 'revoked':
        return (
          <div className="text-red-600">
            <span>✗ Revoked</span>
          </div>
        );
      
      default:
        return (
          <div className="text-gray-600">
            <span>? Unknown</span>
          </div>
        );
    }
  };

  return <div>{renderStatus()}</div>;
}
```

**Benefits:**
- Clear, readable structure
- Easy to add new cases
- No nesting depth issues
- Errors caught by TypeScript exhaustiveness check

#### Phase 2 - Use Lookup Object (PR 2)

**Even cleaner with object lookup:**

```typescript
// lib/statusStyles.ts
export const statusConfig = {
  approved: {
    color: 'text-green-600',
    icon: '✓',
    label: 'Approved',
  },
  pending: {
    color: 'text-yellow-600',
    icon: '⏳',
    label: 'Pending Review',
  },
  revoked: {
    color: 'text-red-600',
    icon: '✗',
    label: 'Revoked',
  },
  unknown: {
    color: 'text-gray-600',
    icon: '?',
    label: 'Unknown',
  },
} as const;

// components/asset/CompliancePanel.tsx
import { statusConfig } from 'lib/statusStyles';

export function CompliancePanel({ status }: Props) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;

  return (
    <div className={config.color}>
      <span>{config.icon} {config.label}</span>
    </div>
  );
}
```

**Benefits:**
- Single source of truth for status rendering
- Declarative, easy to extend
- Shared with other components
- Testing is simpler

#### Phase 3 - Add Type Safety (PR 3)

**Ensure exhaustiveness with TypeScript:**

```typescript
// lib/statusStyles.ts
type ComplianceStatus = 'approved' | 'pending' | 'revoked';

interface StatusConfig {
  color: string;
  icon: string;
  label: string;
}

// TypeScript ensures we have entries for ALL statuses
const statusConfig: Record<ComplianceStatus, StatusConfig> = {
  approved: {
    color: 'text-green-600',
    icon: '✓',
    label: 'Approved',
  },
  pending: {
    color: 'text-yellow-600',
    icon: '⏳',
    label: 'Pending Review',
  },
  revoked: {
    color: 'text-red-600',
    icon: '✗',
    label: 'Revoked',
  },
};

export { statusConfig };
export type { ComplianceStatus, StatusConfig };
```

**TypeScript catches missing cases:**
```typescript
// ❌ ERROR: Property 'revoked' is missing
const config: Record<ComplianceStatus, StatusConfig> = {
  approved: { ... },
  pending: { ... },
  // Missing revoked!
};
```

#### Phase 4 - Create Reusable Component (PR 4)

**Extract ComplianceStatus component:**

```typescript
// components/ui/ComplianceStatus.tsx
import { statusConfig, ComplianceStatus } from 'lib/statusStyles';

interface ComplianceStatusProps {
  status: ComplianceStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ComplianceStatus: React.FC<ComplianceStatusProps> = ({
  status,
  showIcon = true,
  size = 'md',
}) => {
  const config = statusConfig[status];
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  return (
    <div className={`${config.color} ${sizeClass} flex items-center gap-1`}>
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </div>
  );
};
```

**Usage is now trivial:**
```typescript
<ComplianceStatus status="approved" />
<ComplianceStatus status="pending" size="lg" />
```

#### Phase 5 - Update Tests (PR 5)

**Create components/asset/__tests__/CompliancePanel.test.tsx:**

```typescript
import { render, screen } from '@testing-library/react';
import { CompliancePanel } from '../CompliancePanel';

describe('CompliancePanel', () => {
  it('renders approved status', () => {
    render(<CompliancePanel status="approved" />);
    expect(screen.getByText('✓ Approved')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toHaveClass('text-green-600');
  });

  it('renders pending status', () => {
    render(<CompliancePanel status="pending" />);
    expect(screen.getByText('⏳ Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toHaveClass('text-yellow-600');
  });

  it('renders revoked status', () => {
    render(<CompliancePanel status="revoked" />);
    expect(screen.getByText('✗ Revoked')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toHaveClass('text-red-600');
  });

  it('renders unknown for invalid status', () => {
    render(<CompliancePanel status="invalid" as ComplianceStatus />);
    expect(screen.getByText('? Unknown')).toBeInTheDocument();
  });
});
```

### Checklist

- [ ] Identify all nested ternaries in CompliancePanel
- [ ] Replace with switch statement (readable)
- [ ] Extract statusConfig to lib/statusStyles.ts
- [ ] Replace switch with statusConfig lookup (maintainable)
- [ ] Add TypeScript exhaustiveness checking
- [ ] Create ComplianceStatus reusable component
- [ ] Update tests - verify no behavioral change
- [ ] Verify no visual regression

---

## Issue #871 - Move Tailwind Status Colors to Shared Map

### Problem

Status colors duplicated across ComplianceBadge, AssetTypeBadge, CompliancePanel; risks inconsistent rendering.

### Current State

```typescript
// components/compliance/ComplianceBadge.tsx
export function ComplianceBadge({ status }) {
  const colorClass = 
    status === 'approved' ? 'bg-green-100 text-green-800' :
    status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
    status === 'revoked' ? 'bg-red-100 text-red-800' :
    'bg-gray-100 text-gray-800';

  return <span className={colorClass}>{status}</span>;
}

// components/asset/AssetTypeBadge.tsx
export function AssetTypeBadge({ type }) {
  const colorClass = 
    type === 'token' ? 'bg-blue-100 text-blue-800' :
    type === 'nft' ? 'bg-purple-100 text-purple-800' :
    type === 'derivative' ? 'bg-orange-100 text-orange-800' :
    'bg-gray-100 text-gray-800';

  return <span className={colorClass}>{type}</span>;
}

// components/asset/CompliancePanel.tsx
export function CompliancePanel({ status }) {
  const colorClass = 
    status === 'approved' ? 'text-green-600' :
    status === 'pending' ? 'text-yellow-600' :
    status === 'revoked' ? 'text-red-600' :
    'text-gray-600';

  return <div className={colorClass}>...</div>;
}

// Problem: Same status, different color classes!
// 'approved' = green-100/green-800 (badge) vs green-600 (panel)
```

### Solution

#### Phase 1 - Create Centralized Map (PR 1)

**Create lib/statusStyles.ts:**

```typescript
// lib/statusStyles.ts

/**
 * Status-to-Tailwind-class mappings
 * Single source of truth for all status colors across the app
 */

export const statusColorMap = {
  // Compliance statuses
  approved: {
    badge: 'bg-green-100 text-green-800',
    text: 'text-green-600',
    border: 'border-green-300',
    bg: 'bg-green-50',
    icon: 'text-green-600',
  },
  pending: {
    badge: 'bg-yellow-100 text-yellow-800',
    text: 'text-yellow-600',
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
  },
  revoked: {
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-600',
    border: 'border-red-300',
    bg: 'bg-red-50',
    icon: 'text-red-600',
  },
  unknown: {
    badge: 'bg-gray-100 text-gray-800',
    text: 'text-gray-600',
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    icon: 'text-gray-600',
  },
} as const;

export const assetTypeColorMap = {
  token: {
    badge: 'bg-blue-100 text-blue-800',
    text: 'text-blue-600',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
  },
  nft: {
    badge: 'bg-purple-100 text-purple-800',
    text: 'text-purple-600',
    border: 'border-purple-300',
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
  },
  derivative: {
    badge: 'bg-orange-100 text-orange-800',
    text: 'text-orange-600',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
  },
} as const;

/**
 * Get Tailwind classes for a status in a specific context
 * @param status - The status value
 * @param context - Which style context: 'badge', 'text', 'bg', etc.
 */
export function getStatusClasses(
  status: keyof typeof statusColorMap,
  context: keyof typeof statusColorMap['approved'] = 'badge'
): string {
  return statusColorMap[status]?.[context] || statusColorMap.unknown[context];
}

export function getAssetTypeClasses(
  type: keyof typeof assetTypeColorMap,
  context: keyof typeof assetTypeColorMap['token'] = 'badge'
): string {
  return assetTypeColorMap[type]?.[context] || assetTypeColorMap.token[context];
}
```

#### Phase 2 - Update ComplianceBadge (PR 2)

**Update components/compliance/ComplianceBadge.tsx:**

```typescript
import { getStatusClasses } from 'lib/statusStyles';

export function ComplianceBadge({ status }: Props) {
  // Single, canonical color source
  const colorClass = getStatusClasses(status as keyof typeof statusColorMap, 'badge');

  return <span className={colorClass}>{status}</span>;
}
```

**Before:**
```typescript
const colorClass = 
  status === 'approved' ? 'bg-green-100 text-green-800' :
  status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
  // ...
```

#### Phase 3 - Update AssetTypeBadge (PR 3)

**Update components/asset/AssetTypeBadge.tsx:**

```typescript
import { getAssetTypeClasses } from 'lib/statusStyles';

export function AssetTypeBadge({ type }: Props) {
  // Single, canonical color source
  const colorClass = getAssetTypeClasses(type as keyof typeof assetTypeColorMap, 'badge');

  return <span className={colorClass}>{type}</span>;
}
```

**Before:**
```typescript
const colorClass = 
  type === 'token' ? 'bg-blue-100 text-blue-800' :
  type === 'nft' ? 'bg-purple-100 text-purple-800' :
  // ...
```

#### Phase 4 - Update CompliancePanel (PR 4)

**Update components/asset/CompliancePanel.tsx:**

```typescript
import { getStatusClasses } from 'lib/statusStyles';

export function CompliancePanel({ status }: Props) {
  // Single, canonical color source (using 'text' context instead of 'badge')
  const colorClass = getStatusClasses(status as keyof typeof statusColorMap, 'text');

  return <div className={colorClass}>...</div>;
}
```

**Before:**
```typescript
const colorClass = 
  status === 'approved' ? 'text-green-600' :
  status === 'pending' ? 'text-yellow-600' :
  // ...
```

#### Phase 5 - Update All Other Usages (PR 5)

**Find all inline status colors:**

```bash
grep -rn "status === 'approved'" src/ --include="*.tsx" --include="*.ts"
grep -rn "type === 'token'" src/ --include="*.tsx" --include="*.ts"
```

**Replace each with getStatusClasses() or getAssetTypeClasses()**

#### Phase 6 - Create Tests (PR 6)

**Create lib/__tests__/statusStyles.test.ts:**

```typescript
import { getStatusClasses, getAssetTypeClasses, statusColorMap, assetTypeColorMap } from '../statusStyles';

describe('statusStyles', () => {
  it('returns correct badge classes for approved', () => {
    expect(getStatusClasses('approved', 'badge')).toBe('bg-green-100 text-green-800');
  });

  it('returns correct text classes for approved', () => {
    expect(getStatusClasses('approved', 'text')).toBe('text-green-600');
  });

  it('returns default for unknown status', () => {
    expect(getStatusClasses('unknown' as any, 'badge')).toBeDefined();
  });

  it('has all asset types defined', () => {
    expect(assetTypeColorMap).toHaveProperty('token');
    expect(assetTypeColorMap).toHaveProperty('nft');
    expect(assetTypeColorMap).toHaveProperty('derivative');
  });

  it('provides consistent colors across contexts', () => {
    // Approved should be green in all contexts
    expect(getStatusClasses('approved', 'badge')).toContain('green');
    expect(getStatusClasses('approved', 'text')).toContain('green');
    expect(getStatusClasses('approved', 'border')).toContain('green');
  });
});
```

### Checklist

- [ ] Create lib/statusStyles.ts with centralized color maps
- [ ] Update ComplianceBadge to use getStatusClasses
- [ ] Update AssetTypeBadge to use getAssetTypeClasses
- [ ] Update CompliancePanel to use getStatusClasses
- [ ] Find all inline status/type color logic (grep)
- [ ] Replace with centralized getter functions
- [ ] Create tests for color consistency
- [ ] Verify no visual regression

### Benefits

✅ Single source of truth for colors  
✅ Easy to change colors globally  
✅ Consistent look across all components  
✅ Less duplication  
✅ Type-safe (TypeScript)  

### Future Extensions

Add light mode/dark mode overrides:

```typescript
export const statusColorMap = {
  approved: {
    badge: {
      light: 'bg-green-100 text-green-800',
      dark: 'dark:bg-green-900 dark:text-green-100',
    },
    text: {
      light: 'text-green-600',
      dark: 'dark:text-green-400',
    },
  },
  // ...
};
```
