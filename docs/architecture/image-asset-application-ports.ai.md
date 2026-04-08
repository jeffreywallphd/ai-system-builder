# AI Companion: Image Asset Application Repository and Storage Ports

## Purpose

Story 1.1.4 defines the application-layer persistence and managed-storage seams for logical image assets.

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
- `docs/architecture/image-asset-application-ports.md`

## Repository port scope

`IImageAssetRepository` now defines authoritative metadata persistence seams for image assets:

- create and save image-asset records
- find by id (with optional deleted visibility)
- workspace-scoped list query filtering (owner/origin/status/visibility/media/storage/lineage)
- explicit lifecycle mutations for archive and soft-delete
- mutation context metadata (`operationKey`, actor, correlation, expected revision)

This keeps image-asset use cases independent from SQLite schema details and repository adapter internals.

## Managed storage port scope

`IImageAssetStoragePort` now defines managed-storage operations for image-asset content:

- reserve logical object locations bound to storage-instance identity + area
- write uploaded/generation content from `Uint8Array` or async stream input
- open protected read streams by explicit access purpose
- issue and resolve mediated access handles (opaque token claims)
- lifecycle-aware object deletion (`asset-deleted`, `asset-archived`, `ingest-failure`, `orphan-cleanup`)

All references are logical (`storageInstanceId`, `objectKey`, optional `objectVersionId`), never raw host filesystem paths.

## Error and boundary posture

`ImageAssetStorageError` + stable `ImageAssetStorageErrorCodes` provide adapter-safe failure mapping without leaking backend-specific path details.

The port contracts remain storage-backend neutral so future adapters (server-managed local, mounted/shared, sync-oriented) can implement one interface surface.

## Test coverage

`ImageAssetPortsContracts.test.ts` verifies representative in-memory implementations can satisfy:

- repository metadata lifecycle seams (create/list/archive/soft-delete/find)
- storage reservation/write/read/access-handle/delete seams

This enforces contract usability for application use cases without direct filesystem coupling.

`InitiateImageAssetCreationUseCase.test.ts` verifies Story 1.2.1 behavior:

- successful create/initiate flow with workspace/user ownership + upload-pending reservation
- storage auto-selection when caller does not provide a storage instance id
- clean access-denied responses for unauthorized workspace actors and non-admin owner delegation
- clean denial mapping for create-policy rejection and invalid request payloads

## Story 1.2.1 implementation scope

The image-assets application layer now includes `InitiateImageAssetCreationUseCase` + typed contracts for authoritative ingestion initialization:

- validate create request input at use-case boundary
- resolve workspace membership/admin posture for caller
- run image asset create authorization via centralized policy decision contracts
- resolve/choose managed storage instance using existing storage repository + policy evaluation seams
- enforce active/writable/workspace-matching storage eligibility and `maxObjectBytes` limits
- persist initial logical image asset metadata in `ingesting` status
- reserve managed upload location through `IImageAssetStoragePort`
- return API/controller-safe output envelope (`imageAsset` + `upload.status=upload-pending` + reservation)

Boundary posture preserved:

- no direct file writes
- no UI coupling
- no filesystem path exposure in request/result contracts

## Story 1.2.2 implementation scope

Concrete image-asset metadata persistence now exists as a SQLite-backed authoritative adapter:

- migration-backed tables for image asset metadata, lifecycle state, lineage upstream links, and mutation replay records
- domain-to-persistence mapping that keeps persistence rows isolated from application/domain contracts
- repository operations implemented for:
  - create metadata record
  - find by id (with optional deleted inclusion)
  - workspace-scoped filtered list (owner/origin/status/visibility/media/storage/run/generation filters)
  - save/update metadata record
  - lifecycle archive mutation
  - lifecycle soft-delete mutation
- mutation replay semantics keyed by `operationKey` for idempotent create/save/archive/delete behavior
- revision-aware mutation support through `expectedRevision` checks

Schema posture for current and near-future image flows:

- supports uploaded source and generated result assets (`originKind`)
- stores tenancy/ownership, storage binding references, fingerprint/file metadata, lifecycle timestamps, and lineage references
- includes nullable preview/result pointer columns (`preview_asset_id`, `preview_media_type`, `latest_object_key`, `latest_object_version_id`) for future preview/result orchestration without requiring schema redesign

## Story 1.2.3 implementation scope

`ManagedImageAssetStorageAdapter` is now the concrete managed-binary adapter for image uploads/retrieval:

- implements `IImageAssetStoragePort` over `IStorageLogicalAccessResolutionService` + `IStorageObjectPort`
- generates object keys server-side from workspace/asset/area context, not caller paths
- issues opaque encrypted reservation ids and access handles (tokenized claims)
- enforces optional expected-size and checksum integrity checks during writes
- keeps storage references logical (`storageInstanceId` + `objectKey`) and hides physical layout
- maps logical-access/object-port failures into stable image-asset storage error codes

`ManagedImageAssetStorageAdapter.test.ts` verifies reserve/write/read/access/delete behavior, claim scoping, expiry handling, and failure mapping.

## Story 1.2.4 implementation scope

Authoritative upload finalization now exists through `FinalizeImageAssetUploadUseCase` + typed contracts:

- validates finalize-upload request payloads at use-case boundary
- verifies active workspace membership before finalization mutation work
- loads pending image asset metadata and enforces explicit `ingesting -> available` transition rules
- confirms stored content via managed storage read stream and observed size/checksum computation
- applies consistency checks between pending metadata and stored object details before status promotion
- persists normalized metadata and lifecycle transition to `available` only after verification succeeds
- executes failure path durability on errors:
  - best-effort managed object cleanup with lifecycle reason `ingest-failure`
  - explicit transition to `failed` with normalized failure reason metadata

`FinalizeImageAssetUploadUseCase.test.ts` verifies:

- availability transition only after successful storage verification
- invalid-state rejection when finalizing non-pending assets
- failure handling that avoids silent partial registration through cleanup + explicit failed status persistence

## Story 1.2.5 implementation scope

Authoritative image-asset metadata read use cases now exist for UI image selectors and detail views:

- `GetImageAssetMetadataUseCase` for policy-enforced get-by-id metadata retrieval
- `ListImageAssetMetadataUseCase` for scoped workspace listing with filters + pagination
- shared read contracts in `ImageAssetMetadataReadUseCaseContracts.ts` for boundary validation and presentation-safe metadata projections

Authorization and scope posture:

- active workspace membership is required for both get/list operations
- read authorization uses image-asset policy contracts (`view-metadata`) through centralized policy decision evaluator seams
- private asset responses remain safe (`not-found`) when policy denies access

Query and response posture:

- listing supports workspace/user scope filtering across owner, origin, lifecycle, visibility, media type, storage instance, lineage run-operation identifiers, and created/updated activity windows
- pagination scaffolding (`limit`, `offset`, `returned`, `hasMore`) is returned for UI pickers/browsers
- responses are based on authoritative metadata repository records; no filesystem scanning or path inspection
- metadata projections include logical availability flags (`isReadyForUse`, `isPreviewable`, `isDownloadable`) without exposing physical storage structure

## Story 1.3.2 implementation scope

Protected original-content retrieval is now implemented through authoritative application and API boundaries:

- Added `GetImageAssetOriginalContentUseCase` + typed contracts for mediated original-content reads.
- Authorization and scope checks execute before any storage read access:
  - active workspace membership required
  - policy evaluation uses image-asset `download-original` authorization action
  - denied private reads stay non-leaky (`not-found` style)
- Retrieval opens content only through `IImageAssetStoragePort.openReadStream` with `purpose=download-original` and logical storage references.
- Upload finalization now persists authoritative original-object pointers (`latest_object_key`, `latest_object_version_id`) through repository seams so later reads do not rely on path reconstruction shortcuts.
- HTTP/API transport now streams original bytes through protected server routes with safe content headers and private/no-store cache semantics, without exposing raw filesystem paths or direct storage URLs.
