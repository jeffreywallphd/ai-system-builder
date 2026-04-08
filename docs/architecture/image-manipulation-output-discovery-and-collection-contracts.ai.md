# AI Companion: Image Manipulation Output Discovery and Collection Contracts

## What this slice adds

Story 3.1.4 introduces schema-versioned application contracts for:
- backend output discovery (descriptor-level records with slot matching and media metadata)
- collected execution results (temporary reference handling and persistence outcome reporting)

This keeps ComfyUI (and future backends) behind adapter boundaries and prepares outputs for managed logical asset persistence + lineage.

## Canonical files

- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- `src/application/image-workflows/tests/ImageManipulationOutputDiscoveryContracts.test.ts`
- `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`

## Discovery contract coverage

`ImageManipulationOutputDiscoverySnapshot` and discovered output descriptors include:
- run/workspace/backend identifiers
- discovered output descriptors
- output role and ordering/group metadata
- output slot-match status (`matched` / `fallback` / `unmatched`)
- media metadata for persistence/preview/lineage planning
- temporary backend references (token/object/URI handles)

## Collection contract coverage

`ImageManipulationCollectedExecutionResult` includes:
- discovery linkage (`discoveryId`) and execution/run identity
- optional normalized `collectionFailure` for partial/failed collection outcomes
- per-output collected records keyed by discovered descriptor id
- per-output persistence state:
  - `not-persisted`
  - `persisted` (with logical asset record)
  - `failed`
- summary counts for discovered/collected/persisted/not-persisted/failed

## Separation posture

- Temporary references are kept in `ImageManipulationTemporaryBackendReference`.
- Final asset registration is kept in `ImageManipulationCollectedLogicalAssetRecord`.
- These are not merged into one ambiguous reference type.
- This preserves a clean progression: backend discovery -> collection -> logical asset persistence + lineage.

## Validation and safety posture

- strict schema version: `1.0.0`
- parser helpers reject unsupported versions
- raw filesystem path leakage is rejected in logical references and backend handles
- local `file://` URIs are rejected for temporary backend references
- summary counts and descriptor mapping integrity are validated
- `partially-collected` / `failed` statuses require `collectionFailure`
- `collected` status rejects `collectionFailure`
- `collectionFailure.partialOutputCount` is bounded by discovered output count

## Story 3.3.2 failure-normalization update
- Added helper for output-collection anomaly normalization:
  - `createImageManipulationOutputCollectionFailure(...)`
  - backed by shared failure utility in `ImageManipulationFailureNormalization.ts`
- Output collection failures now reuse the same normalized model as dispatch/progress paths:
  - machine code/category/retryability
  - user-safe summary/message
  - sanitized developer diagnostics

## Architectural boundary posture

- Contracts live at the adapter/application seam, not UI transport.
- Contracts avoid backend directory-layout assumptions.
- Contracts carry enough metadata for later persistence, preview generation, and lineage recording without making ComfyUI a source of truth.
