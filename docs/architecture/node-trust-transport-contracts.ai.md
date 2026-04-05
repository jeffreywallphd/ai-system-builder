# AI Companion: Node Trust Transport and IPC Contracts

## Purpose

Quick baseline for Story 5.1.5 shared node trust transport DTOs and schema validation contracts (Feature 5 / Epic 5.1).

## Canonical files

- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/contracts/nodes/tests/NodeTrustApiContracts.test.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/NodeTrustApiSchemaContracts.test.ts`

## DTO coverage

- enrollment submission request/response
- pending enrollment summaries/list response
- approval/rejection/revocation action requests
- node heartbeat payload/response
- node detail and enrollment detail views
- node inventory summary/detail views
- capability profile transport serialization

## Public vs internal boundary

- Admin-visible DTOs:
  - `NodeDetailDto`
  - `NodeEnrollmentDetailDto`
  - `NodePendingEnrollmentSummaryDto`
- Internal DTOs:
  - `NodeInternalDetailDto`
  - `NodeInternalEnrollmentDetailDto`
- Safe projection helpers:
- `toNodeDetailDto(...)`
- `toNodeEnrollmentDetailDto(...)`
- `toNodePendingEnrollmentSummaryDto(...)`
- `toNodeInventorySummaryDto(...)`
- `toNodeInventoryDetailDto(...)`

## Validation posture

- All node-trust transport payloads are validated in `NodeTrustApiSchemaContracts.ts` using strict zod schemas.
- Typed validation failures surface through `NodeTrustApiSchemaValidationError`.
- Schema checks include:
  - trusted/revoked lifecycle coherence,
  - pending-summary status restrictions,
  - capability dedupe,
  - bootstrap envelope minimum-content checks,
  - bootstrap public trust-material metadata validation (reference + key fields),
  - rejection of internal-only fields in admin schemas.

## Adapter guidance

- Parse transport payloads at HTTP/IPC boundaries with `parse*` helpers before entering use cases.
- Return admin-safe DTOs by default; only use internal DTOs for explicit internal service boundaries.

## Story 5.2.2 additions

- New server adapter files:
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- New HTTP routes in `IdentityHttpServer.ts`:
  - `POST /api/v1/nodes/enrollments` (bootstrap enrollment submission)
  - `GET /api/v1/nodes/enrollments/pending` (admin pending-review query)
- Enrollment submissions now:
  - use `parseNodeEnrollmentSubmissionRequestDto(...)` at transport boundary,
  - persist as pending enrollment records (not active nodes),
  - return stable invalid/duplicate failures,
  - expose pending summaries via admin-facing query flow.

## Story 5.2.4 additions

- Expanded server adapter surface:
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- Expanded HTTP routes in `IdentityHttpServer.ts`:
  - `GET /api/v1/nodes/enrollments/:requestId` (enrollment detail review)
  - `POST /api/v1/nodes/enrollments/:requestId/approve` (approval action)
  - `POST /api/v1/nodes/enrollments/:requestId/reject` (rejection action)
- These admin routes now:
  - validate approval/rejection payloads through shared node-trust schema parse helpers,
  - bind actor identity to authenticated session principal in transport layer,
  - return admin-safe decision payloads that exclude internal certificate authority/trust metadata fields.

## Story 5.3.3 additions

- Expanded server adapter surface:
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- Expanded HTTP routes in `IdentityHttpServer.ts`:
  - `POST /api/v1/nodes/:nodeId/heartbeat` (trusted-node heartbeat ingestion)
  - `GET /api/v1/nodes/trusted` (admin trusted-node inventory/presence query)
- Heartbeat route behavior:
  - validates payload via `parseNodeHeartbeatPayloadDto(...)`,
  - binds `actorUserIdentityId` to authenticated session principal,
  - binds heartbeat `nodeId` from route parameters so client payload node-id spoofing is ignored,
  - relies on application use case enforcement that only trusted nodes can update `lastSeen`.

## Story 5.3.4 additions

- Expanded server adapter surface:
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- Expanded HTTP routes in `IdentityHttpServer.ts`:
  - `GET /api/v1/nodes/inventory`
  - `GET /api/v1/nodes/inventory/:nodeId`
- Inventory routes now:
  - return admin-safe lifecycle summaries across `active`, `pending`, `rejected`, `revoked`, and `offline` states,
  - support filters for approval status, operational state, enrollment status, presence state, node type, capability, deployment tags, and last-seen windows,
  - provide pending-enrollment detail context when a node has not yet materialized into a trusted node identity record.

## Story 5.4.2 additions

- `POST /api/v1/nodes/:nodeId/heartbeat` now enforces node-principal binding before request payload parsing:
  - authenticated principal/session identity must match route `nodeId` (username/providerSubject/userIdentityId match),
  - non-matching principals receive `forbidden`.
- Node-authenticated write flows continue to bind actor/node fields at transport boundary (payload spoofed actor/node values are ignored).
- Application layer now owns reusable trust-state enforcement through `enforceNodeAuthenticatedOperationTrust(...)`, keeping transport checks focused on authenticated identity binding and preserving compatibility with upcoming certificate-authenticated transport.

## Story 5.4.4 additions

- New admin revocation endpoint:
  - `POST /api/v1/nodes/:nodeId/revoke`
  - validates with `parseRevokeNodeTrustActionRequestDto(...)`
  - binds actor from authenticated session principal
  - binds `nodeId` from route path and ignores spoofed payload values
  - returns admin-safe `NodeRevocationResponseDto`
- Backend and contract surface expanded:
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
- Renderer wiring expanded:
  - `ui/shared/nodes/NodeInventoryClient.ts`
  - `ui/services/NodeInventoryService.ts`
  - `ui/pages/NodeInventoryPage.tsx`
- Admin inventory detail now provides production revoke flow with:
  - revocation reason + optional note,
  - explicit node-id confirmation safeguard,
  - post-action trust-state refresh from backend.
