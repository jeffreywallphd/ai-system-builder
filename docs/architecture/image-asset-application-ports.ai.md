# AI Companion: Image Asset Application Repository and Storage Ports

## Purpose

Story 1.1.4 defines the application-layer persistence and managed-storage seams for logical image assets.

## Canonical files

- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/ports/index.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
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
