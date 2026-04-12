# Unified API Endpoint Reference

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.2, Deliver Authoritative Server Endpoints and Real-Time APIs for Shared Client Use
- Story: 14.2.8, Publish endpoint-level documentation and integration examples for the converged APIs

## Purpose

This document is the endpoint-level reference for the converged authoritative API surface used by desktop, browser, and mobile-responsive clients.

Use it to trace, per route family:

1. authoritative route registration module
2. backend API module
3. shared contract/schema module
4. shared client usage module
5. authorization/session expectations
6. runtime realtime topic model

## Canonical route-family registration

The authoritative route-family catalog is composed in:

- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`

Canonical family modules:

- `src/infrastructure/transport/http-server/authoritative-route-families/IdentityAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/WorkspaceAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/AuthorizationAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/AuditAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/NodeTrustAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/SecurityAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/StorageAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/AssetAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/ImageAssetAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`

## Traceability matrix

| Route family id | Prefixes | Backend API modules | Shared contracts and schemas | Shared client usage |
| --- | --- | --- | --- | --- |
| `identity-auth` | `/api/v1/identity` | `src/infrastructure/api/identity/IdentityAuthBackendApi.ts` | `src/shared/contracts/identity/IdentityTransportContracts.ts` + `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts` | `src/ui/shared/identity/IdentityAuthClient.ts` |
| `workspace-invitations` + `workspace-administration` | `/api/v1/workspaces/invitations`, `/api/v1/workspaces/onboarding`, `/api/v1/workspaces` | `src/infrastructure/api/workspaces/WorkspaceInvitationBackendApi.ts`, `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts` | `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts` + `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts` | `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts` |
| `authorization-management` | `/api/v1/authorization` | `src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts` | `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`, `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`, `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts` | `src/ui/shared/authorization/AuthorizationManagementClient.ts` |
| `deployment-policy-read` + `deployment-policy-write` | `/api/v1/deployment/policy` | `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`, `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts` | `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`, `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`, `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`, `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts` | `src/ui/shared/api/SharedApiClient.ts` (admin/system policy read/write consumers) |
| `audit-ledger` | `/api/v1/audit/events` | `src/infrastructure/api/audit/AuditLedgerBackendApi.ts` | `src/shared/contracts/audit/AuditEventContracts.ts`, `src/shared/dto/audit/AuditEventDtos.ts`, `src/shared/schemas/audit/AuditEventSchemaContracts.ts` | `src/ui/shared/api/SharedApiClient.ts` (authoritative admin/governance retrieval clients) |
| `node-trust` | `/api/v1/nodes` | `src/infrastructure/api/nodes/NodeTrustBackendApi.ts` | `src/shared/contracts/nodes/NodeTrustApiContracts.ts` + `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts` | `src/ui/shared/nodes/NodeEnrollmentReviewClient.ts`, `src/ui/shared/nodes/NodeInventoryClient.ts` |
| `security-certificate-operations` + `security-secret-metadata` | `/api/v1/security/certificates`, `/api/v1/security/secrets` | `src/infrastructure/api/security/CertificateOperationsBackendApi.ts`, `src/infrastructure/api/security/SecretMetadataBackendApi.ts` | `src/shared/contracts/security/SecretTransportContracts.ts`, `src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts`, `src/shared/schemas/security/SecretApiSchemaContracts.ts` | `src/ui/shared/security/SecretMetadataManagementClient.ts` |
| `storage-management` | `/api/v1/storage` | `src/infrastructure/api/storage/StorageManagementBackendApi.ts` | `src/shared/schemas/storage/StorageTransportSchemaContracts.ts` (plus DTO contracts via `src/infrastructure/api/storage/sdk/PublicStorageManagementApiContract.ts`) | `src/ui/shared/storage/StorageAdministrationClient.ts` |
| `asset-management` | `/api/v1/assets` | `src/infrastructure/api/assets/AssetManagementBackendApi.ts` | `src/shared/contracts/assets/AssetWorkflowClientContracts.ts` | `src/ui/shared/assets/AssetWorkflowClient.ts` |
| `image-asset-management` | `/api/v1/image-assets` | `src/infrastructure/api/image-assets/ImageAssetManagementBackendApi.ts` | `src/shared/contracts/assets/ImageAssetTransportContracts.ts`, `src/infrastructure/api/image-assets/sdk/PublicImageAssetManagementApiContract.ts` | authoritative server integration surface for desktop/thin clients (shared client adapter pending story scope) |
| `image-run-api` | `/api/v1/image-systems`, `/api/v1/image-runs` | `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`, `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`, `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts` | `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`, `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts` | authoritative image-run studio/thin-client monitoring + control surface (shared image-run client adapter pending story scope) |
| `system-runtime` | `/api/v1/runtime` and websocket path `/ws` | `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`, `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts` | `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`, `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`, `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`, `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts` | `src/ui/shared/runtime/RuntimeControlClient.ts` |

## Endpoint groups and auth expectations

### Identity session and account lifecycle (`/api/v1/identity/*`)

- Public bootstrap routes:
  - `POST /api/v1/identity/register`
  - `POST /api/v1/identity/login`
  - `POST /api/v1/identity/dev-login` (development mode only)
- Authenticated session routes:
  - `GET /api/v1/identity/session`
  - `GET /api/v1/identity/session/context`
  - `POST /api/v1/identity/logout`
  - `POST /api/v1/identity/session/revoke`
  - trusted-device lifecycle and credential routes under `/api/v1/identity/trusted-devices/*` and `/api/v1/identity/credential/change`
- Admin/trusted-session routes:
  - `/api/v1/identity/admin/*`

Authoritative policy expectations:

- bearer session required for authenticated/admin routes
- trusted-session assurance required for high-assurance admin/security routes

Reference: `docs/architecture/identity-server-api.md`

### Workspace administration and onboarding (`/api/v1/workspaces/*`)

- workspace CRUD/admin view: `/api/v1/workspaces` and `/api/v1/workspaces/:workspaceId/*`
- memberships, invitations, and role-assignment mutation routes
- onboarding acceptance: `/api/v1/workspaces/:workspaceId/onboarding/accept`

Authoritative policy expectations:

- bearer session required
- workspace-scoped authorization enforced in backend + transport guards

### Authorization visibility and sharing (`/api/v1/authorization/*`)

- resource access-state read
- visibility update
- sharing grant create/revoke
- workspace sharing reporting
- workspace-role bulk upsert

Authoritative policy expectations:

- bearer session required
- policy decisions are evaluated server-side from actor + resource context

### Deployment policy administration read (`/api/v1/deployment/policy/*`)

- state read:
  - `GET /api/v1/deployment/policy/state`
- query options:
  - `workspaceId` (required)
  - `profileId` (optional)
  - `includeCatalog`, `includeOverrideRecords`, `includeEffectiveMetadata` (optional booleans)
  - `evaluatedAt` (optional ISO timestamp)

Authoritative policy expectations:

- bearer session required
- workspace scope required (`workspaceId`)
- policy state inspection uses canonical server-side read contracts; clients do not read deployment-policy repositories/configuration directly

### Deployment policy administration write (`/api/v1/deployment/policy/*`)

- active profile mutation:
  - `POST /api/v1/deployment/policy/active-profile`
- override mutation:
  - `POST /api/v1/deployment/policy/overrides`

Authoritative policy expectations:

- bearer session required
- workspace scope required (`workspaceId`)
- policy writes are validated and authorized server-side using canonical write contracts/schemas and authoritative update orchestration; clients do not write raw untyped configuration blobs

### Audit ledger read/query (`/api/v1/audit/events*`)

- list/read:
  - `GET /api/v1/audit/events`
  - `GET /api/v1/audit/events/:eventId`
- shared query/filter contract is parsed from URL search params using audit schema contracts.
- pagination and error semantics follow shared canonical API conventions.

Authoritative policy expectations:

- bearer session required
- workspace scope required (`workspaceId` query parameter)
- permission-aware projection enforced by audit query authorizer:
  - admin audiences can read protected-data detail (`visibility: admin`)
  - non-admin audiences are thin-safe and user-safe redacted (`visibility: user-safe`)

### Node trust (`/api/v1/nodes/*`)

- enrollment submit/review routes
- inventory read routes
- node revoke/heartbeat/runtime trust-material routes

Authoritative policy expectations:

- enrollment submission is allowed for bootstrap channel routes
- review/admin and protected node lifecycle routes require authenticated administrative context

### Security secret metadata and certificate operations (`/api/v1/security/*`)

- secret metadata create/list/read/rotate/disable
- secret diagnostics/health/maintenance routes
- certificate authority status/list/detail/revoke/renew routes

Authoritative policy expectations:

- bearer session required
- trusted-session assurance required for certificate operations and privileged secret administration

### Storage management (`/api/v1/storage/*`)

- create/list/detail/update metadata/activate/deactivate/health under `/api/v1/storage/instances/*`

Authoritative policy expectations:

- bearer session required
- workspace-scoped policy checks enforced in storage backend API

Reference: `docs/architecture/storage-server-api.md`

### Asset workflows (`/api/v1/assets/*`)

- list/detail
- upload initiation/content ingest
- download authorization/content retrieval
- preview resolution

Authoritative policy expectations:

- bearer session required
- workspace + visibility authorization checks are enforced server-side

### Image asset ingestion and metadata (`/api/v1/image-assets*`)

- metadata:
  - `GET /api/v1/image-assets`
  - `GET /api/v1/image-assets/:assetId`
- ingestion:
  - `POST /api/v1/image-assets`
  - `POST /api/v1/image-assets/:assetId/uploads/:uploadSessionId/content`
  - `POST /api/v1/image-assets/:assetId/uploads/:uploadSessionId/complete`
- protected content retrieval:
  - `GET /api/v1/image-assets/:assetId/original`

Authoritative policy expectations:

- bearer session required
- workspace scope required (`workspaceId`)
- transport handlers delegate to image application use cases via `ImageAssetManagementBackendApi`; no raw storage path exposure in response DTOs and no direct public file URL bypasses for original-image retrieval

### Runtime control and realtime (`/api/v1/runtime/*`, `/ws`)

- run control/read:
  - `POST /api/v1/runtime/runs/start`
  - `GET /api/v1/runtime/execution/readiness`
  - `POST /api/v1/runtime/runs/:executionId/cancel`
  - `GET /api/v1/runtime/runs/:executionId/status`
  - `GET /api/v1/runtime/runs/:executionId/result`
  - `GET /api/v1/runtime/runs/:executionId/trace`
- queue control/read:
  - `GET /api/v1/runtime/queue`
  - `POST /api/v1/runtime/queue/:queueItemId/dequeue`
- realtime upgrade path:
  - `GET /ws` with `purpose` and optional `workspaceId` query params

Authoritative policy expectations:

- bearer session required
- workspace scope required for workspace-bound runtime operations
- websocket topic subscriptions must satisfy purpose/topic policy and workspace scope matching

Readiness endpoint intent:

- `GET /api/v1/runtime/execution/readiness` is the authoritative adapter-backed readiness surface for image-manipulation execution.
- Desktop/thin clients and later studio/admin readiness flows should use this route instead of direct backend probes.
- Response shape is normalized for UX/operations consumers: backend readiness state, actionable `readyForExecution`, capability summary, and issue list.

### Image run authoritative aliases (`/api/v1/image-systems/*`, `/api/v1/image-runs*`)

- image-oriented authoritative route aliases:
  - `POST /api/v1/image-systems/:systemId/runs` (submission)
  - `GET /api/v1/image-runs` (list)
  - `GET /api/v1/image-runs/:runId` (detail)
  - `POST /api/v1/image-runs/:runId/cancel` (cancellation)
- all aliases require bearer auth + `workspaceId` scope and delegate to authoritative run orchestration backend APIs.
- transport handlers remain thin wrappers over run submission/query/mutation use cases; no direct studio-to-backend execution shortcuts.

## Runtime realtime event delivery model

Canonical runtime realtime topic constants:

- `RuntimeRealtimeTopics.runStatus` -> `runtime.run.status`
- `RuntimeRealtimeTopics.queue` -> `runtime.queue`
- `RuntimeRealtimeTopics.connectivity` -> `runtime.connectivity`
- `RuntimeRealtimeTopics.admin` -> `runtime.admin`

Canonical websocket message types:

- `runtime-realtime.subscription-ack`
- `runtime-realtime.event`
- `runtime-realtime.error`

Canonical request action:

- `runtime-realtime.subscribe`

Reference contracts:

- `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`

Reference transport behavior:

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`

## Integration examples (shared client production patterns)

### Example 1: Session bootstrap + workspace administration read

```ts
import { HttpIdentityAuthClient } from "@ui/shared/identity/IdentityAuthClient";
import { HttpWorkspaceAdministrationClient } from "@ui/shared/workspaces/WorkspaceAdministrationClient";

const identityClient = new HttpIdentityAuthClient("http://127.0.0.1:8787");
const workspaceClient = new HttpWorkspaceAdministrationClient("http://127.0.0.1:8787");

const login = await identityClient.loginLocalAccount({
  providerSubject: "alice",
  credential: { candidate: "StrongPass!2026" },
  accessChannel: "desktop",
});
if (!login.ok) {
  throw new Error(login.error?.message ?? "login failed");
}

const sessionToken = login.data.sessionToken;
const workspaces = await workspaceClient.listWorkspaces(
  { limit: 20, offset: 0 },
  sessionToken,
);
```

### Example 2: Runtime control mutation with shared transport envelope parsing

```ts
import { HttpRuntimeControlClient } from "@ui/shared/runtime/RuntimeControlClient";

const runtimeClient = new HttpRuntimeControlClient("http://127.0.0.1:8787");

const start = await runtimeClient.startRun(
  {
    workspaceId: "workspace-alpha",
    systemId: "system:image-manipulation",
    versionId: "version:2026-04-07",
    async: true,
  },
  sessionToken,
);

if (!start.ok) {
  throw new Error(start.error?.message ?? "runtime start failed");
}
```

### Example 3: Runtime realtime websocket subscription using shared contracts

```ts
import { RuntimeRealtimeTopics } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import { parseRuntimeRealtimeWebSocketEventMessage } from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";

const ws = new WebSocket(
  "ws://127.0.0.1:8787/ws?purpose=run-monitoring&workspaceId=workspace-alpha",
  [],
);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    action: "runtime-realtime.subscribe",
    request: {
      topics: [
        {
          topic: RuntimeRealtimeTopics.runStatus,
          workspaceId: "workspace-alpha",
          executionId: "execution-123",
        },
      ],
      mode: "live-only",
    },
  }));
});

ws.addEventListener("message", (event) => {
  const payload = JSON.parse(String(event.data));
  const parsed = parseRuntimeRealtimeWebSocketEventMessage(payload);
  if (parsed.type === "runtime-realtime.event") {
    console.log(parsed.event.topic, parsed.event.runScope.executionId);
  }
});
```

## Contributor notes for client implementations

Preferred pattern for new thin/desktop HTTP clients:

1. compose `src/ui/shared/api/SharedApiClient.ts`
2. import route constants and DTO contracts from `src/shared/contracts/*`
3. parse with `src/shared/schemas/*` where domain schemas exist

Current migration seam status:

- clients already on `SharedApiClient`: identity, workspace administration, runtime control
- clients still using direct `fetch` transport wrappers: authorization, node trust, secret metadata, storage administration, asset workflow

When touching a direct `fetch` shared client, migrate toward `SharedApiClient` unless blocked by story scope.

## Related docs

- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.md`
- `docs/architecture/identity-server-api.md`
- `docs/architecture/storage-server-api.md`
- `docs/unified-api-contributor-guide.md`
- `docs/unified-api-observability-troubleshooting.md`
