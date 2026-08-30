# Component Authoring Guide

Every component in this codebase should handle four distinct states: **loading**, **empty**, **error**, and **success**. These states ensure components degrade gracefully and communicate their status clearly to all users, including those using assistive technology.

## The Four-State Pattern

### 1. Loading State
Show a skeleton, spinner, or placeholder while data is being fetched. Use the existing `CardSkeletonGrid` or `Spinner` components to maintain visual consistency.

```tsx
{loading && <CardSkeletonGrid count={6} />}
```

### 2. Error State
When a fetch fails, render the `ErrorState` component with a descriptive message and optional retry affordance.

```tsx
{error && <ErrorState message={error} onRetry={refetch} />}
```

The `ErrorState` component automatically sets `role="alert"` with `aria-live="assertive"`, ensuring screen readers announce the error immediately.

### 3. Empty State
When a query returns no results, show the `EmptyState` component instead of blank space. This tells users the absence of data is expected, not a bug.

```tsx
{data.length === 0 && (
  <EmptyState
    title="No assets found"
    description="Try adjusting your filters."
  />
)}
```

### 4. Success State
Render the actual content only when data is available and no errors occurred.

```tsx
{!loading && !error && data.length > 0 && (
  <MyContentComponent data={data} />
)}
```

## Complete Example

```tsx
"use client";

import { useMyData } from "@/hooks/useMyData";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

export function MyComponent() {
  const { data, loading, error, refetch } = useMyData();

  return (
    <div>
      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState title="No data" description="Try adding some." />
      ) : (
        <ContentGrid data={data} />
      )}
    </div>
  );
}
```

## Accessibility Conventions

This codebase follows these accessibility patterns to ensure components work for all users:

### Roles and Live Regions
- **`role="alert"` + `aria-live="assertive"`**: Use for error messages that need immediate announcement
- **`role="status"` + `aria-live="polite"`**: Use for loading states and success confirmations
- **`role="heading"` (implicit via `<h1>`, `<h2>`, etc.)**: Use semantic heading elements for all titles

### Buttons with Icons
Buttons that contain only an icon must have an accessible label:

```tsx
<button aria-label="Dismiss" onClick={handleDismiss}>
  ✕
</button>
```

### Form Navigation
Navigation menus should have an `aria-label`:

```tsx
<nav aria-label="Pagination">
  {/* page buttons */}
</nav>
```

Current page buttons should indicate state:

```tsx
<button aria-current={isCurrentPage ? "page" : undefined}>
  {pageNumber}
</button>
```

### Testing
All components should be tested using accessible queries:

```tsx
import { render, screen } from "@testing-library/react";

it("renders content when data loads", () => {
  render(<MyComponent />);
  expect(screen.getByRole("heading", { name: /my title/i })).toBeInTheDocument();
});

it("announces error state to screen readers", () => {
  render(<MyComponent />);
  expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
});
```

Prefer `getByRole()` over `getByTestId()` — role-based queries ensure your component remains accessible.

## Checklist for New Components

- [ ] Loading state renders while data fetches (via skeleton, spinner, or placeholder)
- [ ] Error state renders with `ErrorState` and a retry option if applicable
- [ ] Empty state renders with `EmptyState` when query returns no results
- [ ] Success state renders actual content only when data is available
- [ ] All buttons containing only icons have `aria-label`
- [ ] Error alerts use `role="alert"` with `aria-live="assertive"`
- [ ] Loading/success status use `role="status"` with `aria-live="polite"`
- [ ] All headings use semantic elements (`<h1>`, `<h2>`, etc.)
- [ ] Navigation menus have `aria-label` describing their purpose
- [ ] Components are tested via accessible role queries, not `getByTestId()`
