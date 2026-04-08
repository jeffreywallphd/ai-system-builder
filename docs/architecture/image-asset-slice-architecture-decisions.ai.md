# AI Companion: Image Asset Slice Architecture Decisions

## Purpose

Story 1.1.5 baseline for Feature 1 / Epic 1.1: record the architectural decisions that make image assets protected logical resources and define ingestion/retrieval boundaries for future preview and run-integration work.

## Canonical files

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/shared/contracts/assets/ImageAssetTransportContracts.ts`
- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/use-cases/FinalizeImageAssetUploadUseCase.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceMigrations.ts`
- `src/infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter.ts`
- `docs/architecture/image-asset-domain-foundation.md`
- `docs/architecture/image-asset-authorization-contracts.md`
- `docs/architecture/image-asset-application-ports.md`
- `docs/architecture/image-asset-slice-architecture-decisions.md`

## Core decisions

- Image assets are authoritative logical resources (`assetId`) with explicit tenancy, lifecycle, visibility, sharing, storage, and lineage metadata.
- Workspace scope and optional user ownership are policy-critical fields, not optional labels.
- Binary content is accessed only through managed storage contracts (`storageInstanceId` + logical object references), not filesystem paths.
- Authorization stays centralized via image action -> catalog permission mapping and policy decision request contracts.
- Preview/download/export flows are mediated by purpose-scoped access contracts and opaque handle tokens.
- Generated outputs are first-class assets (`originKind=generated-result`) and remain lineage-linked for run orchestration.

## Current implementation posture (April 8, 2026)

- Domain invariants, shared DTO/schema contracts, authorization contracts, application ports, concrete SQLite metadata persistence, a concrete managed image-binary storage adapter, upload finalization lifecycle orchestration, and policy-enforced metadata read/list use cases are implemented.
- Authoritative server API wiring now includes image-asset ingestion/metadata endpoints plus protected original-content retrieval (`GET /api/v1/image-assets/:assetId/original`).
- Image-asset transport handlers remain thin and delegate to application-layer image use cases through `ImageAssetManagementBackendApi` and host composition.

Story 1.3.2 addition:

- Dedicated original-content retrieval use case (`GetImageAssetOriginalContentUseCase`) now mediates server-side content access.
- Authorization checks execute before storage stream reads.
- Finalization now persists authoritative original object references for later managed retrieval without exposing raw filesystem/object-layout details.

Story 1.3.3 addition:

- Preview retrieval now uses explicit request/open contracts (`RequestImageAssetPreviewContentUseCase`, `OpenImageAssetPreviewContentUseCase`) with representation-aware request shapes and tokenized preview stream access.
- Preview authorization and logical asset resolution execute before any preview stream is opened.
- Initial preview behavior uses original-as-preview fallback when compatible and returns `pending-generation`/`unavailable` statuses for future derivation workflows without changing API contracts.
- Identity HTTP routes now include `GET /api/v1/image-assets/:assetId/preview` and `GET /api/v1/image-assets/:assetId/preview/content`, both server-mediated and storage-layout safe.

Story 1.3.5 addition:

- Identity HTTP integration coverage now includes production-style create/upload/finalize/get/list/original/preview flows backed by authoritative image metadata persistence and managed storage adapters.
- Regression checks assert authorization enforcement for unauthorized actors and ensure transport responses do not expose raw storage object-key/path internals.
- Integration assertions now verify that image-asset audit hooks are emitted across successful and rejected protected-content access paths.

## Extension guardrails

- Do not introduce path-based local bypasses for upload, preview, or retrieval.
- Do not move visibility/sharing logic into UI/controller layers.
- Keep storage backend details behind image storage ports.
- Keep generated-output ingestion on authoritative asset contracts and lineage metadata.

## Regression suites to keep green

- `src/domain/image-assets/tests/ImageAssetDomain.test.ts`
- `src/shared/contracts/assets/tests/ImageAssetAuthorizationContracts.test.ts`
- `src/shared/contracts/assets/tests/ImageAssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/ImageAssetTransportDtos.test.ts`
- `src/shared/schemas/assets/tests/ImageAssetTransportSchemaContracts.test.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
- `src/application/image-assets/tests/FinalizeImageAssetUploadUseCase.test.ts`
- `src/application/image-assets/tests/GetImageAssetMetadataUseCase.test.ts`
- `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts`
- `src/application/image-assets/tests/ImageAssetPreviewContentUseCases.test.ts`
- `src/application/image-assets/tests/ListImageAssetMetadataUseCase.test.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`
- `src/infrastructure/api/image-assets/tests/ImageAssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerImageAssetManagement.test.ts`
