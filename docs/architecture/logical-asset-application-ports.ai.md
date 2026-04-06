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
