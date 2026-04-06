# Logical Asset Application Ports and Service Contracts

This note documents Story 10.1.3 (Feature 10 / Epic 10.1): the application-layer contracts and service boundaries for protected logical asset operations.

## Canonical artifacts

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

## Scope and intent

- Establish explicit application use-case contracts for logical asset operations.
- Keep asset interactions scoped to workspace/user/operation context, not ad hoc filesystem helpers.
- Ensure callers use logical identifiers (`assetId`, `storageInstanceId`, `objectKey`) for all operations.
- Define ports for authorization, content grant/finalization, preview/media lookup, and audit emission.
- Provide shared API-safe payload contracts for transport and event projection.

## Use-case contract coverage

`AssetServiceContracts` now defines request/result contracts for:

- register asset
- get asset by id
- list assets with scoped filters
- finalize upload into an asset version
- authorize protected download content access
- resolve preview asset bindings
- register generated output asset + lineage links
- archive asset and delete asset lifecycle operations

Error/result envelopes mirror established application service patterns (`ok`/`error` with stable codes).

## Port boundaries

`src/application/assets/ports` now includes dedicated interfaces for:

- `IAssetRepository` (persistence)
- `IAssetAuthorizationPort` (policy and access resolution)
- `IAssetContentPort` (upload finalization and protected read grants)
- `IAssetPreviewPort` + `IAssetMediaPort` (preview/media integration seams)
- `AssetAuditSink` and event payload contracts (audit recording)

This prevents higher layers from bypassing use-case boundaries with direct content/path access behavior.

## Validation posture

Application request validators normalize and enforce:

- required actor/workspace/mutation context identifiers
- bounded pagination fields
- positive duration/count inputs
- logical object-key semantics (reject absolute/drive-prefixed/traversal/windows-separator path forms)

These checks keep filesystem-specific concerns out of public use-case contracts while preserving domain invariants.

## Shared transport/event contracts

`AssetTransportContracts` + `AssetTransportDtos` now provide:

- asset summary/detail DTOs
- download authorization DTO projection
- preview resolution DTO projection
- audit event payload DTO projection
- DTO-to-application request normalization helpers

Payloads remain API-safe and infrastructure-agnostic.

## Test coverage

- `AssetServiceContracts.test.ts` validates application request normalization and boundary rejection cases.
- `AssetTransportContracts.test.ts` validates transport projection shape and path-safe download payload behavior.
- `AssetTransportDtos.test.ts` validates DTO normalization into application-layer contract inputs.

## Boundary posture

- Dependencies remain inward-pointing (domain + application contracts first).
- Shared contracts/DTOs avoid leaking backend-specific adapter concerns.
- Future API handlers can integrate against stable logical asset interfaces without redesign.

## Story 10.1.5: raw-path quarantine

- Desktop renderer-facing model file bridge contracts now use logical model paths (relative to managed model roots) instead of raw absolute filesystem paths.
- Electron main process path resolution for model files is isolated in `electron/main/ModelFilePathPolicy.ts` with explicit rejection of absolute, drive-prefixed, traversal, and out-of-root path input.
- Absolute filesystem paths remain infrastructure-only details via `DesktopBridgeFileStorage` translation; UI/IPC/public bridge contracts no longer require raw path input/output for this asset-facing flow.

## Story 10.2.1: authenticated asset registration and upload initiation

- Added concrete upload-initiation orchestration in:
  - `src/application/assets/use-cases/AssetUploadInitiationService.ts`
- Added request/response contracts for upload initiation in:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/shared/dto/assets/AssetTransportDtos.ts`
- Added authoritative API adapter and SDK contracts:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport endpoints:
  - `POST /api/v1/assets/register`
  - `POST /api/v1/assets/:assetId/uploads/initiate`
  - implemented in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires asset upload-initiation services and persistence:
  - `hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- authenticated workspace membership is required for both registration and upload initiation.
- ownership intent is enforced:
  - non-admin actors cannot register assets for another owner user.
  - private asset upload initiation requires owner or workspace administrator.
- storage eligibility is enforced before asset registration/upload initiation:
  - storage instance must exist in workspace.
  - storage instance must be active and writable.
  - storage policy evaluation (`use-for-assets`) must allow action.
  - `maxObjectBytes` constraints are applied to declared upload size.
- upload initiation responses return logical asset id + server-approved upload session metadata (`uploadSessionId`, logical `objectKey`, `uploadEndpoint`) instead of filesystem destinations.

Added coverage:

- `src/application/assets/tests/AssetUploadInitiationService.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`


## Story 10.2.2: protected upload ingestion and finalization

Added authoritative upload ingestion/finalization through application and transport layers:

- New upload-session persistence seam and SQLite adapter:
  - `src/application/assets/ports/IAssetUploadSessionRepository.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetUploadSessionPersistenceAdapter.ts`
- New stream-based ingestion/finalization orchestration:
  - `src/application/assets/use-cases/AssetUploadIngestionService.ts`
- API/transport extensions for upload-session content ingestion:
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

Behavioral posture:

- Upload initiation persists pending upload session state (expected file name/mime/size + logical object key).
- Content ingestion is server-mediated and adapter-based (`IStorageObjectPort`) with stream handling.
- Asset metadata is finalized only after successful write.
- Upload failures (oversized/interrupted/write failure) mark sessions as `incomplete` and avoid corrupt ready-state metadata updates.
- Best-effort object cleanup is executed on failure paths.

Added coverage:

- `src/application/assets/tests/AssetUploadIngestionService.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetUploadSessionPersistenceAdapter.test.ts`
- updated asset management API/HTTP tests for upload-session content handling.

## Story 10.2.3: scoped logical asset discovery endpoints

Added authoritative scoped listing/discovery flow across application, API, transport, and persistence seams:

- New listing/query use case:
  - `src/application/assets/use-cases/AssetDiscoveryService.ts`
- Extended list query contracts for scoped discovery:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/application/assets/ports/IAssetRepository.ts`
- Persistence adapter now supports creator-scoped filtering:
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- Extended API contracts + backend:
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets`
  - implemented in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires asset discovery service:
  - `hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- listing requires active workspace membership.
- private assets are only returned to the asset owner (or workspace administrator).
- workspace/shared/published assets are listable to authorized workspace members.
- scope-aware queries are supported for:
  - `scope` (`private` | `workspace` | `all`)
  - `ownerUserId`
  - `createdByUserId`
  - `assetKinds`
  - `lifecycleStates` (status)
  - source lineage references
  - pagination (`limit`, `offset`) with stable `hasMore` metadata.
- payloads return presentation-safe logical metadata only (no filesystem paths or storage backend internals).

Added coverage:

- `src/application/assets/tests/AssetDiscoveryService.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.2.4: protected asset detail lookup and metadata retrieval

Added authoritative secure detail retrieval across application, API, transport, and host composition:

- New detail lookup use case:
  - `src/application/assets/use-cases/AssetDetailService.ts`
- Extended get-by-id contract validation:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/shared/dto/assets/AssetTransportDtos.ts`
- Extended detail transport projection with policy-aware operational metadata:
  - ownership context
  - upload state
  - preview availability
  - allowed actions
  - server operation links
  - lineage source hooks
  - implemented in `src/shared/contracts/assets/AssetTransportContracts.ts`
- Extended API contracts and backend:
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets/:assetId`
  - implemented in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host wiring now composes asset detail service:
  - `hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- detail retrieval requires active workspace membership.
- private asset details are owner/admin-only and non-authorized lookups return safe `not-found`.
- deleted assets remain hidden by default unless `includeDeleted=true`.
- detail responses remain list-consistent and logical-id based; no raw storage filesystem data is exposed.

Added coverage:

- `src/application/assets/tests/AssetDetailService.test.ts`
- `src/application/assets/tests/AssetServiceContracts.test.ts`
- `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/AssetTransportDtos.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.2.5: secure download authorization and protected content streaming

Added authoritative protected download authorization and server-streamed retrieval across application, API, transport, and host seams:

- New download orchestration use case:
  - `src/application/assets/use-cases/AssetDownloadService.ts`
- New opaque grant contract for protected content read tokens:
  - `src/application/assets/ports/AssetDownloadGrantPort.ts`
- New encrypted token adapter for grant issuance/resolution:
  - `src/infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter.ts`
- Extended API contracts and backend:
  - `infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoints:
  - `POST /api/v1/assets/:assetId/downloads/authorize`
  - `GET /api/v1/assets/:assetId/downloads/content`
  - implemented in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host wiring now composes download grant and streaming dependencies:
  - `hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- download authorization requires active workspace membership and visibility-aware asset access checks.
- private assets remain owner/admin constrained; disallowed reads are blocked with clean, non-leaky behavior.
- storage logical-access/policy enforcement gates both authorization and stream-open flows.
- protected-purpose restrictions apply:
  - `inline-preview` requires preview-compatible mime types and storage preview decryption allowance.
  - `worker-process` requires worker-eligible asset kinds and storage worker decryption allowance.
- content retrieval is streamed from managed storage through server handlers (no eager full-file buffering).
- stream responses set safe headers (`Content-Disposition`, `X-Content-Type-Options`, `Cache-Control`).
- download authorization payloads expose only opaque tokenized metadata, not object keys or path internals.

Added coverage:

- `src/application/assets/tests/AssetDownloadService.test.ts`
- `src/infrastructure/security/assets/tests/EncryptedAssetDownloadGrantAdapter.test.ts`
- `infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 11.3.2: policy-aware encryption enforcement during ingest and retrieval

Added policy-aware encryption-at-rest enforcement for logical asset content paths:

- Upload ingestion now evaluates effective encryption policy for `asset-content` before writes.
- Scoped-content-required policies now encrypt bytes on ingest through server-managed AES-GCM content-cipher adapters.
- Asset versions now persist optional encrypted-content descriptors for controlled decryption (`asset_versions.content_encryption_descriptor`) without exposing raw filesystem paths.
- Download authorization and stream-open flows now enforce effective policy on retrieval:
  - fail closed if policy requires encryption but content is plaintext,
  - gate preview/worker decryption only when encrypted content is involved,
  - decrypt encrypted streams server-side for authorized callers.
- Host composition now wires workspace/storage-aware encryption policy context resolution plus scoped key resolution/material adapters for asset content operations.

Added/extended coverage:

- `src/application/assets/tests/AssetUploadIngestionService.test.ts`
- `src/application/assets/tests/AssetDownloadService.test.ts`
- `src/infrastructure/security/encryption/tests/AesGcmAssetContentCipherPort.test.ts`
- `src/infrastructure/security/encryption/tests/DeterministicScopeEncryptionKeyPort.test.ts`
- `src/infrastructure/persistence/assets/tests/AssetPersistenceMapper.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`
