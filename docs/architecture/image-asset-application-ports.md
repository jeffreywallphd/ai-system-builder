# Image Asset Application Repository and Storage Ports

This note documents Story 1.1.4 for the image manipulation vertical slice: application-layer repository and managed-storage interfaces for logical image asset metadata and binary content workflows.

## Canonical files

- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/ports/index.ts`
- `src/application/image-assets/use-cases/ImageAssetCreationUseCaseContracts.ts`
- `src/application/image-assets/use-cases/ImageAssetMetadataReadUseCaseContracts.ts`
- `src/application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts.ts`
- `src/application/image-assets/use-cases/FinalizeImageAssetUploadUseCase.ts`
- `src/application/image-assets/use-cases/GetImageAssetMetadataUseCase.ts`
- `src/application/image-assets/use-cases/GetImageAssetOriginalContentUseCaseContracts.ts`
- `src/application/image-assets/use-cases/GetImageAssetOriginalContentUseCase.ts`
- `src/application/image-assets/use-cases/InitiateImageAssetCreationUseCase.ts`
- `src/application/image-assets/use-cases/ListImageAssetMetadataUseCase.ts`
- `src/application/image-assets/use-cases/index.ts`
- `src/application/image-assets/index.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
- `src/application/image-assets/tests/InitiateImageAssetCreationUseCase.test.ts`
- `src/application/image-assets/tests/FinalizeImageAssetUploadUseCase.test.ts`
- `src/application/image-assets/tests/GetImageAssetMetadataUseCase.test.ts`
- `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts`
- `src/application/image-assets/tests/ListImageAssetMetadataUseCase.test.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceMigrations.ts`
- `src/infrastructure/persistence/image-assets/ImageAssetPersistenceMapper.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter.ts`
- `src/infrastructure/persistence/image-assets/tests/SqliteImageAssetPersistenceAdapter.test.ts`
- `src/infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`

## Repository port contract

`IImageAssetRepository` now provides metadata persistence seams for image assets:

- create image asset
- save/update image asset
- find by id (with optional include-deleted behavior)
- list by workspace-scoped query filters
- archive image asset
- soft-delete image asset

Mutation inputs include explicit operation metadata (`operationKey`, actor, correlation/reason, expected revision) so idempotency and concurrency controls can be implemented by infrastructure adapters without leaking persistence details into use cases.

## Managed storage port contract

`IImageAssetStoragePort` now provides backend-neutral content operations for image assets:

- reserve logical storage location in a managed storage instance
- write object content from byte buffer or async stream
- open protected read stream by purpose (`download-original`, `inline-preview`, `export`, `worker-process`)
- generate/resolve mediated access handles (opaque token claims)
- delete content using lifecycle reason semantics

Storage references are logical only (`storageInstanceId`, `objectKey`, optional `objectVersionId`) and keep filesystem layout details out of application contracts.

## Boundary guarantees

- Use cases can persist image metadata and binary content through application ports.
- No use-case contract depends on raw filesystem paths.
- Port design is compatible with server-managed local, mounted/shared, and sync-oriented storage backends.

## Test coverage

`ImageAssetPortsContracts.test.ts` includes in-memory contract checks validating that representative adapters can satisfy the new repository and storage interfaces for create/update/list/archive/delete and reserve/write/read/access/delete flows.

`InitiateImageAssetCreationUseCase.test.ts` covers Story 1.2.1 initiation flow behavior for:

- create/initiate success with workspace/user ownership and managed storage reservation
- storage auto-selection when no explicit storage instance is requested
- clean rejection for unauthorized workspace actors and non-admin owner delegation
- clean rejection for authorization-policy denial and invalid request payloads

## Story 1.2.1: storage-backed image asset creation use case

This story adds the authoritative application use case that initializes logical image asset ingestion before binary content upload:

- validates create/initiation request payloads at the use-case boundary
- enforces workspace membership and owner delegation guardrails
- evaluates image-asset create authorization through centralized policy decision contracts
- resolves an explicit or auto-selected managed storage instance
- enforces storage eligibility (`active`, writable, workspace-matching) and `use-for-assets` policy checks
- enforces storage policy `maxObjectBytes` against declared image size
- persists an initial image asset record in `ingesting` (upload-pending) lifecycle state
- reserves a managed storage upload location and returns reservation metadata for API/controller flows

No filesystem write or UI logic is performed in this use case. All storage interaction remains logical (`storageInstanceId` + object reference) through authoritative application ports.

## Story 1.2.2: concrete metadata persistence for image assets

This story introduces the authoritative SQLite persistence adapter for image asset metadata:

- migration-backed image-asset persistence tables for metadata, lifecycle state, lineage upstream links, and mutation replay records
- domain-to-persistence mapper boundaries so SQLite row models do not leak into domain/application contracts
- concrete `IImageAssetRepository` implementation for:
  - create metadata record
  - find by id (including optional include-deleted behavior)
  - workspace-scoped list with owner/origin/status/visibility/media/storage/run/generation filters
  - save/update metadata record
  - lifecycle archive mutation
  - lifecycle soft-delete mutation
- idempotent mutation replay support keyed by `operationKey`
- optimistic revision guard support via `expectedRevision`

Schema posture now supports both uploaded inputs and generated outputs:

- tenancy/ownership and storage binding references are persisted as first-class columns
- file/fingerprint metadata and lifecycle timestamps are persisted durably
- lineage references (`upstreamAssetIds`, `sourceRunId`, `generationOperationId`) are persisted for future run/history features
- preview/result pointer columns are present (`preview_asset_id`, `preview_media_type`, `latest_object_key`, `latest_object_version_id`) to support future preview-safe retrieval and generated-result orchestration without a schema break

## Story 1.2.3: managed binary storage adapter for image uploads

This story adds the first production-grade infrastructure adapter implementing `IImageAssetStoragePort` for managed image binaries:

- `ManagedImageAssetStorageAdapter` routes reserve/write/read/delete operations through `IStorageLogicalAccessResolutionService` and `IStorageObjectPort` so image binaries flow through managed storage instances only
- reservation ids and access handles are opaque encrypted server-issued tokens, never filesystem paths or caller-selected layout hints
- logical object keys are generated server-side through storage object key contracts using workspace/asset/area segments and safe filename normalization
- write flows enforce optional expected size/checksum constraints and map backend failures into stable `ImageAssetStorageErrorCodes`
- read flows open managed object streams and return logical references/metadata without exposing physical storage bindings
- delete flows remain lifecycle-reason driven (`asset-deleted`, `asset-archived`, `ingest-failure`, `orphan-cleanup`) and use managed object delete semantics

`ManagedImageAssetStorageAdapter.test.ts` verifies:

- reserve/write/read/delete behavior through storage logical access plans
- reservation claim scoping (workspace/asset/actor/reference)
- opaque access-handle issue/resolve and expiry behavior
- logical-access and storage-object error mapping into image-asset storage error contracts

## Story 1.2.4: upload finalization and lifecycle transition flow

This story adds authoritative upload finalization after managed binary write completion:

- `FinalizeImageAssetUploadUseCase` validates finalization requests, verifies active workspace membership, and loads the pending image asset record.
- Finalization is explicit-state-only: assets must be in `ingesting` before they can transition to `available`.
- The use case confirms stored content through managed storage read streams and computes canonical checksums (`sha256`, `sha512`) and observed size.
- Finalization consistency checks validate:
  - storage instance identity matches the pending asset record
  - expected size/checksum hints (when provided) match stored content
  - pending metadata fingerprint/size consistency for deterministic status transition
- On successful verification, metadata is normalized and persisted, then lifecycle transitions to `available` through domain transition rules.
- On verification or persistence failure, the use case executes failure handling:
  - best-effort managed object cleanup (`ingest-failure` delete reason)
  - explicit lifecycle transition to `failed` with a normalized failure reason

`FinalizeImageAssetUploadUseCase.test.ts` verifies:

- no availability transition until storage verification succeeds
- explicit invalid-state rejection for non-pending assets
- failure path durability (cleanup attempt plus persisted `failed` status)

## Story 1.2.5: asset listing and metadata retrieval use cases

This story adds authoritative image-asset metadata read use cases for image pickers/detail flows:

- `GetImageAssetMetadataUseCase` for get-by-id metadata retrieval
- `ListImageAssetMetadataUseCase` for scoped workspace listing with filter + pagination contracts
- `ImageAssetMetadataReadUseCaseContracts.ts` for request validation and stable metadata projection models

Authorization and scope behavior:

- both read operations require active workspace membership
- `view-metadata` authorization is evaluated through centralized image-asset policy contracts and evaluator seams
- denied private reads return safe `not-found` behavior

Query and response behavior:

- listing supports filters for owner/origin/lifecycle/visibility/media/storage/lineage identifiers plus `createdAfter|createdBefore|updatedAfter|updatedBefore` activity windows
- pagination metadata (`limit`, `offset`, `returned`, `hasMore`) is returned for UI selector/browser surfaces
- metadata results are sourced from authoritative repository state (no filesystem scanning)
- responses expose logical availability flags (`isReadyForUse`, `isPreviewable`, `isDownloadable`) and do not expose physical storage details

## Story 1.3.2: protected original-content retrieval flow

This story adds the authoritative original-content retrieval path for image assets through application/use-case and API seams:

- `GetImageAssetOriginalContentUseCase` now provides a dedicated retrieval workflow for original image content.
- Authorization is evaluated before any storage content open/read call:
  - active workspace membership is required
  - centralized image-asset policy checks are evaluated for `download-original`
  - denied private reads return safe non-leaky outcomes
- Retrieval uses the managed storage abstraction (`IImageAssetStoragePort.openReadStream`) with `purpose=download-original`; no raw filesystem paths or direct public object URLs are exposed.
- Upload finalization now persists the authoritative latest original-object reference in repository storage metadata (`latest_object_key`/`latest_object_version_id`) so retrieval resolves through managed storage coordinates instead of host-path shortcuts.
- HTTP/API transport now streams original content through protected server endpoints with safe headers (`content-type`, `content-length`, `content-disposition`, `x-content-type-options`, `cache-control`) and no storage-layout leakage in API payloads.
