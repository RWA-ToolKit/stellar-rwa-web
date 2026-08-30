## Summary

<!-- 1-3 bullet points explaining what this PR does and why -->

## Changes

<!-- Describe the changes made in this PR -->

## Testing

<!-- How was this tested? What test cases were added/updated? -->

## Checklist

- [ ] **Tests added or updated** — Pure-function tests in `lib/__tests__/*.test.ts` follow `lib/__tests__/format.test.ts` pattern; component tests in `components/**/*.test.tsx` use `@testing-library/react` with `screen.getByRole()` for accessibility-first assertions
- [ ] **Accessible interactive elements** — New interactive elements (buttons, inputs, links, menus) have appropriate ARIA roles and accessible names; verified via `screen.getByRole()` in tests
- [ ] **Typecheck passes** — `npm run typecheck` produces no errors
- [ ] **Lint passes** — `npm run lint` produces no errors
- [ ] **Tests pass** — `npm test` passes, new tests verify the change works
- [ ] **Build succeeds** — `npm run build` completes without errors

## Notes

<!-- Optional: any blockers, assumptions, or follow-up work -->
