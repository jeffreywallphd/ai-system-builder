# Multi-Surface UI Accessibility Foundations

This document defines the shared accessibility baseline introduced for Feature 15 / Epic 15.1 / Story 15.1.7.

## Scope

The baseline covers shared admin and operational shell surfaces for desktop and thin-client flows:

- keyboard navigation expectations for shared action wrappers and overlay menus
- route-change focus management and skip-link behavior
- landmark usage for shell regions
- live status and announcement semantics
- dialog/side-panel focus-trap expectations
- contributor requirements for future screen work

## Source locations

- Shared accessibility hooks/primitives: `src/ui/shared/accessibility/SurfaceAccessibility.tsx`
- Shared shell semantics: `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- Shared action semantics: `src/ui/shared/actions/SurfaceActionComponents.tsx`
- App-level route focus + announcements: `src/ui/layout/AppLayout.tsx`
- Navigation dialog focus behavior: `src/ui/components/navigation/CommandPalette.tsx`
- Shared accessibility styles: `src/ui/styles/app.css`

## Baseline behavior

1. Route changes should move focus to main content (`tabIndex={-1}` target) and emit a screen-reader announcement.
2. App shells should expose a skip link to main content for keyboard users.
3. Shared shell regions must use explicit landmarks:
- navigation regions use `<nav>`
- detail regions use `<aside>`
- content regions must have an accessible name or heading
4. Shared status containers should expose `role` and `aria-live` semantics:
- warning/neutral/success updates are polite
- danger/error updates are assertive alerts
5. Shared action menus must support keyboard operation and menu semantics:
- menu trigger advertises `aria-haspopup="menu"`
- menu list uses `role="menu"`
- actions expose `role="menuitem"`
- Escape closes the menu
6. Overlay dialogs/side panels should trap keyboard focus while open and restore focus when closed.

## Contributor requirements for new screens

When adding new admin/operational surfaces:

1. Use shared shell/action/accessibility primitives first; avoid per-page custom focus and ARIA wiring.
2. Ensure each route has one focusable main content landmark target and keep the skip-link destination stable.
3. Ensure dialogs and overlay panels have:
- a clear accessible name (`aria-label` or `aria-labelledby`)
- Escape-close behavior when appropriate
- focus restoration to the launching control
4. Expose non-visual state changes (loading, success, warning, failure) through live regions or shared status surfaces.
5. Add accessibility-oriented component tests for new primitives/semantics where static markup or seam-level behavior is testable.

## Test coverage

- `src/ui/shared/tests/SurfaceAccessibility.test.tsx`
- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/shared/tests/SurfaceActionComponents.test.tsx`
