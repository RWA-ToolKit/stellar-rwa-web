# Issues #870, #869, #868 - React Refactoring: Hooks, Reducer, Components

## Issue #870 - Replace Manual Polling with Shared usePoll Utility

### Problem

Multiple hooks implement custom polling logic independently:
- hooks/useAssets.ts
- hooks/useAsset.ts
- hooks/useHolders.ts
- hooks/useActivity.ts
- components/home/PlatformStats.tsx

**Result:** Duplicated setup/teardown, risk of memory leaks (missing cleanup)

### Solution

Create **hooks/usePoll.ts** shared utility handling:
- Interval setup/teardown consistently
- Visibility-based pausing (don't poll when tab is hidden)
- Cleanup on unmount

**Implementation:**

```typescript
// hooks/usePoll.ts
import { useEffect, useRef } from 'react';

interface UsePollOptions {
  enabled?: boolean;
  pauseWhenHidden?: boolean;
}

export function usePoll(
  fn: () => void | Promise<void>,
  intervalMs: number,
  options: UsePollOptions = {}
): void {
  const { enabled = true, pauseWhenHidden = true } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (pauseWhenHidden) {
        if (document.hidden && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        } else if (!document.hidden && !intervalRef.current) {
          // Resume polling
          fn();
          intervalRef.current = setInterval(fn, intervalMs);
        }
      }
    };

    // Initial poll
    fn();

    // Start interval
    intervalRef.current = setInterval(fn, intervalMs);

    // Listen for visibility changes
    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fn, intervalMs, enabled, pauseWhenHidden]);
}
```

**Migration Examples:**

```typescript
// BEFORE: hooks/useAssets.ts
export function useAssets() {
  const [assets, setAssets] = useState([]);
  
  useEffect(() => {
    const fetchAssets = async () => {
      const data = await fetchAssetsFromApi();
      setAssets(data);
    };

    fetchAssets();
    const interval = setInterval(fetchAssets, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return assets;
}

// AFTER
export function useAssets() {
  const [assets, setAssets] = useState([]);
  
  const fetchAssets = useCallback(async () => {
    const data = await fetchAssetsFromApi();
    setAssets(data);
  }, []);

  usePoll(fetchAssets, 5000);
  
  return assets;
}
```

```typescript
// BEFORE: hooks/useActivity.ts
export function useActivity(assetId: string) {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const poll = async () => {
      const data = await getActivityForAsset(assetId);
      setActivities(data);
    };

    poll();
    const timer = setInterval(poll, 10000);
    
    return () => clearInterval(timer);
  }, [assetId]);

  return activities;
}

// AFTER
export function useActivity(assetId: string) {
  const [activities, setActivities] = useState([]);

  const poll = useCallback(async () => {
    const data = await getActivityForAsset(assetId);
    setActivities(data);
  }, [assetId]);

  usePoll(poll, 10000);

  return activities;
}
```

### Benefits

✅ Consistent cleanup prevents memory leaks  
✅ Tab visibility pausing reduces battery drain  
✅ Single place to fix polling issues  
✅ Easier to add logging/metrics  

---

## Issue #869 - Refactor TokenizeWizard Step Logic into useReducer

### Problem

TokenizeWizard manages step transitions and form data via multiple useState calls, making it hard to test and reason about.

### Solution

Extract **lib/tokenizeWizard/reducer.ts** with testable reducer logic.

**Implementation:**

```typescript
// lib/tokenizeWizard/types.ts
export interface TokenizeWizardState {
  currentStep: 1 | 2 | 3 | 4;
  step1Data: { asset: string; amount: number };
  step2Data: { terms: string; duration: number };
  step3Data: { price: number; currency: string };
  step4Data: { confirmations: boolean[] };
  errors: Partial<Record<keyof TokenizeWizardState, string>>;
}

export type TokenizeWizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GOTO_STEP'; payload: 1 | 2 | 3 | 4 }
  | { type: 'UPDATE_FIELD'; payload: { step: number; data: any } }
  | { type: 'SET_ERROR'; payload: { step: number; error: string } }
  | { type: 'RESET' };

export const initialState: TokenizeWizardState = {
  currentStep: 1,
  step1Data: { asset: '', amount: 0 },
  step2Data: { terms: '', duration: 0 },
  step3Data: { price: 0, currency: 'USD' },
  step4Data: { confirmations: [false, false, false] },
  errors: {},
};
```

```typescript
// lib/tokenizeWizard/reducer.ts
import { TokenizeWizardState, TokenizeWizardAction, initialState } from './types';

export function tokenizeWizardReducer(
  state: TokenizeWizardState,
  action: TokenizeWizardAction
): TokenizeWizardState {
  switch (action.type) {
    case 'NEXT_STEP':
      if (state.currentStep < 4) {
        return { ...state, currentStep: (state.currentStep + 1) as any };
      }
      return state;

    case 'PREV_STEP':
      if (state.currentStep > 1) {
        return { ...state, currentStep: (state.currentStep - 1) as any };
      }
      return state;

    case 'GOTO_STEP':
      return { ...state, currentStep: action.payload };

    case 'UPDATE_FIELD':
      const { step, data } = action.payload;
      const stepKey = `step${step}Data` as keyof TokenizeWizardState;
      return {
        ...state,
        [stepKey]: { ...state[stepKey], ...data },
        errors: { ...state.errors, [stepKey]: undefined },
      };

    case 'SET_ERROR':
      const errorKey = `step${action.payload.step}Data` as keyof TokenizeWizardState;
      return {
        ...state,
        errors: { ...state.errors, [errorKey]: action.payload.error },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
```

```typescript
// lib/tokenizeWizard/reducer.test.ts
import { tokenizeWizardReducer, initialState } from './reducer';

describe('tokenizeWizardReducer', () => {
  it('advances to next step', () => {
    const state = tokenizeWizardReducer(initialState, { type: 'NEXT_STEP' });
    expect(state.currentStep).toBe(2);
  });

  it('goes back to previous step', () => {
    const state2 = { ...initialState, currentStep: 2 };
    const state = tokenizeWizardReducer(state2, { type: 'PREV_STEP' });
    expect(state.currentStep).toBe(1);
  });

  it('updates field data', () => {
    const state = tokenizeWizardReducer(initialState, {
      type: 'UPDATE_FIELD',
      payload: { step: 1, data: { asset: 'USDC', amount: 1000 } },
    });
    expect(state.step1Data.asset).toBe('USDC');
    expect(state.step1Data.amount).toBe(1000);
  });

  it('sets error on field', () => {
    const state = tokenizeWizardReducer(initialState, {
      type: 'SET_ERROR',
      payload: { step: 1, error: 'Asset is required' },
    });
    expect(state.errors.step1Data).toBe('Asset is required');
  });

  it('resets to initial state', () => {
    const state2 = { ...initialState, currentStep: 3, step1Data: { asset: 'FOO', amount: 100 } };
    const state = tokenizeWizardReducer(state2, { type: 'RESET' });
    expect(state).toEqual(initialState);
  });
});
```

**Updated Component:**

```typescript
// components/tokenize/TokenizeWizard.tsx
import { useReducer } from 'react';
import { tokenizeWizardReducer, initialState } from 'lib/tokenizeWizard/reducer';

export function TokenizeWizard() {
  const [state, dispatch] = useReducer(tokenizeWizardReducer, initialState);

  const handleNext = () => dispatch({ type: 'NEXT_STEP' });
  const handlePrev = () => dispatch({ type: 'PREV_STEP' });
  const handleUpdateField = (data: any) =>
    dispatch({ type: 'UPDATE_FIELD', payload: { step: state.currentStep, data } });

  return (
    <div>
      {state.currentStep === 1 && (
        <Step1
          data={state.step1Data}
          onUpdate={handleUpdateField}
          error={state.errors.step1Data}
        />
      )}
      {state.currentStep === 2 && <Step2 data={state.step2Data} onUpdate={handleUpdateField} />}
      {state.currentStep === 3 && <Step3 data={state.step3Data} onUpdate={handleUpdateField} />}
      {state.currentStep === 4 && <Step4 data={state.step4Data} onUpdate={handleUpdateField} />}

      <button onClick={handlePrev} disabled={state.currentStep === 1}>
        Previous
      </button>
      <button onClick={handleNext} disabled={state.currentStep === 4}>
        Next
      </button>
    </div>
  );
}
```

### Benefits

✅ Reducer logic is testable in isolation  
✅ State transitions explicit and predictable  
✅ Easier to add new actions later  
✅ Component cleaner and simpler  

---

## Issue #868 - Deduplicate Badge Rendering Logic

### Problem

AssetTypeBadge and ComplianceBadge share similar logic but are separate implementations, leading to drift.

### Solution

Create **components/ui/Badge.tsx** base component.

**Implementation:**

```typescript
// components/ui/Badge.tsx
import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  label: string;
  color: 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  icon,
  size = 'md',
  className,
  onClick,
  ariaLabel,
}) => {
  const colorClass = `badge--${color}`;
  const sizeClass = `badge--${size}`;

  return (
    <span
      className={`${styles.badge} ${styles[colorClass]} ${styles[sizeClass]} ${className || ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || label}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>
    </span>
  );
};
```

```css
/* components/ui/Badge.module.css */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.badge--primary {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.badge--success {
  background-color: #e8f5e9;
  color: #388e3c;
  border: 1px solid #81c784;
}

.badge--warning {
  background-color: #fff3e0;
  color: #f57c00;
  border: 1px solid #ffb74d;
}

.badge--error {
  background-color: #ffebee;
  color: #d32f2f;
  border: 1px solid #ef5350;
}

.badge--info {
  background-color: #f3e5f5;
  color: #7b1fa2;
  border: 1px solid #ce93d8;
}

.badge--sm {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
}

.badge--lg {
  padding: 0.5rem 1rem;
  font-size: 1rem;
}

.icon {
  display: inline-flex;
  align-items: center;
  width: 1em;
  height: 1em;
}

.label {
  line-height: 1;
}
```

**Updated AssetTypeBadge:**

```typescript
// components/asset/AssetTypeBadge.tsx
import { Badge, BadgeProps } from 'components/ui/Badge';

interface AssetTypeBadgeProps {
  type: 'token' | 'nft' | 'derivative';
  size?: 'sm' | 'md' | 'lg';
}

const typeConfig: Record<string, Omit<BadgeProps, 'size' | 'label'>> = {
  token: { color: 'primary', label: 'Token' },
  nft: { color: 'success', label: 'NFT', icon: '🖼️' },
  derivative: { color: 'warning', label: 'Derivative', icon: '📊' },
};

export const AssetTypeBadge: React.FC<AssetTypeBadgeProps> = ({ type, size = 'md' }) => {
  const config = typeConfig[type];
  return <Badge {...config} size={size} ariaLabel={`Asset type: ${config.label}`} />;
};
```

**Updated ComplianceBadge:**

```typescript
// components/compliance/ComplianceBadge.tsx
import { Badge, BadgeProps } from 'components/ui/Badge';

interface ComplianceBadgeProps {
  status: 'approved' | 'pending' | 'rejected' | 'flagged';
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, Omit<BadgeProps, 'size' | 'label'>> = {
  approved: { color: 'success', label: 'Approved', icon: '✓' },
  pending: { color: 'info', label: 'Pending', icon: '⏳' },
  rejected: { color: 'error', label: 'Rejected', icon: '✗' },
  flagged: { color: 'warning', label: 'Flagged', icon: '⚠️' },
};

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status];
  return <Badge {...config} size={size} ariaLabel={`Compliance status: ${config.label}`} />;
};
```

### Benefits

✅ DRY principle: single implementation  
✅ Consistency: visual/behavioral fixes propagate  
✅ Reusable: other components can use Badge too  
✅ Easier to test  

### Checklist

- [ ] Create components/ui/Badge.tsx base component
- [ ] Create Badge.module.css with color/size variants
- [ ] Update AssetTypeBadge to use Badge component
- [ ] Update ComplianceBadge to use Badge component
- [ ] Verify existing tests continue passing
- [ ] Add Badge.test.tsx with snapshot/behavior tests
