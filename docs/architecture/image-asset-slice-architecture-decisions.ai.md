# AI Companion: Image Asset Slice Architecture Decisions

## Purpose

Story 1.1.5 baseline for Feature 1 / Epic 1.1: record the architectural decisions that make image assets protected logical resources and define ingestion/retrieval boundaries for future preview and run-integration work.

## Canonical files

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/shared/contracts/assets/ImageAssetTransportContracts.ts`
- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
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

- Domain invariants, shared DTO/schema contracts, authorization contracts, application ports, concrete SQLite metadata persistence, and a concrete managed image-binary storage adapter are implemented.
- Host/API route wiring for the full image-asset ingestion/retrieval surface remains incremental in later stories.

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
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`
