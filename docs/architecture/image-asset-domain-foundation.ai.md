# AI Companion: Image Asset Domain Foundation

## What this slice adds

Story 1.1.1 introduces a dedicated logical image-asset domain model for the image manipulation slice.

## Canonical files

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/domain/image-assets/tests/ImageAssetDomain.test.ts`
- `docs/architecture/image-asset-domain-foundation.md`

## Modeled contract

`ImageAsset` now carries:

- `assetId`, `workspaceId`, optional `ownerUserId`
- `storageInstanceId` + optional logical `storageBindingReference`
- media/file identity (`mediaType`, `originalFilename`, `normalizedFilename`, `sizeBytes`, `fingerprint`)
- visibility/sharing posture (`visibility`, `sharingPolicy`)
- audit metadata (`createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`)
- lifecycle/status metadata (`ingesting`, `available`, `failed`, `archived`, `deleted`)
- lineage-ready metadata (`upstreamAssetIds`, `sourceRunId`, `generationOperationId`)

Both uploaded source and generated result image assets are first-class through `originKind`.

## Core invariants

- supported media types are explicit image-only values
- required workspace/storage identity references are enforced
- private visibility requires owner user identity
- visibility and sharing policy modes must align
- shared/published visibility requires policy identity
- logical storage references reject raw path payloads
- normalized filenames reject path separators
- fingerprint algorithm/digest shape is validated
- lifecycle metadata and transition safety are enforced

## Boundary posture

- Domain contracts remain infrastructure-agnostic.
- No raw filesystem path assumptions are encoded in the model.
- The model is ready for authoritative API, policy checks, preview-safe retrieval, and future run-lineage orchestration.

## Story 1.1.3 shared DTO/schema contract additions

Shared API and event contracts for image assets now live in:

- `src/shared/contracts/assets/ImageAssetTransportContracts.ts`
- `src/shared/dto/assets/ImageAssetTransportDtos.ts`
- `src/shared/dto/assets/ImageAssetPersistenceDtos.ts`
- `src/shared/schemas/assets/ImageAssetTransportSchemaContracts.ts`

Coverage includes:

- create image asset request/response contracts
- upload initiation and upload completion contracts
- metadata read and list/query contracts (workspace, ownership, status, visibility, media, storage filters)
- preview request contracts
- logical download/export access grant contracts
- image-asset lifecycle/audit event contracts

Boundary guarantees in these shared contracts:

- external API DTOs are separated from internal persistence DTOs
- contracts are desktop/thin-client safe and server-authoritative
- no raw filesystem path fields are exposed in API/event payloads

## Story 1.1.4 application repository/storage port additions

Application-layer image asset persistence and managed-storage interfaces now live in:

- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/ports/index.ts`

These contracts provide:

- metadata create/update/retrieve/list/archive/soft-delete seams
- managed-storage location reservation, write, read, access-handle, and delete seams
- storage-instance and logical object-key based references only (no raw host paths)

## Story 6.1.1 generated-result extension

Generated result assets now have a dedicated lifecycle/provenance model in:

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/tests/GeneratedResultAssetDomain.test.ts`
- `docs/architecture/generated-result-asset-domain-foundation.md`

This adds explicit result collection->persistence->preview->archive lifecycle invariants while preserving logical asset id and lineage integration.
