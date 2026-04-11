# Presentation and State

## Purpose

Define renderer composition and presentation-state boundaries for studio and product surfaces without mixing runtime-host, control-plane, or storage-governance authority.

## Scope Boundaries

In scope:
- UI composition boundaries in `src/ui/composition`, `src/ui/services`, `src/ui/state`, and `src/ui/presenters`.
- Page-facing state management contracts and presenter/view-model shaping seams.
- Multi-surface placement boundaries for shared, desktop, and web UI code.

Out of scope:
- Runtime host bootstrap and preload bridge composition contracts.
- Run lifecycle state authority, scheduling policy, and dispatch outcomes.
- Workspace/storage tenancy authority and asset lineage governance.

## Canonical Renderer Composition Contract

- `src/ui/composition/createUiDependencies.ts` is the renderer composition root.
- `src/ui/composition/AppProviders.tsx` is the startup orchestration seam for authenticated UI dependencies.
- `src/ui/services/*` remain presentation-facing adapters over application ports.
- `src/ui/state/*` remain page-facing state managers; business authority stays in domain/application layers.
- `src/ui/presenters/*` own view-model shaping and user-facing summary projection.

## Multi-Surface Placement Contract

Canonical multi-surface UI layering and placement rules are defined in:
- `docs/architecture/multi-surface-ui-composition-foundation.md`

Required boundary posture:
- Shared UI logic belongs in `src/ui/shared/*`.
- Desktop-specific integrations belong in `src/ui/desktop/*`.
- Thin-client/web-specific integrations belong in `src/ui/web/*`.
- Pages compose state/services/presenters; they do not own runtime or domain policy logic.

## Split Routing for Previously Mixed Content

The prior version of this document mixed multiple architecture domains. Canonical authority is now split as follows:

- Studio and composition contracts:
  - `docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.md`
  - `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
- Execution control-plane and workflow handoff contracts:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`
- Runtime host assembly/startup contracts:
  - `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`

## Related ADRs

- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
