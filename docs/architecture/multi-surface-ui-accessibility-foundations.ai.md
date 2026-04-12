# AI Companion: Multi-Surface UI Accessibility Foundations

## Core fact
Story 15.1.7 establishes shared accessibility and focus-management foundations so admin and operational shells are keyboard-usable and screen-reader-friendly by default.

## Primary files
- `src/ui/shared/accessibility/SurfaceAccessibility.tsx`
- `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- `src/ui/shared/actions/SurfaceActionComponents.tsx`
- `src/ui/layout/AppLayout.tsx`
- `src/ui/components/navigation/CommandPalette.tsx`
- `src/ui/styles/app.css`

## What this provides
- route-change focus handling + route announcements
- skip-link and visually hidden live-region primitives
- dialog/side-panel focus trap + focus restoration helper
- shell landmark semantics (`nav`, `aside`, named content regions)
- status-region `role` + `aria-live` defaults
- shared action-menu keyboard/menu semantics

## Contributor usage rules
1. Reuse shared accessibility primitives before adding per-page keyboard/focus wiring.
2. Keep one stable main-content focus target per route (`tabIndex={-1}`).
3. Keep overlay dialogs/panels named and focus-managed (trap + restore).
4. Use shared status/live-region semantics for non-visual updates.
5. Add accessibility-oriented component tests when touching shared primitives.

## Tests
- `src/ui/shared/tests/SurfaceAccessibility.test.tsx`
- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/shared/tests/SurfaceActionComponents.test.tsx`
