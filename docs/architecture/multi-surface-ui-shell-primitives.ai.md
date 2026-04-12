# AI Companion: Multi-Surface UI Shell Primitives

## Core fact
Feature 15.1.2 adds shared shell primitives so desktop and thin-client admin/operational pages can use one layout vocabulary with explicit responsive and guard behavior.

## Primary files
- `src/ui/shared/components/shell/SurfaceShellPrimitives.tsx`
- `src/ui/shared/components/shell/index.ts`
- `src/ui/desktop/shell/DesktopSurfaceShell.tsx`
- `src/ui/desktop/shell/DesktopAdminSurfaceFrame.tsx`
- `src/ui/web/shell/ThinClientSurfaceShell.tsx`
- `src/ui/web/shell/ThinClientOperationalSurfaceFrame.tsx`
- `src/ui/styles/components/shell.css`

## What this provides
- app frame + header bar
- navigation/content/detail region containers
- status region container
- empty-state container
- permission guard for unauthorized/unavailable surface states

## How to apply
1. Compose shared shell primitives first.
2. Choose desktop or thin-client wrapper only when host-specific shell defaults are needed.
3. Keep business logic outside shell components.
4. Use `PermissionGuardContainer` instead of custom unauthorized/unavailable blocks.

## Responsive baseline
- Desktop: 3-column regions, detail collapses under content at medium widths.
- Thin-client: 2-column main regions with detail stacked below.
- Narrow screens: all regions stack via `ui-shell-regions--collapse`.

## Tests
- `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- `src/ui/desktop/shell/tests/DesktopAdminSurfaceFrame.test.tsx`
- `src/ui/web/shell/tests/ThinClientOperationalSurfaceFrame.test.tsx`

## Story 15.1.4 update
- Shared presentation-state seam is now in `src/ui/shared/components/presentation-state/*` (re-exported via `src/ui/shared/components/shell/index.ts`).
- Canonical state kinds now include: `loading`, `empty`, `not-found`, `disconnected`, `error`, `permission-denied`.
- Use `SurfaceStateBoundary` + `SurfaceStatePanel` for converged list/detail page-state rendering instead of per-page ad hoc status markup.
- Use `toSurfacePresentationStateFromApiError` to map API error semantics into UI state consistently across surfaces.

## Story 15.1.7 update
- Shell primitives now provide baseline accessibility semantics:
  - navigation regions render as `nav`
  - detail regions render as `aside`
  - header action groups expose toolbar semantics
  - status surfaces map tone to live-region alert behavior
- Desktop/thin wrappers now pass accessible frame labels so screen-reader users can identify active surface context.

## Story 15.3.1 update
- `DesktopAdminSurfaceFrame` now anchors a dedicated desktop administration shell entry in `src/ui/pages/DesktopAdministrationShellPage.tsx`.
- `ThinClientOperationalSurfaceFrame` now anchors the thin admin-lite entry in `src/ui/pages/AdminLiteEntryPage.tsx`.
- Both entry pages project available admin destinations from shared route metadata under strict session-derived access context (no page-local shortcut catalogs).
