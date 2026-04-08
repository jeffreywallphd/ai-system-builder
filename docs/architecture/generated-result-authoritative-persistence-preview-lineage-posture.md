# Generated Result Authoritative Persistence, Preview, and Lineage Posture

## Story scope

Story 6.1.5 documents the authoritative posture for turning image-manipulation execution outputs into first-class AI Loom assets instead of backend-local files or UI-local artifacts.

This note is the seam contract for follow-on gallery/history, sharing, export, and admin work.

## Canonical implementation seams in this slice

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/shared/contracts/assets/GeneratedResultTransportContracts.ts`
- `src/shared/schemas/assets/GeneratedResultTransportSchemaContracts.ts`
- `src/shared/dto/assets/GeneratedResultPersistenceDtos.ts`

## Authoritative resource posture

Generated outputs are authoritative only after they are represented as a `GeneratedResultAsset` with:

- canonical logical result identity (`resultAssetId`)
- workspace/ownership and visibility posture
- durable lineage pointers back to run/system/workflow/execution-node and input assets
- storage instance linkage (`storageInstanceId`, optional logical `storageBindingReference`)
- lifecycle status progression from collection -> persistence -> preview readiness

Backend output discovery handles from execution adapters are operational handoff metadata, not authoritative asset identity.

## Preview-safe retrieval posture

Preview access is modeled as derivative descriptors bound to `resultAssetId` (and optional result logical asset version), not as separate ad-hoc assets.

Preview retrieval contracts must:

- expose protected logical handles (`protectedResourceId`, `accessHandle`)
- avoid leaking filesystem paths or storage topology
- keep pending/failed preview states explicit without access handles
- preserve preview kinds (`thumbnail`, `display-safe`, `history-safe`) for gallery/history-safe rendering

Original-result retrieval remains a separate protected-access flow with explicit purpose and expiry metadata.

## Lineage posture

Lineage is explicit and queryable without duplicating canonical records from other domains:

- source pointers: `runId`, `systemId`, `workflowId`, optional `workflowTemplateId`, optional `executionNodeId`, `outputSlot`
- immutable provenance references: workflow-template version, system snapshot/version tag, parameter snapshot, selected node, adapter/backend family
- upstream source assets: `lineage.inputAssetIds`

Lineage records relationships and snapshot references needed for audit/history/reuse, while run/workflow/system domains remain authoritative for full state.

## Layer responsibilities and boundaries

`Domain + shared contract layers` own:

- generated-result aggregate and derivative invariants
- lifecycle legality and lineage integrity rules
- external API DTO/schema contracts
- persistence DTO shape for adapter-facing records

`Application layer` (follow-on stories) should own:

- authoritative orchestration of result collection/finalization
- policy-checked preview/original access mediation
- read/query use cases for list/get/by-run and lineage endpoints

`Infrastructure + host composition` (follow-on stories) should own:

- repository/storage adapter implementations
- protected-access handle minting/opening
- preview generation/materialization pipelines
- wiring generated-result services into server host composition

## Non-goals in this story

- no generated-result repository implementation
- no generated-result backend API handler implementation
- no preview generation worker implementation
- no UI gallery/history integration

## Dependencies and references (Features 1-5)

- Feature 1 image asset authority and protected retrieval: `docs/architecture/image-asset-feature-1-final-baseline.md`
- Feature 2 workflow/system authority and persistence: `docs/architecture/image-workflow-system-persistence-and-repositories.md`
- Feature 3 execution adapter output-discovery boundaries: `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- Feature 4 authoritative run lifecycle and output-handoff posture: `docs/architecture/image-run-feature-4-final-baseline.md`
- Feature 5 execution-node routing/readiness context: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Feature 6 domain/contracts foundations: `docs/architecture/generated-result-asset-domain-foundation.md`, `docs/architecture/generated-result-api-contracts.md`

## Follow-on implementation checklist

- Keep generated-result identity and lineage logical-id based across transport/storage boundaries.
- Keep preview access authorization-centered and storage-path-opaque.
- Keep storage adapters and preview pipelines replaceable behind typed ports.
- Keep run/workflow/system/input lineage pointers immutable once a result becomes durable.

