# Issues #866, #865 - Frontend Hook & Component Consolidation

## Issue #866 - Consolidate Freighter Error Handling

### Problem

Freighter API errors handled independently in hooks/useWallet.tsx and hooks/useTx.ts; risk of inconsistent error messages.

### Current State

```typescript
// hooks/useWallet.tsx
function handleFreighterError(error) {
  if (error.message.includes('denied')) { ... }
  if (error.message.includes('not installed')) { ... }
  // Custom mapping v1
}

// hooks/useTx.ts
function mapFreighterError(error) {
  if (error.code === 'USER_DENIED') { ... }
  if (error.code === 'EXTENSION_NOT_FOUND') { ... }
  // Custom mapping v2 (different!)
}
```

### Solution

**Create lib/freighterErrors.ts:**

```typescript
// lib/freighterErrors.ts

export enum FreighterErrorType {
  DENIED = "DENIED",
  NOT_INSTALLED = "NOT_INSTALLED",
  NOT_ENABLED = "NOT_ENABLED",
  NETWORK_MISMATCH = "NETWORK_MISMATCH",
  SIGN_ERROR = "SIGN_ERROR",
  RPC_ERROR = "RPC_ERROR",
  UNKNOWN = "UNKNOWN",
}

export interface FreighterErrorDetails {
  type: FreighterErrorType;
  message: string;
  userMessage: string; // User-facing message
  recoveryHint?: string;
  code?: string; // Original Freighter error code
}

/**
 * Map Freighter API errors to standardized error details
 * Used by all hooks to ensure consistent error messaging
 */
export function parseFreighterError(error: any): FreighterErrorDetails {
  const originalError = error?.message || error?.toString() || "Unknown error";

  // Check error codes (Freighter SDK uses these)
  if (error?.code) {
    switch (error.code) {
      case "EXTENSION_NOT_INSTALLED":
        return {
          type: FreighterErrorType.NOT_INSTALLED,
          message: originalError,
          userMessage: "Freighter wallet not installed. Install from freighter.app",
          recoveryHint: "Visit freighter.app to download the extension",
          code: error.code,
        };

      case "EXTENSION_NOT_ENABLED":
        return {
          type: FreighterErrorType.NOT_ENABLED,
          message: originalError,
          userMessage: "Freighter is installed but not enabled. Enable it in your browser.",
          recoveryHint: "Check your browser extensions and ensure Freighter is enabled",
          code: error.code,
        };

      case "USER_REJECTED_REQUEST":
      case "USER_DENIED":
        return {
          type: FreighterErrorType.DENIED,
          message: originalError,
          userMessage: "You rejected the request. Please try again if you want to proceed.",
          code: error.code,
        };

      case "NETWORK_MISMATCH":
        return {
          type: FreighterErrorType.NETWORK_MISMATCH,
          message: originalError,
          userMessage: "Network mismatch. Please switch Freighter to the correct network.",
          recoveryHint: "Open Freighter and switch to the correct Stellar network",
          code: error.code,
        };

      case "SIGNING_ERROR":
        return {
          type: FreighterErrorType.SIGN_ERROR,
          message: originalError,
          userMessage: "Failed to sign transaction. Please try again.",
          code: error.code,
        };

      case "RPC_ERROR":
        return {
          type: FreighterErrorType.RPC_ERROR,
          message: originalError,
          userMessage: "Network error. Please check your connection and try again.",
          recoveryHint: "Verify your internet connection and try again",
          code: error.code,
        };
    }
  }

  // Check error messages (fallback for unstructured errors)
  const msg = originalError.toLowerCase();

  if (msg.includes("not installed") || msg.includes("extension not found")) {
    return {
      type: FreighterErrorType.NOT_INSTALLED,
      message: originalError,
      userMessage: "Freighter wallet not installed. Install from freighter.app",
      recoveryHint: "Visit freighter.app to download the extension",
    };
  }

  if (msg.includes("denied") || msg.includes("rejected")) {
    return {
      type: FreighterErrorType.DENIED,
      message: originalError,
      userMessage: "You rejected the request. Please try again if you want to proceed.",
    };
  }

  if (msg.includes("network") || msg.includes("chain")) {
    return {
      type: FreighterErrorType.NETWORK_MISMATCH,
      message: originalError,
      userMessage: "Network mismatch. Please check your Freighter settings.",
      recoveryHint: "Open Freighter and switch to the correct Stellar network",
    };
  }

  if (msg.includes("sign") || msg.includes("transaction")) {
    return {
      type: FreighterErrorType.SIGN_ERROR,
      message: originalError,
      userMessage: "Failed to sign transaction. Please try again.",
    };
  }

  // Unknown error
  return {
    type: FreighterErrorType.UNKNOWN,
    message: originalError,
    userMessage: "An unexpected error occurred. Please try again.",
    recoveryHint: "Contact support if the problem persists",
  };
}

/**
 * Check if error is user-initiated (e.g., user rejected request)
 * Used to suppress error notifications for expected user actions
 */
export function isUserInitiatedError(error: FreighterErrorDetails): boolean {
  return error.type === FreighterErrorType.DENIED;
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(error: FreighterErrorDetails): boolean {
  return ![
    FreighterErrorType.NOT_INSTALLED,
    FreighterErrorType.NOT_ENABLED,
  ].includes(error.type);
}
```

**Update hooks/useWallet.tsx:**

```typescript
import { parseFreighterError, isUserInitiatedError } from "lib/freighterErrors";

export function useWallet() {
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      const publicKey = await freighter.connect();
      return publicKey;
    } catch (err) {
      const details = parseFreighterError(err);
      
      // Don't show error notification for user-rejected requests
      if (!isUserInitiatedError(details)) {
        setError(details.userMessage);
      }
      
      throw details;
    }
  }, []);

  return { connect, error };
}
```

**Update hooks/useTx.ts:**

```typescript
import { parseFreighterError, isRecoverableError } from "lib/freighterErrors";

export function useTx() {
  const handleSignAndSubmit = useCallback(async (tx: Transaction) => {
    try {
      const signed = await freighter.signTransaction(tx);
      return submitTransaction(signed);
    } catch (err) {
      const details = parseFreighterError(err);
      
      // Log recoverable errors for retry UX
      if (isRecoverableError(details)) {
        console.warn(`Recoverable: ${details.userMessage}`);
      }
      
      throw details;
    }
  }, []);

  return { handleSignAndSubmit };
}
```

**Create lib/__tests__/freighterErrors.test.ts:**

```typescript
import { parseFreighterError, FreighterErrorType, isUserInitiatedError } from "lib/freighterErrors";

describe("freighterErrors", () => {
  it("maps EXTENSION_NOT_INSTALLED code", () => {
    const error = new Error("Extension not found");
    error.code = "EXTENSION_NOT_INSTALLED";

    const details = parseFreighterError(error);
    expect(details.type).toBe(FreighterErrorType.NOT_INSTALLED);
    expect(details.userMessage).toContain("freighter.app");
  });

  it("maps USER_DENIED code", () => {
    const error = new Error("User rejected");
    error.code = "USER_DENIED";

    const details = parseFreighterError(error);
    expect(details.type).toBe(FreighterErrorType.DENIED);
    expect(isUserInitiatedError(details)).toBe(true);
  });

  it("maps message patterns (fallback)", () => {
    const error = new Error("Freighter extension not installed");
    const details = parseFreighterError(error);
    expect(details.type).toBe(FreighterErrorType.NOT_INSTALLED);
  });

  it("handles unknown errors gracefully", () => {
    const error = new Error("Something weird happened");
    const details = parseFreighterError(error);
    expect(details.type).toBe(FreighterErrorType.UNKNOWN);
    expect(details.userMessage).toBeTruthy();
  });
});
```

### Checklist

- [ ] Create lib/freighterErrors.ts with error mapping
- [ ] Update hooks/useWallet.tsx to use parseFreighterError
- [ ] Update hooks/useTx.ts to use parseFreighterError
- [ ] Create freighterErrors.test.ts with test cases
- [ ] Verify existing tests still pass
- [ ] Update error handling in any other hooks
- [ ] Document error types in comments

---

## Issue #865 - Extract Duplicated Loading/Error/Empty State Logic

### Problem

AssetDetailView and PortfolioView each implement similar loading/error/empty branching; risk of UX divergence.

### Current State

```typescript
// components/asset/AssetDetailView.tsx
export function AssetDetailView() {
  const { asset, loading, error } = useAsset(id);

  if (loading) return <Skeleton />;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!asset) return <div>No asset found</div>;

  return <AssetDetail asset={asset} />;
}

// components/portfolio/PortfolioView.tsx
export function PortfolioView() {
  const { portfolio, loading, error } = usePortfolio();

  if (loading) return <Skeleton />;  // Different Skeleton style?
  if (error) return <ErrorAlert>{error}</ErrorAlert>;  // Different component!
  if (!portfolio) return <EmptyState />;  // Different UX!

  return <Portfolio portfolio={portfolio} />;
}
```

### Solution

**Create hooks/useAsyncView.ts (Higher-order hook):**

```typescript
import { ReactNode } from "react";

export interface AsyncViewState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncViewReturn<T> extends AsyncViewState<T> {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  retry: () => void;
}

/**
 * Higher-order hook that wraps async data fetching with consistent state management
 * Provides loading, error, and empty state handling
 */
export function useAsyncView<T>(
  asyncFn: () => Promise<T>,
  dependencies: any[] = []
): UseAsyncViewReturn<T> {
  const [state, setState] = useState<AsyncViewState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFn();
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [asyncFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData, retryCount, ...dependencies]);

  return {
    ...state,
    isLoading: state.loading,
    isError: state.error !== null,
    isEmpty: !state.loading && !state.error && state.data === null,
    retry: () => setRetryCount((c) => c + 1),
  };
}
```

**Create components/ui/AsyncBoundary.tsx (Wrapper component):**

```typescript
import { ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";

export interface AsyncBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  isEmpty: boolean;
  retry: () => void;
  children: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: (error: Error, retry: () => void) => ReactNode;
  emptyComponent?: ReactNode;
}

/**
 * Standardized async state rendering wrapper
 * Ensures consistent UX for loading, error, and empty states across all views
 */
export const AsyncBoundary: React.FC<AsyncBoundaryProps> = ({
  isLoading,
  isError,
  error,
  isEmpty,
  retry,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
}) => {
  if (isLoading) {
    return loadingComponent || <Skeleton height="400px" />;
  }

  if (isError) {
    return (
      errorComponent?.(error || new Error("Unknown error"), retry) || (
        <ErrorState
          title="Failed to load"
          message={error?.message || "An unexpected error occurred"}
          onRetry={retry}
        />
      )
    );
  }

  if (isEmpty) {
    return emptyComponent || <EmptyState message="No data available" />;
  }

  return <>{children}</>;
};
```

**Refactor AssetDetailView:**

```typescript
import { AsyncBoundary } from "components/ui/AsyncBoundary";
import { useAsset } from "hooks/useAsset";

export function AssetDetailView({ assetId }: { assetId: string }) {
  const { data: asset, isLoading, isError, error, isEmpty, retry } = useAsset(assetId);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={isEmpty}
      retry={retry}
    >
      <AssetDetail asset={asset!} />
    </AsyncBoundary>
  );
}
```

**Refactor PortfolioView:**

```typescript
import { AsyncBoundary } from "components/ui/AsyncBoundary";
import { usePortfolio } from "hooks/usePortfolio";

export function PortfolioView() {
  const { data: portfolio, isLoading, isError, error, isEmpty, retry } = usePortfolio();

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={isEmpty}
      retry={retry}
      emptyComponent={<PortfolioEmptyState />}
    >
      <Portfolio portfolio={portfolio!} />
    </AsyncBoundary>
  );
}
```

**Create components/ui/Skeleton.tsx (Reusable):**

```typescript
export interface SkeletonProps {
  height?: string;
  width?: string;
  count?: number;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = "20px",
  width = "100%",
  count = 3,
  circle = false,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded"
          style={{
            height: circle ? width : height,
            width: circle ? width : width,
            borderRadius: circle ? "50%" : undefined,
          }}
        />
      ))}
    </div>
  );
};
```

**Create components/ui/ErrorState.tsx:**

```typescript
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Error",
  message,
  onRetry,
}) => {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900 p-4">
      <h3 className="font-semibold text-red-900 dark:text-red-100">{title}</h3>
      <p className="text-sm text-red-800 dark:text-red-200 mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
};
```

**Create components/ui/EmptyState.tsx:**

```typescript
export interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = "No data found",
  icon,
  action,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
```

### Checklist

- [ ] Create hooks/useAsyncView.ts
- [ ] Create components/ui/AsyncBoundary.tsx
- [ ] Create components/ui/Skeleton.tsx (if not exists)
- [ ] Create components/ui/ErrorState.tsx
- [ ] Create components/ui/EmptyState.tsx
- [ ] Refactor AssetDetailView to use AsyncBoundary
- [ ] Refactor PortfolioView to use AsyncBoundary
- [ ] Update all similar views across the app
- [ ] Verify existing tests still pass
- [ ] No behavior changes; only refactoring

## Benefits

✅ Single source of truth for error/loading UX  
✅ Consistent experience across all data-fetching views  
✅ Less boilerplate in components  
✅ Easier to update loading/error UI globally  
