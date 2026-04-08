# Generated Result Asset Domain Foundation

This note documents Story 6.1.1 for the image manipulation vertical slice: generated execution outputs are modeled as authoritative, workspace-scoped result assets with explicit lifecycle, provenance, and logical asset linkage.

## Canonical files

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`

## Domain model

`GeneratedResultAsset` represents a produced image result as a durable platform resource and includes:

- identity and tenancy: `resultAssetId`, `workspaceId`, optional `ownerUserId`
- production lineage context: `source.runId`, `source.systemId`, `source.workflowId`, optional `source.workflowTemplateId`, optional `source.executionNodeId`, `source.outputSlot`
- upstream lineage: `lineage.inputAssetIds`
- storage references: `storageInstanceId`, optional `storageBindingReference`
- protection posture: `visibility`, optional `sharingPolicyRef`
- audit metadata: `createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`
- lifecycle metadata: `pending-collection`, `available`, `preview-ready`, `failed-collection`, `archived`

## Lifecycle invariants

The model enforces explicit state semantics:

- `pending-collection`:
  - represents discovered/declared output before persistence is completed
  - cannot include persistence, preview, failure, or archived metadata
- `available`:
  - requires `logicalAssetVersionId`, `persistedAt`, `persistedBy`
  - cannot include preview, failure, or archived metadata
- `preview-ready`:
  - requires persisted metadata and `previewReadyAt`/`previewReadyBy`
  - `previewReadyAt` cannot be earlier than `persistedAt`
- `failed-collection`:
  - requires `failedAt`, `failedBy`, `failureCode`, `failureMessage`
  - cannot include persistence, preview, or archived metadata
- `archived`:
  - requires persisted metadata and `archivedAt`/`archivedBy`
  - `archivedAt` cannot be earlier than `persistedAt` or `previewReadyAt` when present

Allowed transitions are explicit:

- `pending-collection -> available | failed-collection`
- `available -> preview-ready | archived`
- `preview-ready -> archived`
- `failed-collection -> pending-collection`
- `archived` is terminal

## Integration posture with logical assets

Generated result assets integrate with the logical asset model by design:

- `resultAssetId` is validated as canonical logical asset id format
- `lineage.inputAssetIds` are canonical logical asset ids
- persistence completion requires explicit logical asset version linkage (`logicalAssetVersionId`)
- storage references are logical (`storage-instance://...`) and reject filesystem paths

This keeps generated results as first-class authoritative assets rather than backend-local files or UI-only artifacts.

## Boundary posture

- Domain-only implementation: no persistence adapter details, backend transport contracts, preview rendering implementation, or UI coupling.
- Explicit production-grade invariants for tenancy, visibility, lifecycle correctness, and provenance integrity.
- Extensible shape for later sharing/export/publication evolution without redesigning core identity or lifecycle contracts.
