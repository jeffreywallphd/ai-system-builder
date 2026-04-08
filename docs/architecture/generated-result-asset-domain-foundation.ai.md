# AI Companion: Generated Result Asset Domain Foundation

## What this slice adds

Story 6.1.1 introduces a dedicated domain model for generated image result assets so execution outputs become authoritative platform resources with explicit lifecycle and lineage.

## Canonical files

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`
- `docs/architecture/generated-result-asset-domain-foundation.md`

## Modeled contract

`GeneratedResultAsset` carries:

- logical result identity + tenancy (`resultAssetId`, `workspaceId`, optional `ownerUserId`)
- provenance to execution context (`runId`, `systemId`, `workflowId`, optional `workflowTemplateId`, optional `executionNodeId`, `outputSlot`)
- upstream logical input lineage (`lineage.inputAssetIds`)
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

## Integration posture

The result model is integrated with existing logical asset semantics, not a disconnected parallel type:

- canonical asset-id validation aligns with logical asset contracts
- persistence completion is represented through logical asset version identity (`logicalAssetVersionId`)
- lifecycle progression models the transition from pending collection to durable availability and preview readiness

## Boundary posture

- Domain-only implementation.
- No persistence/storage adapter implementation details.
- No backend transport bindings.
- No preview generation mechanics.
- No UI coupling.

This keeps Feature 6 aligned with authoritative run and logical asset architecture established in Features 1 and 3-5.
