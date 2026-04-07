# AI Companion: Multi-Surface UI Navigation Metadata

## Core fact
Story 15.1.3 centralizes navigation grouping, surface eligibility, and route access gating into shared metadata so desktop and thin-client shells do not carry scattered route rules.

## Primary files
- `src/ui/shared/navigation/SurfaceNavigationMetadata.ts`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/IntentNavigationShell.ts`
- `src/ui/routes/ContextNavigation.ts`
- `src/ui/routes/CommandPalette.ts`
- `src/ui/pages/SettingsPage.tsx`

## Metadata model
- Route grouping (`primary`, `operations`, `administration`, etc.)
- Surface eligibility (`desktop-admin`, `desktop-operational`, `thin-client-operational`, `admin-lite`)
- Role/capability/workspace context gating
- Shared navigation projections for shell, settings shortcuts, and command palette

## How to extend
1. Add/update route keys and paths in `RouteConfig.ts`.
2. Add/update metadata overrides in `SurfaceRouteMetadataCatalog.ts`.
3. Keep gating in metadata instead of adding ad hoc checks in pages/components.
4. Reuse catalog helpers for navigation and route-section resolution.
5. Update tests:
   - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
   - `src/ui/shared/tests/SurfaceNavigationMetadata.test.ts`
