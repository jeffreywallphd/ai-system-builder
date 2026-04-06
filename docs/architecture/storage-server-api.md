# Storage Server API

This note documents Story 9.3.2 and Story 9.3.5 (Feature 9 / Epic 9.3): authoritative HTTP/API adapters for managed storage instance administration and durable storage audit governance integration.

## Canonical artifacts

- `src/infrastructure/api/storage/sdk/PublicStorageManagementApiContract.ts`
- `src/infrastructure/api/storage/StorageManagementBackendApi.ts`
- `src/infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/api/storage/tests/StorageManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerStorageManagement.test.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`

## Scope and intent

- Expose managed storage as an authoritative server API surface for desktop and thin clients.
- Keep clients on logical storage instance DTOs, not filesystem paths or backend mount details.
- Ensure policy enforcement, schema validation, and status/error mapping stay consistent with existing host/API conventions.

## Endpoint surface

- `POST /api/v1/storage/instances` (create)
- `GET /api/v1/storage/instances` (list)
- `GET /api/v1/storage/instances/:storageInstanceId` (detail)
- `PATCH /api/v1/storage/instances/:storageInstanceId/metadata` (metadata update)
- `POST /api/v1/storage/instances/:storageInstanceId/activate` (activate)
- `POST /api/v1/storage/instances/:storageInstanceId/deactivate` (deactivate)
- `GET /api/v1/storage/instances/:storageInstanceId/health` (capability + synchronization posture)

All routes require authenticated sessions and workspace-scoped policy evaluation.

## Validation and DTO posture

- Create/update/list/detail payload parsing uses shared storage transport schema contracts.
- Route/query validation returns deterministic `invalid-request` errors with structured validation details.
- Response payloads project through shared storage DTO helpers so sensitive references stay redacted.

## Error/status mapping

- Backend service/storage policy errors map to stable API error codes:
  - forbidden policy decisions -> `forbidden`
  - missing instances -> `not-found`
  - lifecycle/capability incompatibilities -> `invalid-state` / `capability-unsupported`
  - provisioning failures -> `provisioning-failed`
- HTTP transport maps API errors to consistent status codes (`400/401/403/404/409/422/500`).

## Boundary and security posture

- Storage policy checks are enforced in the application service through `IStoragePolicyEvaluationPort`.
- Host composition wires a workspace-aware policy adapter; transport does not bypass policy by directly touching persistence.
- No endpoint emits raw filesystem paths or backend binding internals.
- Health/capability responses expose only contract-safe capability metadata and synchronization posture.
- Host composition now wires `SqliteStorageManagementAuditRecorder` as the default storage management audit sink so core mutation actions persist governance events.

## Storage inspection semantics (Story 9.3.4)

`GET /api/v1/storage/instances/:storageInstanceId/health` now projects authoritative inspection diagnostics for admin consumption:

- lifecycle state (`lifecycleState`)
- typed operational classification (`operationalStatus`):
  - `healthy`
  - `unhealthy`
  - `inactive`
  - `unsupported`
- explicit inspection timing (`lastCheckedAt`)
- stable diagnosis reason (`reasonCode`)
- safe operational notes (`operationalNotes`)
- capability flags (`capabilities`) and synchronization metadata (`synchronization`, `synchronizationStatus`)

The route is backed by an application inspection use case and preserves redaction posture by avoiding raw backend endpoint/path disclosure.

## Storage audit integration (Story 9.3.5)

- Storage mutation routes continue to rely on application-layer audit emission rather than transport duplication.
- Audit payloads include actor identity, workspace context, storage instance identity, action type, and compact high-value mutation metadata.
- Sensitive audit fields are redacted before sink delivery by storage observability sanitization.
- Storage audit activity is queryable through the persistence seam (`SqliteStorageManagementAuditRecorder`) using recency/workspace/storage-instance lookup methods.
