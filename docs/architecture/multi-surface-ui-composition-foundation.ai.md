# AI Companion: Multi-Surface UI Composition Foundation

## Core fact
Desktop, thin-client web, tablet, and mobile-responsive UI must share one presentation architecture with host-specific behavior isolated to `src/ui/desktop/*` and `src/ui/web/*`.

## Layer model

1. Host/runtime seam: `src/ui/desktop/*`, `src/ui/web/*`
2. Shared presentation seam: `src/ui/shared/*`, `src/ui/services/*`, `src/ui/state/*`, `src/ui/presenters/*`, `src/ui/components/*`
3. Surface shell seam: `src/ui/pages/*`, `src/ui/layout/*`, `src/ui/routes/*`, `src/ui/App.tsx`

Dependency direction:

- pages/layout/routes -> state/services/presenters/components/shared
- shared presentation must stay host-neutral
- page components must not call host bridges directly

## Folder responsibilities

- `src/ui/shared/*`: cross-surface clients/adapters by domain; host-neutral.
- `src/ui/desktop/*`: desktop-only runtime and bridge resolution seams.
- `src/ui/web/*`: thin-client URL/route helper seams.
- `src/ui/state/*`: page-facing state orchestration.
- `src/ui/presenters/*`: deterministic view-model shaping only.
- `src/ui/components/*`: reusable visual/interaction components.
- `src/ui/pages/*`: route-level shell composition and responsive layout.

## Keep this out of page components

- Business/domain policy logic
- API/IPC client construction and host endpoint resolution
- Shared data projection and cross-page state machines
- Authorization/policy recomputation already provided by backend contracts

## Desktop vs thin-client expectation

- Desktop: full authoring/admin shell with desktop host capabilities.
- Thin-client: constrained operational/admin shell, including mobile-responsive monitoring/light admin.
- Both surfaces must reuse shared services/stores/presenters.
- Host-specific specialization is limited to `src/ui/desktop/*` and `src/ui/web/*`.

## Placement workflow

1. Implement shared presentation logic first.
2. Implement/reuse shared components.
3. Compose into page shells.
4. Add host-specific adapter logic only where host/runtime behavior diverges.

## Canonical doc

See `docs/architecture/multi-surface-ui-composition-foundation.md`.


## Story 15.1.2 update
- Shared shell primitives + responsive region layouts are now documented in docs/architecture/multi-surface-ui-shell-primitives.md and implemented in src/ui/shared/components/shell/* with desktop/thin wrappers in src/ui/desktop/shell/* and src/ui/web/shell/*.
- New admin/operational pages should compose these primitives for header/regions/status/empty/guard containers rather than ad hoc shell structures.

## Story 15.1.3 update
- Shared route/navigation metadata and surface gating are now documented in docs/architecture/multi-surface-ui-navigation-metadata.md.
- Desktop admin, desktop operational, thin-client operational, and admin-lite route availability and navigation projections now derive from src/ui/routes/SurfaceRouteMetadataCatalog.ts plus shared contracts in src/ui/shared/navigation/SurfaceNavigationMetadata.ts.

## Story 15.1.4 update
- Shared presentation-state handling now lives in `src/ui/shared/components/presentation-state/*`.
- Converged page-state rendering should use `SurfaceStateBoundary`/`SurfaceStatePanel` for `loading`, `empty`, `not-found`, `disconnected`, `error`, and `permission-denied`.
- API error semantics should map through `toSurfacePresentationStateFromApiError` instead of page-local code checks.

