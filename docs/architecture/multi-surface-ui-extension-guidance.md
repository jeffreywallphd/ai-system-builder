# Multi-Surface UI Extension Guidance

## Story alignment

- Feature: 15, Multi-Surface UI Foundations for Admin and Operational Flows
- Epic: 15.1, Establish Shared Multi-Surface UI Architecture and Design Foundations
- Story: 15.1.8, Document the UI foundation rules and extension patterns for future feature work

## Purpose

Define the production-facing rules for adding new admin and operational screens across desktop authoring/admin, thin-client operational/admin, and mobile-responsive monitoring/light administration.

This guide is normative for converged UI work.

## Canonical implementation seams

- Shell and layout primitives: `src/ui/shared/components/shell/*`
- Presentation-state primitives: `src/ui/shared/components/presentation-state/*`
- Shared action model and wrappers: `src/ui/shared/actions/*`
- Shared responsive profile/tokens: `src/ui/shared/responsive/*`
- Shared accessibility hooks/primitives: `src/ui/shared/accessibility/*`
- Shared clients and transport adapters: `src/ui/shared/*`
- Page-facing services: `src/ui/services/*`
- Page-facing state orchestration: `src/ui/state/*`
- Pure view-model shaping: `src/ui/presenters/*`
- Route metadata and projections: `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- Route and navigation consumers: `src/ui/routes/*`
- Desktop shell adapters: `src/ui/desktop/shell/*`
- Thin-client shell adapters: `src/ui/web/shell/*`

## Screen extension workflow

For every new admin or operational screen, apply this order:

1. Define or update route metadata in `SurfaceRouteMetadataCatalog.ts`:
   - set route group and title
   - set `eligibleSurfaces`
   - set required roles/capabilities/workspace context
   - set navigation projection visibility (primary/settings/command palette)
2. Add or reuse shared client/service seams in `src/ui/shared/*` and `src/ui/services/*`.
3. Add or reuse `src/ui/state/*` orchestration for loading, action execution, and refresh.
4. Add or reuse `src/ui/presenters/*` for deterministic display shaping.
5. Compose screen structure through shared shell primitives and presentation-state boundaries.
6. Define user operations through shared action descriptors and wrappers.
7. Apply shared responsive profile conventions instead of page-local breakpoint branching.
8. Apply shared accessibility foundations for landmarks, route focus, live status, and keyboard menu behavior.
9. Add or update tests that cover metadata gating, state behavior, and representative rendered states.

## Shared vs surface-specific placement rules

Use this placement contract for new code:

- `src/ui/shared/*`:
  - cross-surface transport clients/adapters
  - shared operation contracts and host-neutral helpers
- `src/ui/services/*`:
  - page-facing orchestration over shared clients/use-case seams
- `src/ui/state/*`:
  - page-facing async state and intent orchestration
- `src/ui/presenters/*`:
  - deterministic read-model to view-model shaping
- `src/ui/components/*`:
  - reusable visual/interaction components
- `src/ui/pages/*`:
  - route-bound composition of shared seams only
- `src/ui/desktop/*`:
  - desktop bridge/runtime capability and host-specific shell adaptation
- `src/ui/web/*`:
  - thin-client route/origin helpers and host-specific shell adaptation

Do not place cross-surface business logic or shared state orchestration in `src/ui/desktop/*` or `src/ui/web/*`.

## Navigation metadata rules

- Route access and surface eligibility must be metadata-driven through `SurfaceRouteMetadataCatalog.ts`.
- Page components must not hardcode role/capability surface-gating matrices for canonical routes.
- Navigation shells, settings shortcuts, and command palette entries must derive from route metadata projections.
- New route entries must preserve one-record-per-route-key coverage.

## State and presentation rules for converged areas

- Use shared `SurfaceStateBoundary` and `SurfaceStatePanel` seams for loading, empty, not-found, disconnected, error, and permission-denied rendering.
- Use `toSurfacePresentationStateFromApiError` for API error to presentation-state mapping.
- Use shared action descriptors and wrappers (`SurfaceActionButtonStrip`, `SurfaceActionMenu`, `SurfaceActionList`) for page/row/bulk actions.
- For realtime operational surfaces, use shared connectivity seams from `src/ui/shared/operations/OperationalRealtimeIndicators.tsx` for:
  - live vs stale marker rendering,
  - reconnect/disconnected visibility language,
  - refresh/reconnect affordances.
- Keep websocket/reconnect orchestration in shared service/page-state seams (for example `RuntimeRealtimeSubscriptionService` + page-level orchestration), not in individual panel components.
- Keep page components focused on composition and intent delegation. Keep business semantics in services/state/presenters/backends.

For converged areas, bypassing shared presentation/state patterns is prohibited without documented justification.

## Responsive and accessibility baseline

- Resolve and pass a shared responsive profile for shell/action/table/form/status composition.
- Preserve shared touch-target, density, and panel-collapse conventions from `src/ui/shared/responsive/*`.
- Preserve route focus target behavior, skip-link baseline, landmark semantics, and live-status behavior from shared accessibility seams.
- New overlay/dialog interactions must include keyboard-close and focus-restoration behavior.

## Prohibited patterns

Do not introduce these anti-patterns in new admin/operational screen work:

1. Host/runtime bypass from page components:
   - direct desktop bridge usage, endpoint resolution, or host capability branching in `src/ui/pages/*`
2. Screen-local transport or storage authority:
   - direct `fetch`/API construction in pages for converged flows
   - client-local storage treated as authoritative for protected/admin state
3. Page-local replacement of shared state/action/presentation seams for converged areas:
   - ad hoc loading/error/permission patterns
   - ad hoc action permission/capability gating logic
4. Duplicated route-gating logic outside navigation metadata:
   - surface/role/capability matrices copied into pages/components
5. Accessibility and responsive regressions from bespoke page wiring:
   - skipping shared responsive profile conventions
   - skipping route-focus/landmark/live-region/menu keyboard behavior

## Allowed exceptions and justification requirements

An exception is only allowed when a requirement is strictly host-specific or when a shared seam cannot satisfy a proven constraint.

Required documentation for any exception in converged areas:

1. State exactly which shared seam is being bypassed and why.
2. Record user-impact and cross-surface impact.
3. Record rollback or convergence plan.
4. Link the justification in the story PR and architecture-doc update for traceability.

Without this documentation, the exception is non-compliant.

## Minimum regression expectations

When extending admin/operational screens, keep these suites updated as relevant:

- route metadata and gating:
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/shared/tests/SurfaceNavigationMetadata.test.ts`
- shared state/action/responsive/accessibility seams:
  - `src/ui/shared/tests/SurfacePresentationState.test.tsx`
  - `src/ui/shared/tests/SurfaceActionModel.test.ts`
  - `src/ui/shared/tests/SurfaceActionComponents.test.tsx`
  - `src/ui/shared/tests/SurfaceResponsiveTokens.test.ts`
  - `src/ui/shared/tests/SurfaceResponsiveConventions.test.tsx`
  - `src/ui/shared/tests/SurfaceAccessibility.test.tsx`
  - `src/ui/shared/tests/SurfaceShellPrimitives.test.tsx`
- representative page-level integration:
  - update or add `src/ui/pages/tests/*` suites for affected surfaces
- realtime operational connectivity:
  - `src/ui/shared/tests/OperationalRealtimeIndicators.test.tsx`
  - update affected dashboard/run/queue shared-surface suites to assert live/stale/reconnecting/disconnected rendering behavior

## Related docs

- `docs/architecture/multi-surface-ui-composition-foundation.md`
- `docs/architecture/multi-surface-ui-shell-primitives.md`
- `docs/architecture/multi-surface-ui-navigation-metadata.md`
- `docs/architecture/multi-surface-ui-action-model.md`
- `docs/architecture/multi-surface-ui-responsive-conventions.md`
- `docs/architecture/multi-surface-ui-accessibility-foundations.md`
- `docs/architecture/presentation-and-state.md`
