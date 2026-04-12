# AI Companion: Storage Server API

## Purpose

Story 9.3.2 adds authoritative server-side adapters for managed storage instance administration so clients consume one secure API surface for storage lifecycle operations.
Story 9.3.5 extends this surface with durable storage-management audit governance integration at host composition.

## Canonical files

- `src/infrastructure/api/storage/sdk/PublicStorageManagementApiContract.ts`
- `src/infrastructure/api/storage/StorageManagementBackendApi.ts`
- `src/infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/api/storage/tests/StorageManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerStorageManagement.test.ts`
- `src/hosts/server/tests/IdentityServerHost.test.ts`

## API behavior

- Authenticated routes provide:
  - create
  - list
  - detail
  - metadata update
  - activate / deactivate
  - health/capability inspection
- Core payloads use shared storage DTO/schema contracts to keep host/API/UI shapes aligned.
- Metadata updates are intentionally constrained to metadata-safe fields; lifecycle and replication mutations remain dedicated operations.

## Validation and error posture

- Request body/query parsing uses shared storage schema validators where applicable.
- Validation failures return `invalid-request` with path/code/message issue records.
- Storage service failures map to stable API error taxonomy and then to HTTP status mapping.

## Security and boundary posture

- Policy checks run through the storage application service via `IStoragePolicyEvaluationPort`.
- Host composition wires a workspace-aware policy adapter; transport handlers never bypass policy by writing directly to storage persistence.
- Response projection uses shared DTO mappers with sensitive-reference redaction metadata.
- Endpoints do not expose raw filesystem paths.
- Host composition now also wires `SqliteStorageManagementAuditRecorder` as the `StorageManagementService` audit sink, so core storage mutation operations are durably recorded with redaction-safe payloads.

## Story 9.3.4 inspection contract additions

`GET /api/v1/storage/instances/:id/health` now returns typed inspection diagnostics for admin flows:

- `lifecycleState`
- `operationalStatus` (`healthy | unhealthy | inactive | unsupported`)
- `lastCheckedAt`
- `reasonCode`
- `operationalNotes` (safe notes only)
- capability flags and synchronization metadata

Inspection is sourced from a dedicated application use case (`inspectStorageInstanceStatus`) rather than ad hoc endpoint logic, preserving policy enforcement and consistent status semantics.

## Story 9.3.5 audit persistence posture

- Storage API mutation routes continue to rely on application-layer orchestration for audit emission (no transport duplication).
- Emitted audit payloads include actor/workspace/storage context and high-value mutation metadata, while sensitive connection/key locator values are redacted before sink delivery.
- Queryability is currently provided via the existing persistence seam (`SqliteStorageManagementAuditRecorder`) using recency/workspace/storage-instance lookup methods.
