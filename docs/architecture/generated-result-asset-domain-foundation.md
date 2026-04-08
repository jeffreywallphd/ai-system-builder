# Generated Result Asset Domain Foundation

This note documents Stories 6.1.1 and 6.1.2 for the image manipulation vertical slice: generated execution outputs are modeled as authoritative, workspace-scoped result assets with explicit lifecycle, provenance, and logical asset linkage.

## Canonical files

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`

## Domain model

`GeneratedResultAsset` represents a produced image result as a durable platform resource and includes:

- identity and tenancy: `resultAssetId`, `workspaceId`, optional `ownerUserId`
- production lineage context: `source.runId`, `source.systemId`, `source.workflowId`, optional `source.workflowTemplateId`, optional `source.executionNodeId`, `source.outputSlot`
- upstream lineage: `lineage.inputAssetIds`
- durable lineage references:
  - workflow template snapshot pointers: `lineage.workflowTemplateVersionId`, `lineage.workflowTemplateVersionTag`
  - system snapshot pointers: `lineage.systemSnapshotId`, `lineage.systemVersionTag`
  - parameter snapshot pointer: `lineage.parameterSnapshotId`
  - execution trace pointers: `lineage.selectedNodeId`, `lineage.executionAdapterKind`, `lineage.executionBackendFamily`
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

## Lineage integrity and non-duplication posture

The lineage model is explicit but avoids copying canonical run/system/workflow records:

- `source` remains the primary identity pointer set for run/workflow/system/output-slot context.
- `lineage` stores query-oriented, immutable references to snapshots/versions used at execution time.
- lineage does not embed backend transport payloads or runtime-internal descriptors.

Additional lineage invariants:

- `lineage.workflowTemplateVersionId` and `lineage.workflowTemplateVersionTag` are required together.
- version tags use semantic version format (`<major>.<minor>.<patch>`).
- workflow-template version lineage requires `source.workflowTemplateId`.
- `lineage.selectedNodeId` must match `source.executionNodeId` when both are present.
- adapter/backend lineage fields are normalized to lowercase logical identifiers.

This enables later history/reuse/audit surfaces to explain provenance directly from result-asset records while still treating runs, systems, and workflows as authoritative sources of full detail.

This keeps generated results as first-class authoritative assets rather than backend-local files or UI-only artifacts.

## Boundary posture

- Domain-only implementation: no persistence adapter details, backend transport contracts, preview rendering implementation, or UI coupling.
- Explicit production-grade invariants for tenancy, visibility, lifecycle correctness, and provenance integrity.
- Extensible shape for later sharing/export/publication evolution without redesigning core identity or lifecycle contracts.
