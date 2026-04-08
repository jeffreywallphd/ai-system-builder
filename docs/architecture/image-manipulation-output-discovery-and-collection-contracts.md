# Image Manipulation Output Discovery and Collection Contracts

This note documents Story 3.1.4 for Feature 3 / Epic 3.1:
- output-discovery contracts for backend-reported generated artifacts
- collection-result contracts that preserve temporary backend output references while enabling later persistence and lineage work
- schema-versioned validation and parsing for adapter/application seams

## Purpose

Define one backend-agnostic seam for output discovery and collection so downstream services can persist generated media as managed logical assets with lineage, without treating backend file paths as product truth.

## Canonical implementation seam

- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- `src/application/image-workflows/tests/ImageManipulationOutputDiscoveryContracts.test.ts`

## Contract model

1. Output discovery snapshot (`ImageManipulationOutputDiscoverySnapshot`)
- identifies run/workspace/backend context
- records discovered output descriptors
- carries output slot-match semantics (`matched`, `fallback`, `unmatched`)
- carries media metadata (kind, MIME type, dimensions, size, digest)
- carries temporary backend references for short-lived backend handles/tokens/URIs

2. Discovered output descriptor (`ImageManipulationDiscoveredOutputDescriptor`)
- descriptor identity + ordering/group metadata
- output role (`primary`, `variant`, `intermediate`, `preview`)
- optional slot match to authored workflow outputs
- media metadata for preview and persistence planning
- temporary backend references for retrieval handoff

3. Collected execution result (`ImageManipulationCollectedExecutionResult`)
- binds to one discovery snapshot and run
- can carry optional normalized `collectionFailure` for partial/failed collection outcomes
- reports per-output collection records
- reports per-output persistence state (`not-persisted`, `persisted`, `failed`)
- reports summary counts for discovered/collected/persisted/not-persisted/failed

## Temporary references vs logical assets

Temporary backend references and final logical assets are modeled as distinct shapes:

- Temporary references:
  - `ImageManipulationTemporaryBackendReference`
  - backend-oriented handles/tokens/URIs only
  - used for output retrieval/collection and short-lived adapter handoff

- Final logical asset records:
  - `ImageManipulationCollectedLogicalAssetRecord`
  - `assetId`, logical asset reference, persistence timestamp, lineage id hooks
  - only present when persistence status is `persisted`

Temporary references are separate from final logical asset records.

## Boundary and safety rules

- Contracts reject raw filesystem paths in logical references and temporary backend handles.
- Local `file://` URIs are rejected in temporary backend references.
- Output discovery and collection summary counts are validated for consistency.
- Collected records must point to discovered descriptors by id.
- `partially-collected` and `failed` statuses must include a normalized `collectionFailure`.
- `collected` status must not include `collectionFailure`.
- `collectionFailure.partialOutputCount` cannot exceed discovered output count.
- No backend filesystem path assumptions are exposed beyond the adapter/application seam.

## Story 3.3.2 failure normalization alignment
- Added `createImageManipulationOutputCollectionFailure(...)` so output-collection anomaly mapping reuses the same normalized failure posture as dispatch and progress polling:
  - machine-readable failure code/category/retryability
  - user-safe summary/message
  - sanitized diagnostics for developers/admins

## Story 3.3.3 ComfyUI adapter collection implementation

Implemented adapter-side collection for completed ComfyUI jobs:

- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts` (`queryPromptHistory`)

Behavior:
- Reads Comfy prompt history output records for a completed backend run.
- Discovers image artifacts and maps them to `ImageManipulationDiscoveredOutputDescriptor` records.
- Maps output slot matching from expected backend fields into `matched` / `fallback` / `unmatched`.
- Produces `ImageManipulationCollectedExecutionResult` records with temporary backend handles and `not-persisted` persistence state for later managed-asset registration.
- Explicitly normalizes abnormal scenarios:
  - missing discoverable outputs -> `failed` + `collectionFailure`
  - malformed/unsafe output references -> `partially-collected` + `collectionFailure`

Known assumptions:
- Current collection scope is image artifacts; non-image backend artifacts are intentionally excluded.
- Slot matching currently uses backend-field/node-id hints with deterministic order fallback when exact node mapping is not available.
- Temporary backend object handles are retrieval hints only and are never treated as final logical asset identity.

## Relationship to adjacent architecture notes

- Execution application ports:
  - `docs/architecture/image-manipulation-execution-application-ports.md`
- Translation contracts:
  - `docs/architecture/image-manipulation-translation-contracts.md`
- ComfyUI adapter boundary posture:
  - `docs/architecture/comfyui-adapter-audit.md`
