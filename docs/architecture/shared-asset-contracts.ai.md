# Shared Asset Contracts

## Purpose

Define canonical shared asset contract boundaries for identity, taxonomy, interface shape, selection semantics, and lineage posture under workspace/storage authority.

## Scope Boundaries

In scope:
- Shared asset contract model and projection seams.
- Asset identity/taxonomy/contract consistency requirements.
- Asset selection and representation boundaries used across studios and APIs.

Out of scope:
- Endpoint-level transport contracts.
- Studio-specific page composition behavior.
- Run lifecycle scheduling and dispatch policy.

## Canonical Asset Contract Posture

- Shared asset contract types remain canonical in `src/domain/contracts/AssetContract.ts`.
- Contract projection remains application-owned through `src/application/contracts/CompositionAssetContractResolver.ts`.
- Contract projections are taxonomy-driven and must fail closed for unsupported combinations.
- Shared contracts describe usage/interface shape, not runtime execution policy.

## Asset Selection and Representation Guardrails

- Asset selectors and read projections must preserve canonical asset identity and lineage metadata.
- Presentation layers may reshape labels and summaries but cannot redefine contract or tenancy truth.
- API surfaces may transport contract data but cannot become alternate contract authorities.

## Split Routing for Previously Mixed Content

The prior version of this document mixed workspace/storage, API, and studio concerns. Canonical authority is now split as follows:

- Workspace asset model and selection authority:
  - `docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md`
- API/transport contract authority:
  - `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md`
- Studio composition authority:
  - `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
- Execution handoff authority:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
