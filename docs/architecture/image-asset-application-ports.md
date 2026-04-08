# Image Asset Application Repository and Storage Ports

This note documents Story 1.1.4 for the image manipulation vertical slice: application-layer repository and managed-storage interfaces for logical image asset metadata and binary content workflows.

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
