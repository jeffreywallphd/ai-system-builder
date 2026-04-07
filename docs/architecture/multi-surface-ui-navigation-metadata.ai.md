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

## Story 15.3.1 update
- New canonical admin entry points:
  - `admin-shell` -> `/settings/admin` (desktop administration shell)
  - `admin-lite-shell` -> `/settings/admin-lite` (thin admin-lite entry)
- Route access now enforces metadata with strict session context in `AppRouter.tsx` via `SurfaceProtectedRoute`.
- Admin-lite navigation scope is now intentionally lightweight; full desktop administration flows stay desktop-first.
- Command palette and settings shortcuts now consume strict session-derived availability context so unauthorized users cannot discover protected admin destinations through shortcut UIs.

## Story 15.3.6 update
- Added governance review route keys:
  - `governance-review` -> `/settings/governance-review`
  - `governance-review-thin` -> `/settings/governance-review/thin`
- Metadata access policy:
  - desktop governance review: `owner|admin` + `log.read` + required workspace context
  - thin governance review: `owner|admin|member` + `system.read` + required workspace context
- Strict route gating in `AppRouter.tsx` now covers governance review routes to block unauthorized direct-route access.

## Story 15.3.7 update
- Admin-lite entry (`src/ui/pages/AdminLiteEntryPage.tsx`) now renders a bounded lightweight workflow catalog only (approval, status review, limited membership actions, policy/governance inspection, trusted-device oversight).
- Desktop-only administration areas remain intentionally excluded from admin-lite route discovery and are explicitly listed in entry-page escalation guidance.
- Strict metadata + `SurfaceProtectedRoute` route access enforcement remains authoritative and unchanged; this story refines workflow clarity and boundary signaling for thin-client administration.
