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
