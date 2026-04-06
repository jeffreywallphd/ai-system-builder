# AI Companion: Logical Asset Application Ports and Service Contracts

## Purpose

Story 10.1.3 defines the application-layer service boundaries for protected logical asset operations so callers use explicit use-case contracts rather than ad hoc path/file utilities.

## Canonical files

- `src/application/assets/use-cases/AssetServiceContracts.ts`
- `src/application/assets/use-cases/index.ts`
- `src/application/assets/ports/IAssetRepository.ts`
- `src/application/assets/ports/AssetAuthorizationPort.ts`
- `src/application/assets/ports/AssetContentPort.ts`
- `src/application/assets/ports/AssetPreviewPort.ts`
- `src/application/assets/ports/AssetMediaPort.ts`
- `src/application/assets/ports/AssetAuditPort.ts`
- `src/application/assets/ports/index.ts`
- `src/shared/contracts/assets/AssetTransportContracts.ts`
- `src/shared/dto/assets/AssetTransportDtos.ts`
- `src/application/assets/tests/AssetServiceContracts.test.ts`
- `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/AssetTransportDtos.test.ts`

## Service-contract scope

Application use-case contracts now explicitly cover:

- asset registration
- asset lookup by id
- scoped asset listing
- upload finalization
- protected download authorization
- preview lookup
- generated output registration with lineage links
- logical archive and logical delete lifecycle operations

All requests are workspace-scoped and actor-scoped through explicit request context types.

## Port boundaries

In addition to repository persistence contracts, the application layer now defines dedicated ports for:

- authorization decisions (`IAssetAuthorizationPort`)
- protected content handling (`IAssetContentPort`)
- preview/media resolution (`IAssetPreviewPort`, `IAssetMediaPort`)
- audit recording (`AssetAuditSink`)

These keep authorization/storage/media/audit behavior adapter-boundary-safe and prevent filesystem coupling in use-case contracts.

## Path-safe request validation

`AssetServiceContracts` includes application-level validation helpers that normalize request payloads and reject filesystem-like object keys (absolute, drive-prefixed, path-traversal, or Windows-separator forms).

This preserves logical storage semantics (`storageInstanceId` + `objectKey`) at the application boundary.

## Shared API/event payload contracts

`AssetTransportContracts` and `AssetTransportDtos` provide stable projection contracts for:

- summary/detail asset payloads
- download authorization payloads
- preview-resolution payloads
- asset audit event payloads

Transport payloads carry logical IDs and storage references only; infrastructure-only path/location internals are not exposed.

## Test coverage in this slice

- Application request validation tests for registration/list/finalize/download/generated-output flows.
- Shared transport contract tests for summary/detail projection, path-safe download authorization payload checks, and audit event payload mapping.
- Shared DTO tests that verify DTO->application normalization and validation bridging.

## Boundary posture

- Dependencies point inward: use-case contracts depend on domain types and application ports, not adapter specifics.
- Shared DTO/contracts do not include filesystem path APIs or backend-specific adapter objects.
- Higher layers can integrate on logical asset ids, storage-instance refs, and scoped filters without redesign.

## Story 10.1.5 path-quarantine update

- Renderer-visible desktop model file operations now accept logical model paths relative to managed model roots, not raw absolute filesystem paths.
- Electron main process resolves those logical paths through an internal-only policy module (`electron/main/ModelFilePathPolicy.ts`) and rejects absolute/traversal/out-of-root inputs.
- Infrastructure adapters (`DesktopBridgeFileStorage`) quarantine absolute path handling behind internal translation logic so application/model services can keep existing abstractions without exposing raw path contracts at UI/IPC boundaries.

## Story 10.2.1 upload initiation implementation

- Added concrete application orchestration for upload registration/initiation:
  - `src/application/assets/use-cases/AssetUploadInitiationService.ts`
- Extended service contracts/DTO adapters with upload-initiation request/result support:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/shared/dto/assets/AssetTransportDtos.ts`
- Added backend API + public transport contract:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated HTTP routes in authoritative transport:
  - `POST /api/v1/assets/register`
  - `POST /api/v1/assets/:assetId/uploads/initiate`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host wiring now composes asset upload initiation dependencies:
  - `hosts/server/IdentityServerHost.ts`

Enforced rules in this slice:

- actor must have active workspace membership.
- owner-intent validation blocks non-admin ownership delegation.
- storage must be workspace-matching, active, writable, and policy-allowed for `use-for-assets`.
- declared upload size is checked against storage policy `maxObjectBytes`.
- API responses return logical ids + server-approved upload endpoints/session metadata, never raw filesystem paths.

Coverage added:

- `src/application/assets/tests/AssetUploadInitiationService.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`


## Story 10.2.2 protected ingestion/finalization update

- Added authoritative upload-session persistence contract and adapter:
  - `src/application/assets/ports/IAssetUploadSessionRepository.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetUploadSessionPersistenceAdapter.ts`
- Added stream-based ingestion/finalization use case:
  - `src/application/assets/use-cases/AssetUploadIngestionService.ts`
- Extended backend API and transport contracts with content ingestion support:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

Operational behavior in this story:

- Upload initiation now persists a pending upload-session record with server-authorized object key, expected content metadata, and expiration.
- Upload content is ingested as a stream (`POST /api/v1/assets/upload-sessions/:uploadSessionId/content`) and written through resolved `IStorageObjectPort` adapters.
- Finalization only updates asset metadata/version state after successful storage write and descriptor resolution (size/checksum/mime).
- Oversized or interrupted uploads are marked `incomplete`; asset version metadata is not advanced.
- Best-effort object cleanup is attempted when write/finalization fails.

Coverage added for this story:

- `src/application/assets/tests/AssetUploadIngestionService.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetUploadSessionPersistenceAdapter.test.ts`
- extended API/transport tests for upload-session content routes.

## Story 10.2.3 scoped discovery/listing update

- Added authoritative scoped asset-discovery use case:
  - `src/application/assets/use-cases/AssetDiscoveryService.ts`
- Extended list-query contract surface for scope + creator filtering and pagination metadata:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/application/assets/ports/IAssetRepository.ts`
- Persistence list filtering now supports creator scoping:
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- Extended backend API and public SDK contract with listing endpoint payloads:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport route:
  - `GET /api/v1/assets`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires discovery dependencies:
  - `hosts/server/IdentityServerHost.ts`

Operational behavior in this story:

- listing requires active workspace membership.
- private assets are filtered to owner (or workspace admin) and do not leak into other users' listing responses.
- workspace/shared/published visibility stays workspace-scoped for authorized members.
- query filters now support:
  - `scope` (`private` | `workspace` | `all`),
  - `ownerUserId`,
  - `createdByUserId`,
  - `assetKinds`,
  - `lifecycleStates` (status),
  - lineage source filters,
  - pagination (`limit`, `offset`) with returned `hasMore` metadata.
- list DTO payloads remain presentation-safe and logical-id based (no raw backend path exposure).

Coverage added for this story:

- `src/application/assets/tests/AssetDiscoveryService.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.2.4 protected asset detail lookup + metadata retrieval

- Added an authoritative asset detail lookup use case:
  - `src/application/assets/use-cases/AssetDetailService.ts`
- Extended service-contract validation with normalized get-by-id query parsing:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/shared/dto/assets/AssetTransportDtos.ts`
- Extended shared detail DTO projection with policy-aware operational metadata fields:
  - ownership context (`isOwnedByActor`)
  - upload state (`ready` | `archived` | `deleted`)
  - preview availability/mime hint
  - allowed action set
  - server route links for self/list/upload/download/preview/generated-output-source discovery
  - lineage source hooks
  - implemented in `src/shared/contracts/assets/AssetTransportContracts.ts`
- Extended backend API + transport contract with dedicated detail retrieval endpoint payloads:
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets/:assetId`
  - implemented in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires the detail service into asset management backend API:
  - `hosts/server/IdentityServerHost.ts`

Operational behavior in this story:

- detail lookup requires active workspace membership.
- cross-workspace and unauthorized private-asset lookups return safe `not-found` behavior.
- deleted assets are hidden by default unless `includeDeleted=true`.
- detail responses preserve list-summary consistency and include logical/server-safe metadata only.
- raw storage/object filesystem internals remain infrastructure-only.

Coverage added for this story:

- `src/application/assets/tests/AssetDetailService.test.ts`
- `src/application/assets/tests/AssetServiceContracts.test.ts`
- `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/AssetTransportDtos.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.2.5 secure download authorization + content streaming

- Added an authoritative protected download orchestration use case:
  - `src/application/assets/use-cases/AssetDownloadService.ts`
- Added explicit download-grant port contract for opaque token issuance/resolution:
  - `src/application/assets/ports/AssetDownloadGrantPort.ts`
- Added encrypted grant adapter for server-issued opaque content tokens:
  - `src/infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter.ts`
- Extended backend API + SDK contracts with download authorization and stream-open operations:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport endpoints:
  - `POST /api/v1/assets/:assetId/downloads/authorize`
  - `GET /api/v1/assets/:assetId/downloads/content`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires download grants and service dependencies:
  - `hosts/server/IdentityServerHost.ts`

Operational behavior in this story:

- Download authorization requires active workspace membership plus asset visibility checks.
- Private assets remain owner/admin constrained; unauthorized reads return clean deny/not-found behavior.
- Storage logical access and policy checks gate both authorization and stream-open paths.
- Purpose-specific restrictions are enforced:
  - `inline-preview` requires preview-compatible mime types and storage preview decryption allowance.
  - `worker-process` requires worker-capable asset kinds and storage worker decryption allowance.
- Content is streamed from managed storage through server handlers (`AsyncIterable`), avoiding eager in-memory buffering for large files.
- Download responses set defensive headers (`Content-Disposition`, `X-Content-Type-Options`, `Cache-Control`) and keep object/storage internals off transport payloads.
- Download authorization payloads now expose opaque content tokens and metadata only (no logical object keys).

Coverage added for this story:

- `src/application/assets/tests/AssetDownloadService.test.ts`
- `src/infrastructure/security/assets/tests/EncryptedAssetDownloadGrantAdapter.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 11.3.2 policy-aware encryption enforcement during asset ingest/retrieval

- Upload ingestion now evaluates effective encryption policy (`asset-content`) before object writes.
- Scoped-content-required policy now encrypts payload bytes on ingest via server-side AES-GCM content-cipher adapters.
- Asset version metadata persists optional encrypted-content descriptors for controlled decryption (`asset_versions.content_encryption_descriptor`), without exposing filesystem paths.
- Download authorization/open-stream now enforces effective policy on retrieval:
  - deny when policy requires encrypted content but version metadata indicates plaintext,
  - apply preview/worker decryption allowances when encrypted content is requested,
  - decrypt encrypted streams server-side for authorized callers.
- Host composition now wires workspace/storage-aware policy-context resolution, scoped key resolution/material seams, and content-cipher adapters for logical asset pipelines.

Coverage added/extended for this story:

- `src/application/assets/tests/AssetUploadIngestionService.test.ts`
- `src/application/assets/tests/AssetDownloadService.test.ts`
- `src/infrastructure/security/encryption/tests/AesGcmAssetContentCipherPort.test.ts`
- `src/infrastructure/security/encryption/tests/DeterministicScopeEncryptionKeyPort.test.ts`
- `src/infrastructure/persistence/assets/tests/AssetPersistenceMapper.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`

## Story 10.3.1 generated outputs as first-class logical assets

- Added a dedicated generated-output registration use case:
  - `src/application/assets/use-cases/AssetGeneratedOutputRegistrationService.ts`
- Extended asset service/detail/transport contracts for generated-output producer metadata:
  - `source.producerType = "run" | "system"`
  - run/system identifiers are validated at use-case boundary
  - detail projection now includes optional `generatedOutputSource` metadata for generated-output assets
- Extended backend API + public contract with generated-output registration operation:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated HTTP endpoint:
  - `POST /api/v1/assets/generated-outputs/register`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires generated-output registration dependencies:
  - `hosts/server/IdentityServerHost.ts`

Behavior in this story:

- generated outputs now enter the asset system through authoritative server APIs and are persisted as `generated-output` assets.
- generated-output ownership can be workspace-owned (no owner user) or user-owned, with admin guardrails on cross-user ownership assignment.
- generated outputs remain retrievable by the same list/detail/download surfaces used for uploads.
- raw output filesystem path contracts are not introduced.

Coverage added/extended:

- `src/application/assets/tests/AssetGeneratedOutputRegistrationService.test.ts`
- `src/application/assets/tests/AssetServiceContracts.test.ts`
- `src/application/assets/tests/AssetDetailService.test.ts`
- `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.2 preview/thumbnail derivatives as protected resources

- Added a dedicated protected preview lookup use case:
  - `src/application/assets/use-cases/AssetPreviewService.ts`
- Added authenticated preview resolution API/transport contract and route:
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `GET /api/v1/assets/:assetId/preview`
- Host composition now wires preview lookup as part of asset-management backend assembly:
  - `hosts/server/IdentityServerHost.ts`

Operational behavior in this story:

- previews and thumbnails are resolved as logical derivative assets under authoritative server APIs (no public URL or raw filesystem path contracts).
- parent-asset workspace membership, lifecycle, and visibility checks are enforced before preview metadata is returned.
- derivative previews are selected from protected lineage-linked assets (`kind=preview|derived`); preferred mime ordering supports thumbnail-like selection (`preferredMimeType` query repetitions).
- stricter preview visibility is respected automatically because preview assets pass the same visibility gate as other logical assets.
- fallback behavior is explicit and bounded:
  - if no derivative preview is available, the source asset version is returned only when its mime is preview-compatible;
  - an optional preview-port seam can surface worker-produced previews while still revalidating through repository-backed logical assets.
- preview content retrieval remains protected through existing tokenized download flows (`inline-preview`), preserving policy-gated storage access and decryption controls.

Coverage added/extended:

- `src/application/assets/tests/AssetPreviewService.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.3 protected asset operation audit integration

- Added shared best-effort asset audit publisher + sanitization helper:
  - `src/application/assets/ports/AssetAuditPort.ts`
- Updated protected asset services to emit structured audited outcomes and avoid path/content leakage in audit details:
  - upload registration/initiation/finalization
  - download authorization + protected stream-open
  - preview resolution
  - generated-output registration
- Added lifecycle mutation use case for audited archive/delete operations:
  - `src/application/assets/use-cases/AssetLifecycleService.ts`
- Added authenticated lifecycle routes and backend methods:
  - `POST /api/v1/assets/:assetId/archive`
  - `POST /api/v1/assets/:assetId/delete`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Added SQLite-backed asset audit recorder + host wiring:
  - `src/infrastructure/persistence/assets/SqliteAssetAuditRecorder.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceMigrations.ts`
  - `hosts/server/IdentityServerHost.ts`

Audit posture in this story:

- carries actor identity, workspace scope, asset identity, operation type, and coarse outcome metadata.
- redacts path/token/content-like detail keys and trims nested audit metadata to avoid sensitive leakage.
- remains best-effort so workflow success does not depend on audit persistence availability.

Coverage added/extended:

- `src/application/assets/tests/AssetAuditPort.test.ts`
- `src/application/assets/tests/AssetLifecycleService.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetAuditRecorder.test.ts`
- updated:
  - `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
  - `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
  - `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.4 shared client-safe contracts + UI integration

Implemented a shared client-safe asset-workflow contract seam for desktop/thin-client parity and wired a representative UI flow to logical asset APIs.

Canonical additions:

- `src/shared/contracts/assets/AssetWorkflowClientContracts.ts`
- `src/shared/contracts/assets/tests/AssetWorkflowClientContracts.test.ts`
- `ui/shared/assets/AssetWorkflowClient.ts`
- `ui/shared/assets/tests/AssetWorkflowClient.test.ts`
- `ui/services/AssetWorkflowService.ts`
- `ui/services/tests/AssetWorkflowService.test.ts`

Representative UI-facing integration:

- `/assets` now resolves to `AssetsPage` in `ui/routes/AppRouter.tsx`.
- `ui/pages/AssetsPage.tsx` now executes protected logical asset workflows through shared client/service seams:
  - list assets (workspace-scoped)
  - load asset detail
  - resolve preview
  - authorize download / inline-preview (tokenized content path)
  - initiate upload session

Boundary posture:

- Presentation code consumes logical identifiers and API-safe contracts only.
- Raw filesystem path knowledge is not required in UI state for this flow.
- Contracts and helpers are reusable for desktop and thin-client clients without duplicating workflow logic.
