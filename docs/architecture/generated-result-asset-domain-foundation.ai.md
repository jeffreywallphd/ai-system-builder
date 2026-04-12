# AI Companion: Generated Result Asset Domain Foundation

## What this slice adds

Stories 6.1.1, 6.1.2, and 6.1.3 introduce a dedicated domain model for generated image result assets so execution outputs become authoritative platform resources with explicit lifecycle, lineage, and protected preview/derivative contracts.

## Canonical files

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDerivativeDomain.test.ts`
- `docs/architecture/generated-result-asset-domain-foundation.md`

## Modeled contract

`GeneratedResultAsset` carries:

- logical result identity + tenancy (`resultAssetId`, `workspaceId`, optional `ownerUserId`)
- provenance to execution context (`runId`, `systemId`, `workflowId`, optional `workflowTemplateId`, optional `executionNodeId`, `outputSlot`)
- upstream logical input lineage (`lineage.inputAssetIds`)
- durable provenance references (`lineage.workflowTemplateVersionId`, `lineage.workflowTemplateVersionTag`, `lineage.systemSnapshotId`, `lineage.systemVersionTag`, `lineage.parameterSnapshotId`, `lineage.selectedNodeId`, `lineage.executionAdapterKind`, `lineage.executionBackendFamily`)
- storage references (`storageInstanceId`, optional logical `storageBindingReference`)
- visibility/sharing posture (`visibility`, optional `sharingPolicyRef`)
- audit metadata (`createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`)
- lifecycle metadata (`pending-collection`, `available`, `preview-ready`, `failed-collection`, `archived`)

## Core invariants

- status-specific lifecycle metadata is strictly validated
- invalid lifecycle transitions throw `GeneratedResultAssetLifecycleTransitionError`
- private visibility requires owner identity
- shared/published visibility requires sharing policy references
- storage binding references must remain logical (`storage-instance://...`) and cannot carry filesystem paths
- result asset and upstream lineage ids are canonical logical asset ids
- persisted/preview/archived states require explicit logical asset version linkage
- lineage cannot self-reference the result asset id
- workflow-template version lineage requires both id + semantic version tag
- workflow-template version lineage requires a bound `source.workflowTemplateId`
- lineage selected node must match `source.executionNodeId` when both are provided
- adapter/backend lineage fields are normalized as lowercase logical identifiers

Story 6.1.3 derivative/preview invariants:

- preview and derivative descriptors are mapped to `resultAssetId` (and optional `resultLogicalAssetVersionId`) rather than replacing original result-asset identity
- `presentationRole` separates `preview` contracts from broader derivative contracts
- preview role requires explicit logical preview kinds (`thumbnail`, `display-safe`, `history-safe`)
- derivative availability lifecycle supports deferred/on-demand generation and regeneration (`pending`, `available`, `failed`, `stale`)
- available/stale descriptors require protected access metadata; pending/failed descriptors cannot expose access handles
- derivative access descriptors reject filesystem paths and `storage-instance://...` values to prevent raw storage layout leakage
- stale descriptors require explicit refreshed metadata so regeneration state is queryable without mutating result identity

## Integration posture

The result model is integrated with existing logical asset semantics, not a disconnected parallel type:

- canonical asset-id validation aligns with logical asset contracts
- persistence completion is represented through logical asset version identity (`logicalAssetVersionId`)
- lifecycle progression models the transition from pending collection to durable availability and preview readiness

Lineage references intentionally avoid copying full run/system/workflow payloads:

- run/workflow/system identities remain in `source` as authoritative pointers
- lineage captures immutable snapshot references and execution-family metadata needed for audit/history/reuse queries
- this keeps provenance queryable without duplicating canonical records owned by run/system domains

## Downstream usage posture

The lineage shape is designed for later:

- result history timelines (showing run, workflow template version, system snapshot, and inputs)
- reuse flows (reapplying parameter snapshots and workflow-template/system context)
- audit/admin views (explaining selected node and adapter/backend family without exposing backend transport internals)

The preview/derivative shape is designed for later:

- gallery/history panes that need protected, safe-to-render preview handles separate from original-content access flows
- asynchronous preview generation workers that can materialize, fail, refresh, and regenerate derivatives over time
- retrieval APIs that authorize against protected resource IDs and return logical preview handles, not storage topology

## Related posture note

- Story 6.1.5 authoritative persistence/preview/lineage posture: `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`

## Boundary posture

- Domain-only implementation.
- No persistence/storage adapter implementation details.
- No backend transport bindings.
- No preview generation mechanics.
- No UI coupling.

This keeps Feature 6 aligned with authoritative run and logical asset architecture established in Features 1 and 3-5.
