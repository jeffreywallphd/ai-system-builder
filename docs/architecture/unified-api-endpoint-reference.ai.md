# AI Companion: Unified API Endpoint Reference

## Purpose

- Canonical endpoint-level index for Feature 14 / Epic 14.2 Story 14.2.8.
- Lets contributors trace each authoritative route family to backend API modules, shared contracts/schemas, and shared client usage.

## Canonical route-family registration

- Catalog: `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- Family modules:
  - `authoritative-route-families/IdentityAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/WorkspaceAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/AuthorizationAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/AuditAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/NodeTrustAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/SecurityAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/StorageAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/AssetAuthoritativeApiRoutes.ts`
  - `authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`

## Endpoint/auth map

- `identity-auth` -> `/api/v1/identity/*` (public register/login + authenticated session/admin/trusted-device routes)
- `workspace-*` -> `/api/v1/workspaces/*` (authenticated + workspace-scoped authorization)
- `authorization-management` -> `/api/v1/authorization/*` (authenticated policy-evaluated visibility/sharing/reporting)
- `deployment-policy-read` -> `/api/v1/deployment/policy/state` (authenticated workspace-scoped policy-state inspection; optional catalog/effective/provenance sections)
- `deployment-policy-write` -> `/api/v1/deployment/policy/active-profile`, `/api/v1/deployment/policy/overrides` (authenticated workspace-scoped policy administration writes with typed payload validation and authoritative permission enforcement)
- `audit-ledger` -> `/api/v1/audit/events*` (authenticated + workspace-scoped governance audit visibility)
- `node-trust` -> `/api/v1/nodes/*` (bootstrap enrollment + authenticated review/admin routes)
- `security-*` -> `/api/v1/security/certificates/*`, `/api/v1/security/secrets/*` (authenticated, trusted-session for high-assurance operations)
- `storage-management` -> `/api/v1/storage/*` (authenticated + workspace policy enforcement)
- `asset-management` -> `/api/v1/assets/*` (authenticated + workspace/visibility checks)
- `system-runtime` -> `/api/v1/runtime/*` + `/ws` realtime (authenticated + workspace/topic policy checks)

## Runtime realtime contracts

- Topics: `runtime.run.status`, `runtime.queue`, `runtime.connectivity`, `runtime.admin`
- Message types: `runtime-realtime.subscription-ack`, `runtime-realtime.event`, `runtime-realtime.error`
- Canonical files:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`

## Shared client integration pattern

- Use `src/ui/shared/api/SharedApiClient.ts` in new shared HTTP clients.
- Current clients already on `SharedApiClient`: `IdentityAuthClient`, `WorkspaceAdministrationClient`, `RuntimeControlClient`.
- Existing direct-fetch shared clients are migration seams: authorization, nodes, security secret metadata, storage, and assets.

## Canonical human doc

- `docs/architecture/unified-api-endpoint-reference.md`
