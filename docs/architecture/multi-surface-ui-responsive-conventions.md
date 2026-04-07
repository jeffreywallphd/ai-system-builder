# Multi-Surface UI Responsive Tokens and Interaction Conventions

This document defines Story 15.1.6 implementation guidance for responsive tokens, density, touch targets, scrolling regions, panel collapse behavior, and cross-surface adaptation rules.

## Scope

These conventions establish one shared visual system across desktop authoring/admin and thin-client operational/admin surfaces, including mobile-responsive monitoring and lightweight administration.

## Source locations

- Responsive profile contracts and breakpoint helpers: `src/ui/shared/responsive/SurfaceResponsiveTokens.ts`
- Responsive profile hook for runtime composition: `src/ui/shared/responsive/useSurfaceResponsiveProfile.ts`
- Shared responsive wrappers for table/form/status/action conventions: `src/ui/shared/components/shell/SurfaceResponsiveConventions.tsx`
- Shared shell panel layout integration: `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- Shared action menu responsive integration: `src/ui/shared/actions/SurfaceActionComponents.tsx`
- CSS token and convention styles:
  - `src/ui/styles/tokens.css`
  - `src/ui/styles/components/responsive-conventions.css`
  - `src/ui/styles/components/actions.css`

## Canonical breakpoints

- `mobile`: `<= 767px`
- `tablet`: `768px - 1023px`
- `desktop`: `>= 1024px`
- `desktop compact detail-collapse threshold`: `<= 1279px`

Use `toSurfaceViewport` and `createSurfaceResponsiveProfile` instead of page-local breakpoint branching when route or component behavior depends on viewport class.

## Density and touch-target conventions

- Mobile/tablet default to `comfortable` density and `touch` interaction with a minimum touch target of `44px`.
- Desktop defaults to `compact` density and `pointer` interaction with a minimum control target of `36px`.
- Thin-client shells may request desktop `comfortable` density for constrained operational workflows that prioritize tap accuracy.

## Adaptation conventions by pattern

- Tables:
  - mobile: `cards`
  - tablet: `rows-compact`
  - desktop: `rows` (or `rows-compact` in compact desktop widths)
- Forms:
  - mobile/tablet: `stacked`
  - desktop: `split`
- Status cards:
  - mobile: `stacked`
  - tablet/desktop: `grid`
- Action menus:
  - mobile: `sheet`
  - tablet/desktop: `menu`
- Panel layouts:
  - mobile: `stacked`
  - tablet and compact desktop: `split-with-collapsed-detail`
  - wide desktop: `split`

## Scrolling and panel-collapse conventions

- Mobile uses document-first scrolling and stacked panel composition.
- Tablet and desktop use panel-level scrolling by default.
- Navigation is `collapsible` on mobile/tablet and `inline` on desktop.
- Detail panels collapse beneath primary content on tablet and compact desktop widths.

## Contributor usage guidance

1. Resolve a shared responsive profile with `useSurfaceResponsiveProfile` in shell/page composition roots.
2. Pass the profile into shared primitives (`SurfaceRegionLayout`, action wrappers, responsive pattern containers) rather than branching ad hoc in JSX.
3. Use responsive wrapper class contracts:
  - `.ui-responsive-table` + `.ui-responsive-table__table`
  - `.ui-responsive-form` + `.ui-responsive-form__grid`
  - `.ui-responsive-status-cards` + `.ui-responsive-status-cards__grid`
4. For card-mode tables, add `data-label` on table cells to preserve accessible field labeling on narrow surfaces.
5. Keep business and authorization logic outside responsive conventions; responsive profile values should only drive presentation and interaction layout decisions.

## Tests

- `src/ui/shared/tests/SurfaceResponsiveTokens.test.ts`
- `src/ui/shared/tests/SurfaceResponsiveConventions.test.tsx`
- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/shared/tests/SurfaceActionComponents.test.tsx`

