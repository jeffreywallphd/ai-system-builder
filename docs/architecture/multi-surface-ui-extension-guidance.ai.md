# AI Companion: Multi-Surface UI Extension Guidance

## Purpose

Story 15.1.8 baseline for Feature 15 / Epic 15.1: define durable contributor rules for adding admin and operational screens across desktop, thin-client, and mobile-responsive surfaces.

## Canonical seams

- Shell/presentation state: `src/ui/shared/components/shell/*`, `src/ui/shared/components/presentation-state/*`
- Action model: `src/ui/shared/actions/*`
- Responsive conventions: `src/ui/shared/responsive/*`
- Accessibility foundations: `src/ui/shared/accessibility/*`
- Navigation metadata: `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- Shared/state/presenter/page seams: `src/ui/shared/*`, `src/ui/services/*`, `src/ui/state/*`, `src/ui/presenters/*`, `src/ui/pages/*`
- Host-specific adapters only: `src/ui/desktop/*`, `src/ui/web/*`

## Required extension flow

1. Add/update route metadata first.
2. Implement shared client/service/state/presenter seams.
3. Compose page via shared shell/state/action primitives.
4. Apply shared responsive and accessibility conventions.
5. Add/update tests for metadata, state, and page behavior.

## Placement rules

- Shared and reusable behavior belongs in `src/ui/shared`, `src/ui/services`, `src/ui/state`, `src/ui/presenters`, and `src/ui/components`.
- Route composition belongs in `src/ui/pages`.
- Desktop/web folders are for host/runtime adapters only, not shared feature logic.

## Realtime contributor rule

- For operational dashboard/run/queue surfaces, use shared connectivity indicators from `src/ui/shared/operations/OperationalRealtimeIndicators.tsx` for live/stale/reconnecting/disconnected messaging and refresh/reconnect affordances.
- Keep websocket/reconnect orchestration centralized in shared service/page-state seams (for example `RuntimeRealtimeSubscriptionService` + page orchestration), never in individual panel components.

## Prohibited patterns

1. Host/runtime bypass logic in page components.
2. Page-local transport/storage authority for converged protected/admin flows.
3. Ad hoc replacement of shared state/action/presentation seams in converged areas.
4. Route-gating duplication outside metadata catalogs.
5. Bespoke responsive/accessibility behavior that skips shared foundations.

## Non-negotiable converged-area rule

Bypassing shared presentation/state patterns for converged areas is prohibited without documented justification.

Required justification: bypassed seam, impact, convergence plan, and traceable PR/doc link.

## Canonical doc

See `docs/architecture/multi-surface-ui-extension-guidance.md`.

## Connectivity-state tests

- Add or update connectivity-state rendering coverage in shared operational UI suites and include `src/ui/shared/tests/OperationalRealtimeIndicators.test.tsx` when extending operational realtime behavior.

## Story 15.3.8 contributor regression baseline

For admin/admin-lite changes, maintain representative coverage across these prioritized flows:

- workspace administration: `src/ui/pages/tests/WorkspaceAdministrationPage.test.tsx`
- trusted device and session oversight boundaries: `src/ui/pages/tests/TrustedDevicesPage.test.tsx`
- node approval and inventory boundaries: `src/ui/pages/tests/NodeEnrollmentReviewPage.test.tsx`, `src/ui/pages/tests/NodeInventoryPage.test.tsx`
- security-policy selection and read/write boundaries: `src/ui/pages/tests/SecurityPolicyConfigurationPage.test.tsx`
- governance/audit query behavior: `src/ui/shared/admin/tests/GovernanceAuditReviewModel.test.ts`
- strict route/surface gating: `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`, `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
