# AI Companion: Image Asset Application Repository and Storage Ports

## Purpose

Story 1.1.4 defines the application-layer persistence and managed-storage seams for logical image assets.

## Canonical files

- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/ports/index.ts`
- `src/application/image-assets/use-cases/ImageAssetCreationUseCaseContracts.ts`
- `src/application/image-assets/use-cases/InitiateImageAssetCreationUseCase.ts`
- `src/application/image-assets/use-cases/index.ts`
- `src/application/image-assets/index.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
- `src/application/image-assets/tests/InitiateImageAssetCreationUseCase.test.ts`
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
