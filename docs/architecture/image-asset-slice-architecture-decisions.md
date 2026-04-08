# Image Asset Slice Architecture Decisions

This note documents Story 1.1.5 for the image manipulation vertical slice: architecture decisions that make image assets first-class protected platform resources, and define how ingestion, storage, authorization, and retrieval must compose through authoritative server contracts.

## Canonical implementation seams

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/shared/contracts/assets/ImageAssetTransportContracts.ts`
- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/shared/dto/assets/ImageAssetTransportDtos.ts`
- `src/shared/dto/assets/ImageAssetPersistenceDtos.ts`
- `src/shared/schemas/assets/ImageAssetTransportSchemaContracts.ts`
- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/use-cases/FinalizeImageAssetUploadUseCase.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter.ts`
- `src/infrastructure/persistence/image-assets/SqliteImageAssetPersistenceMigrations.ts`
- `src/infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`
- `docs/architecture/image-asset-domain-foundation.md`
- `docs/architecture/image-asset-authorization-contracts.md`
- `docs/architecture/image-asset-application-ports.md`

## Decision 1: image assets are logical protected resources, not raw files

Image asset identity and policy posture are modeled in `ImageAsset` (`assetId`, workspace/user ownership, visibility, sharing policy, lifecycle, lineage) and not by host-local paths.

Why:

- policy and tenancy checks require stable resource identity independent of storage backend implementation
- desktop, web, and worker hosts need a common contract that does not depend on local filesystem assumptions
- run orchestration and generated-output lineage require durable logical references (`assetId`, upstream relationships), not ephemeral file locations

Constraint:

- image asset contracts reject path-style payloads for storage binding and normalized filename fields; storage/path resolution stays in managed storage adapters

## Decision 2: tenancy and ownership metadata are mandatory policy inputs

Image asset contracts treat tenancy/ownership as first-order data, not optional tags.

Implemented posture:

- workspace scope is always required (`workspaceId`)
- ownership supports both user-private (`ownerUserId`) and workspace-owned resources
- visibility and sharing policy mode must remain aligned (`private -> owner-only`, `workspace -> workspace-members`, `shared -> explicit`, `published -> published`)
- shared/published resources require explicit sharing policy identity

This allows authorization to evaluate image assets through existing policy primitives without image-specific exceptions.

## Decision 3: content storage integration is through managed storage instances

Image binaries are referenced by logical storage coordinates (`storageInstanceId`, `objectKey`, optional `objectVersionId`) and accessed via `IImageAssetStoragePort`.

Implemented storage seams include:

- reserve logical location in a managed storage instance
- write content from byte buffer or stream
- open read stream by purpose (`download-original`, `inline-preview`, `export`, `worker-process`)
- create/resolve mediated access handles (opaque tokens)
- delete with lifecycle reason semantics (`asset-deleted`, `asset-archived`, `ingest-failure`, `orphan-cleanup`)

This keeps object store details and filesystem layouts out of use cases and transport DTOs.

## Decision 4: authorization stays centralized and resource-driven

Image asset actions map to existing catalog permissions (`asset.create`, `asset.read`, `asset.update`, `asset.delete`) through `resolveImageAssetRequiredPermission(...)`.

Authorization seam behavior:

- create actions evaluate as workspace-capability checks
- non-create actions evaluate as protected resource-instance checks against `asset:image-asset:<assetId>`
- policy context carries ownership scope, visibility, sharing mode/policy, and publication capability metadata

Result: image flows remain policy-driven while preserving one authoritative evaluator pipeline.

## Decision 5: all ingestion and retrieval flows are authoritative API contracts

The slice defines server-authoritative route contracts in `ImageAssetTransportRoutes`:

- create/list/get metadata
- initiate/complete upload
- preview request
- access grant request
- event list

Client and host integrations consume typed DTO/schema contracts rather than local file access shortcuts.

Current implementation boundary (April 8, 2026):

- domain invariants, shared transport/auth contracts, application repository/storage ports, concrete SQLite image-asset metadata persistence, a concrete managed image-binary storage adapter, and explicit upload finalization lifecycle orchestration are implemented
- host wiring for the full image-asset route surface remains incremental in downstream stories through existing host assembly and API layers

## Decision 6: preview-safe access and generated outputs are first-class

The architecture treats preview and generated outputs as normal protected asset flows:

- preview availability is explicit in transport DTOs (`preview.available`, `previewAssetId`, media type)
- preview/download/export access uses purpose-scoped access grants, not direct file paths
- generated outputs are first-class via `originKind=generated-result`
- lineage fields (`upstreamAssetIds`, `sourceRunId`, `generationOperationId`) provide a stable bridge to run orchestration and future ComfyUI output ingestion

## Reference implementation guidance for future work

Treat this vertical slice as the platform reference implementation for protected media assets.

When extending image ingestion/retrieval:

- preserve logical identity + tenancy/ownership metadata as the source of truth
- keep storage adapters behind `IImageAssetStoragePort`; do not leak backend paths into DTOs or use cases
- keep authorization through centralized policy evaluation contracts; do not inline visibility logic in controllers/UI
- keep preview/export/download flows mediated through access-purpose contracts
- attach generated outputs to lineage metadata and authoritative asset events instead of side channels

## Regression baseline for contract stability

- `src/domain/image-assets/tests/ImageAssetDomain.test.ts`
- `src/shared/contracts/assets/tests/ImageAssetAuthorizationContracts.test.ts`
- `src/shared/contracts/assets/tests/ImageAssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/ImageAssetTransportDtos.test.ts`
- `src/shared/dto/assets/tests/ImageAssetPersistenceDtos.test.ts`
- `src/shared/schemas/assets/tests/ImageAssetTransportSchemaContracts.test.ts`
- `src/application/image-assets/tests/ImageAssetPortsContracts.test.ts`
- `src/application/image-assets/tests/FinalizeImageAssetUploadUseCase.test.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`

## Related architecture notes

- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/image-asset-domain-foundation.md`
- `docs/architecture/image-asset-authorization-contracts.md`
- `docs/architecture/image-asset-application-ports.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/architecture/storage-foundation.md`
- `docs/architecture/storage-application-ports.md`
- `docs/architecture/storage-logical-access-resolution.md`
- `docs/architecture/storage-access-semantics.md`
- `docs/architecture/run-orchestration-domain-foundation.md`
- `docs/architecture/run-orchestration-transport-contracts.md`
