# Multi-Surface UI Navigation Metadata and Route Gating

This document defines the canonical navigation metadata model introduced for Feature 15 / Epic 15.1 / Story 15.1.3.

## Scope

The metadata model centralizes:

- route grouping for shared desktop and thin-client shells
- surface eligibility for desktop-admin, desktop-operational, thin-client-operational, and admin-lite
- capability and role gating requirements
- workspace-context requirements
- reusable navigation projections (primary shell, settings shortcuts, command palette)

## Source locations

- Shared contracts and gating helpers: `src/ui/shared/navigation/SurfaceNavigationMetadata.ts`
- Canonical route metadata catalog: `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- Route path constants and legacy route definitions: `src/ui/routes/RouteConfig.ts`
- Consumers updated to use metadata:
  - `src/ui/routes/IntentNavigationShell.ts`
  - `src/ui/routes/ContextNavigation.ts`
  - `src/ui/routes/CommandPalette.ts`
  - `src/ui/pages/SettingsPage.tsx`

## Canonical metadata shape

Each route metadata record includes:

- `key`, `path`, `title`
- `group` (`authentication`, `primary`, `studio`, `operations`, `administration`, `onboarding`, `system`)
- `access`
  - `eligibleSurfaces`
  - `requiredRoles` (workspace role keys)
  - `requiredCapabilities` (permission/capability keys)
  - `workspaceContext` (`none`, `optional`, `required`)
- `navigation`
  - `showInPrimaryNavigation`
  - `showInSettingsNavigation`
  - `showInCommandPalette`
  - optional command palette label/description/keywords/order
  - optional `shellSection` (`build`, `explore`, `run`)

## Contributor guidance

When adding or changing routes:

1. Keep `ROUTE_PATHS` and `APP_ROUTES` in `RouteConfig.ts` aligned with the route tree.
2. Add or update the route entry in `routeMetadataOverrides` in `SurfaceRouteMetadataCatalog.ts`.
3. Define surface eligibility and access gating in metadata, not in page or shell components.
4. Route shell behavior and navigation projections should consume catalog helpers:
   - `listPrimaryNavigationRouteMetadata`
   - `listSettingsShortcutRouteMetadata`
   - `listCommandPaletteRouteEntries`
   - `resolveRouteSurfaceMetadataByPath`
5. Add or update tests under:
   - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
   - `src/ui/shared/tests/SurfaceNavigationMetadata.test.ts`

## Testing expectations

Route metadata changes should verify:

- one metadata record exists for every app route key
- shell section derivation remains coherent for build/explore/run surfaces
- admin and operational shortcut projections are derived from metadata
- capability/role/workspace gating evaluates as expected in strict mode
