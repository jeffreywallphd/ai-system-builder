# AI Companion: Multi-Surface UI Responsive Conventions

## Core fact
Story 15.1.6 standardizes breakpoint, density, touch target, panel collapse, and interaction conventions so desktop and thin-client surfaces share one responsive foundation.

## Primary files
- `src/ui/shared/responsive/SurfaceResponsiveTokens.ts`
- `src/ui/shared/responsive/useSurfaceResponsiveProfile.ts`
- `src/ui/shared/components/shell/SurfaceResponsiveConventions.tsx`
- `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- `src/ui/shared/actions/SurfaceActionComponents.tsx`
- `src/ui/styles/components/responsive-conventions.css`

## Canonical responsive classes
- `mobile` (`<=767`): touch, comfortable density, stacked panels, card tables, sheet actions.
- `tablet` (`768-1023`): touch, comfortable density, collapsed-detail split panels, compact rows.
- `desktop` (`>=1024`): pointer, compact density by default, split panels, menu actions.
- `desktop compact` (`<=1279`): split with collapsed detail.

## Usage flow
1. Resolve profile with `useSurfaceResponsiveProfile`.
2. Pass profile to shared shells/actions and responsive wrappers.
3. Apply wrapper contracts:
   - `ui-responsive-table` + `ui-responsive-table__table`
   - `ui-responsive-form` + `ui-responsive-form__grid`
   - `ui-responsive-status-cards` + `ui-responsive-status-cards__grid`
4. Keep route/page logic free of local breakpoint branching where shared profile rules already exist.

## Guardrails
- Do not create separate visual systems for mobile vs desktop.
- Keep responsive decisions presentation-only; no domain/authorization logic in responsive wrappers.
- Prefer profile-driven composition over inline media-query behavior in page components.
- Ensure narrow table card mode cells include `data-label` for readable, accessible field context.

## Tests
- `src/ui/shared/tests/SurfaceResponsiveTokens.test.ts`
- `src/ui/shared/tests/SurfaceResponsiveConventions.test.tsx`
- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/shared/tests/SurfaceActionComponents.test.tsx`

