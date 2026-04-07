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
