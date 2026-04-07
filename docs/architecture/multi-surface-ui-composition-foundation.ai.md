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


## Story 15.1.5 update
- Shared action semantics now live in `src/ui/shared/actions/*` and are documented in `docs/architecture/multi-surface-ui-action-model.md`.
- New admin/operational page actions should be descriptor-driven and rendered via shared wrappers (`SurfaceActionButtonStrip`, `SurfaceActionMenu`, `SurfaceActionList`) rather than page-local action branching.
- Permission, surface-capability, confirmation, and telemetry behavior should be declared in action descriptors so desktop/thin surfaces reuse one operation model.

## Story 15.1.6 update
- Shared responsive tokens, breakpoints, and interaction profile helpers now live in `src/ui/shared/responsive/*` and are documented in `docs/architecture/multi-surface-ui-responsive-conventions.md`.
- Shared responsive wrappers for table/form/status/action container conventions now live in `src/ui/shared/components/shell/SurfaceResponsiveConventions.tsx`.
- Shell and action primitives now accept shared responsive profiles so desktop and thin-client compositions can apply one density/stacking/navigation behavior model across viewport classes.

## Story 15.1.7 update
- Shared accessibility/focus foundations now live in `src/ui/shared/accessibility/*` and are documented in `docs/architecture/multi-surface-ui-accessibility-foundations.md`.
- Route-level focus/announcement behavior and skip-link baseline are now applied in `src/ui/layout/AppLayout.tsx`.
- Shared shell/action seams now carry landmark/live-region/menu keyboard semantics so accessibility behavior is standardized before page-specific UI work.

## Story 15.1.8 update
- Canonical contributor extension rules now live in `docs/architecture/multi-surface-ui-extension-guidance.md`.
- New admin/operational screens now follow metadata-first route gating, shared state/presentation/action seams, and shared responsive/accessibility conventions by default.
- Bypassing shared presentation/state seams in converged areas is explicitly prohibited unless justification is documented in PR + architecture updates.

## Story 15.2.2 update
- Shared operational run list/detail-status panels now live in `src/ui/shared/operations/OperationalRunMonitoringPanels.tsx` and are composed by `src/ui/pages/RunPage.tsx` for desktop and thin-client operational surfaces.
- Run visibility and status monitoring now use authoritative runtime queue/status/result/trace reads plus persisted execution-run detail projection reads on the same shared page composition.
- Run actions (`refresh`, `inspect`, `cancel`, `dequeue`) now render through shared action descriptor wrappers for permission-aware behavior across both operational surfaces.

## Story 15.2.3 update
- Shared queue visibility/filter/detail seams now live in `src/ui/shared/operations/OperationalQueueMonitoringPanels.tsx` with queue row models, visibility-scope filters, and responsive table-card rendering.
- `RunPage` now composes queue scope filters into authoritative queue list reads and renders selected queue detail in the same desktop/thin operational shell.
- Queue actions (`refresh`, `inspect`, `cancel`, `dequeue`) now run through shared action descriptors/wrappers for permission-aware queue workflows across surfaces.

## Story 15.2.5 update
- Shared result-review seams now live in `src/ui/shared/operations/OperationalResultReviewPanels.tsx` with reusable output cards, result detail panels, protected preview/download action components, and explicit protected-state messaging.
- `RunPage` now composes result review for desktop and thin-client operational surfaces using authoritative runtime result metadata and protected asset workflow APIs (`getAssetDetail`, `resolvePreview`, `authorizeDownload`) through `AssetWorkflowService`.
- Protected asset interactions stay logical and server-mediated (tokenized preview/download paths), with clear restricted/unavailable UX states and no raw file-path assumptions.

## Story 15.2.6 update
- Shared operational realtime indicator seams now live in `src/ui/shared/operations/OperationalRealtimeIndicators.tsx`:
  - `OperationalRealtimeBanner` for consistent reconnect/disconnected/stale visibility plus refresh/reconnect affordances.
  - `OperationalRealtimeStatusPill` for inline live-vs-stale panel markers.
- `RunPage` now keeps reconnect orchestration centralized at page/service integration level (single reconnect trigger over `RuntimeRealtimeSubscriptionService`) instead of per-panel websocket/reconnect logic.
- Dashboard/run/queue operational surfaces now consume the same indicator seam (`OperationalWorkspaceDashboard`, run monitoring panels, queue monitoring panels) so connection-state rendering is consistent across desktop and thin-client layouts.
- Connectivity-state regression coverage now includes shared indicator rendering assertions (`src/ui/shared/tests/OperationalRealtimeIndicators.test.tsx`) plus updated dashboard/run/queue shared-surface tests.
