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
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport endpoints:
  - `POST /api/v1/assets/register`
  - `POST /api/v1/assets/:assetId/uploads/initiate`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires asset upload-initiation services and persistence:
  - `src/hosts/server/IdentityServerHost.ts`

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
- `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`


## Story 10.2.2: protected upload ingestion and finalization

Added authoritative upload ingestion/finalization through application and transport layers:

- New upload-session persistence seam and SQLite adapter:
  - `src/application/assets/ports/IAssetUploadSessionRepository.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetUploadSessionPersistenceAdapter.ts`
- New stream-based ingestion/finalization orchestration:
  - `src/application/assets/use-cases/AssetUploadIngestionService.ts`
- API/transport extensions for upload-session content ingestion:
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

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
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires asset discovery service:
  - `src/hosts/server/IdentityServerHost.ts`

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
- `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

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
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets/:assetId`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host wiring now composes asset detail service:
  - `src/hosts/server/IdentityServerHost.ts`

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
- `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.2.5: secure download authorization and protected content streaming

Added authoritative protected download authorization and server-streamed retrieval across application, API, transport, and host seams:

- New download orchestration use case:
  - `src/application/assets/use-cases/AssetDownloadService.ts`
- New opaque grant contract for protected content read tokens:
  - `src/application/assets/ports/AssetDownloadGrantPort.ts`
- New encrypted token adapter for grant issuance/resolution:
  - `src/infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter.ts`
- Extended API contracts and backend:
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
- Added authenticated transport endpoints:
  - `POST /api/v1/assets/:assetId/downloads/authorize`
  - `GET /api/v1/assets/:assetId/downloads/content`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host wiring now composes download grant and streaming dependencies:
  - `src/hosts/server/IdentityServerHost.ts`

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
- `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

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

## Story 10.3.1: generated outputs as first-class logical assets

Added authoritative generated-output registration across application/API/transport seams:

- New generated-output registration use case:
  - `src/application/assets/use-cases/AssetGeneratedOutputRegistrationService.ts`
- Extended contracts and detail metadata for producer linkage:
  - `src/application/assets/use-cases/AssetServiceContracts.ts`
  - `src/application/assets/use-cases/AssetDetailService.ts`
  - `src/shared/contracts/assets/AssetTransportContracts.ts`
  - `src/shared/dto/assets/AssetTransportDtos.ts`
- Extended backend API and public SDK contract:
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport endpoint for generated output registration:
  - `POST /api/v1/assets/generated-outputs/register`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires generated-output registration dependencies:
  - `src/hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- generated outputs are created as `kind=generated-output` assets through a dedicated use case, not ad hoc output-file paths.
- owner remains optional:
  - when omitted, generated outputs are workspace-owned and default visibility is `workspace`.
  - when provided, ownership delegation to another user requires workspace admin permissions.
- producer references are now first-class generated-output metadata:
  - `source.producerType = "run" | "system"`
  - run/system identifiers are validated and persisted for orchestration-compatible lineage hooks.
- generated-output lineage links are persisted alongside source metadata and remain discoverable by existing source-asset list filters.
- generated outputs use the same retrieval surfaces as uploads:
  - `GET /api/v1/assets`
  - `GET /api/v1/assets/:assetId`
  - download authorization/content endpoints
  without exposing raw output filesystem paths.

Added coverage:

- `src/application/assets/tests/AssetGeneratedOutputRegistrationService.test.ts`
- updated:
  - `src/application/assets/tests/AssetServiceContracts.test.ts`
  - `src/application/assets/tests/AssetDetailService.test.ts`
  - `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
  - `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`
  - `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.2: preview and thumbnail derivatives as protected resources

Added protected preview-resolution orchestration across application/API/transport seams:

- New application use case for authoritative preview resolution:
  - `src/application/assets/use-cases/AssetPreviewService.ts`
- Extended backend/public API contracts with preview-resolution operation:
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `src/infrastructure/api/assets/sdk/PublicAssetManagementApiContract.ts`
- Added authenticated transport endpoint:
  - `GET /api/v1/assets/:assetId/preview`
  - implemented in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition now wires preview-resolution dependencies:
  - `src/hosts/server/IdentityServerHost.ts`

Behavioral posture in this story:

- previews and thumbnails are resolved through protected logical-asset metadata, not public files or raw path contracts.
- parent asset access checks (workspace membership, lifecycle, visibility) gate all preview resolution.
- derivative candidates are resolved as lineage-linked logical assets (`kind=preview|derived`) and filtered by the same visibility rules as other assets.
- optional `preferredMimeType` query values support deterministic preview/thumbnail selection (for example, preferring `image/webp` over `image/png`).
- stricter derivative visibility policies are honored automatically because derivative assets are evaluated independently with the same authorization pattern.
- when no derivative exists, source-version inline preview is only exposed for previewable mime types.
- preview content still flows through protected tokenized download endpoints (`inline-preview`) to preserve storage/decryption policy enforcement.

Added/extended coverage:

- `src/application/assets/tests/AssetPreviewService.test.ts`
- `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.3: protected asset operation audit integration

Added structured asset-audit integration for high-value protected asset operations through application seams and host composition:

- Added best-effort publish + sanitization helper for asset audit events:
  - `src/application/assets/ports/AssetAuditPort.ts`
- Updated high-value asset services to emit structured outcomes (`success` / `rejected` / `already-applied`) and avoid raw path/content leakage:
  - upload registration/initiation/finalization
  - download authorization + protected stream-open
  - preview resolution
  - generated-output registration
  - `src/application/assets/use-cases/AssetUploadInitiationService.ts`
  - `src/application/assets/use-cases/AssetUploadIngestionService.ts`
  - `src/application/assets/use-cases/AssetDownloadService.ts`
  - `src/application/assets/use-cases/AssetPreviewService.ts`
  - `src/application/assets/use-cases/AssetGeneratedOutputRegistrationService.ts`
- Added asset lifecycle mutation use case so archive/delete actions emit authoritative audit events:
  - `src/application/assets/use-cases/AssetLifecycleService.ts`
- Added API/transport lifecycle operations:
  - `POST /api/v1/assets/:assetId/archive`
  - `POST /api/v1/assets/:assetId/delete`
  - `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Added persistent SQLite asset audit recorder and host wiring:
  - `src/infrastructure/persistence/assets/SqliteAssetAuditRecorder.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceMigrations.ts` (asset audit event table/indexes)
  - `src/hosts/server/IdentityServerHost.ts`

Audit payload posture in this story:

- includes actor identity, workspace context, asset id, operation type, correlation/operation keys, and coarse outcome metadata.
- excludes raw filesystem paths, logical object keys, secret/token/content-like details through publish-time sanitization.
- preserves best-effort behavior: protected asset workflows continue when audit persistence fails.

Added/extended coverage:

- `src/application/assets/tests/AssetAuditPort.test.ts`
- `src/application/assets/tests/AssetLifecycleService.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetAuditRecorder.test.ts`
- updated:
  - `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
  - `src/infrastructure/api/assets/tests/AssetManagementBackendApi.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAssetManagement.test.ts`

## Story 10.3.4: shared client-safe contracts and UI asset workflow integration

Added shared client-safe workflow contracts and a representative UI-facing integration slice for logical assets:

- New shared request/response and helper contracts for desktop/thin-client parity:
  - `src/shared/contracts/assets/AssetWorkflowClientContracts.ts`
- Added shared contract coverage:
  - `src/shared/contracts/assets/tests/AssetWorkflowClientContracts.test.ts`

New renderer integration seams:

- Shared HTTP client adapter for protected asset workflows:
  - `ui/shared/assets/AssetWorkflowClient.ts`
- UI-facing service wrapper:
  - `ui/services/AssetWorkflowService.ts`
- Added tests:
  - `ui/shared/assets/tests/AssetWorkflowClient.test.ts`
  - `ui/services/tests/AssetWorkflowService.test.ts`

Representative end-to-end UI-facing flow now uses logical asset APIs:

- `/assets` route now renders `AssetsPage` directly (`ui/routes/AppRouter.tsx`).
- `ui/pages/AssetsPage.tsx` now supports:
  - scoped logical asset listing,
  - protected asset detail retrieval,
  - preview resolution,
  - secure download authorization (tokenized content path generation),
  - upload session initiation.

Boundary posture in this story:

- UI state remains logical-id based (`workspaceId`, `assetId`, `storageInstanceId`, `versionId`) and does not require raw filesystem path knowledge.
- Download and preview actions are exposed as protected API actions; no object-key/path internals are required in presentation code.
- Shared client-safe contracts are reusable across desktop and thin-client transport adapters.

## Story 10.3.5: operational safeguards, non-leaky errors, and extension guidance

Hardened protected asset flows with production safeguards across application validation, API mapping, and transport logging:

- Added stricter request guardrails for upload-related content metadata:
  - bounded declared size checks in asset service contracts (`sizeBytes` upper bounds),
  - stricter media-type validation for declared/uploaded mime values,
  - upload-ingestion content-type compatibility checks against upload-session expectations.
- Normalized non-leaky backend error mapping:
  - asset service errors are translated to API errors with stable code mapping and sanitized messages,
  - API error `details` now redact path/object-key/file-name/content/token-like keys before transport responses.
- Hardened streaming failure behavior:
  - protected download stream failures now return internal-safe error payloads rather than request-validation-style errors.
- Extended request/response logging safeguards:
  - identity transport payload redaction now covers asset-sensitive keys (`objectKey`, `fileName`, `path`, related metadata) so operational logs avoid storage-location leakage.

Developer extension rules for Feature 10 onward:

- No raw-path contracts across application/shared/UI/API surfaces. Keep filesystem paths and backend roots infrastructure-private.
- Use logical identifiers (`workspaceId`, `assetId`, `storageInstanceId`, logical `objectKey`) at boundaries and resolve physical storage only through storage access/adaptor services.
- Keep preview and download flows protected:
  - preview resolution returns logical metadata only,
  - content retrieval remains tokenized and server-mediated,
  - no direct/public object URL publication from asset metadata endpoints.
- Register generated outputs through authoritative generated-output APIs and lineage metadata, never by writing ad hoc output paths and backfilling later.

Forward-looking extension notes (future epics):

- explicit sharing policy evaluation can extend the same sanitized error surface and logical-asset authorization seams.
- publishable/share links should reuse opaque grant patterns with short-lived scope and redacted audit/log payload posture.
- scoped content encryption can extend existing encryption policy/key-resolution seams without changing external asset contracts.

## Story 11.3.3: authorized preview/worker decryption gates

Added explicit application-layer decryption gate evaluation in protected asset retrieval so encrypted content is only decrypted for the requesting operation when policy allows it:

- Updated `AssetDownloadService` to evaluate a decryption-authorization decision object (not just raw booleans) for encrypted content requests.
- Enforced explicit purpose-scoped decryption outcomes for:
  - `inline-preview` (preview decryption gate),
  - `worker-process` (worker decryption gate).
- Gate enforcement now happens in both phases:
  - before issuing temporary content access material (`authorizeAssetDownload`),
  - before opening/decrypting server-managed content streams (`openAuthorizedAssetDownloadStream`).
- Added explicit grant scope validation (`workspaceId`, `actorUserId`, `assetId`) after token resolution, so decryption remains actor/context-bound even if downstream grant adapters misbehave.
- Added rejected audit outcomes for decryption gate denials and encryption-required violations, with stable machine-readable reason codes suitable for future governance and signed/temporary-access evolution.

Coverage added/extended:

- `src/application/assets/tests/AssetDownloadService.test.ts`
  - preview decryption denied when policy disallows,
  - worker decryption denied when policy disallows,
  - stream-open re-evaluates policy and denies decryption when posture changes after token issuance,
  - rejected audit event assertions for denied preview decryption.
