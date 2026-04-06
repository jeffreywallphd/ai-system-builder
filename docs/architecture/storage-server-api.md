# Storage Server API

This note documents Story 9.3.2 (Feature 9 / Epic 9.3): authoritative HTTP/API adapters for managed storage instance administration.

## Canonical artifacts

- `infrastructure/api/storage/sdk/PublicStorageManagementApiContract.ts`
- `infrastructure/api/storage/StorageManagementBackendApi.ts`
- `infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/api/storage/tests/StorageManagementBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerStorageManagement.test.ts`

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
