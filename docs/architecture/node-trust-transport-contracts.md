# Node Trust Transport and IPC Contracts

This note documents Story 5.1.5 (Feature 5 / Epic 5.1): shared transport contracts and schema validation boundaries for node enrollment and trust administration APIs/IPC.

## Canonical artifacts

- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/contracts/nodes/tests/NodeTrustApiContracts.test.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/NodeTrustApiSchemaContracts.test.ts`

## Scope and intent

- Define one shared request/response DTO vocabulary for server, desktop IPC, hybrid host, thin-client, and worker-facing node-trust boundaries.
- Keep transport validation centralized in one schema module so payload semantics do not diverge by adapter.
- Explicitly separate admin-visible payloads from internal-only payload fields to prevent accidental data leakage.
- Keep certificate/bootstrap integration future-ready using opaque bootstrap envelopes instead of certificate-provider internals.

## Transport contracts covered

- Enrollment submission:
  - `NodeEnrollmentSubmissionRequestDto`
  - `NodeEnrollmentSubmissionResponseDto`
- Pending enrollments:
  - `NodePendingEnrollmentSummaryDto`
  - `PendingEnrollmentListResponseDto`
- Approval/rejection/revocation actions:
  - `ApproveNodeEnrollmentActionRequestDto`
  - `RejectNodeEnrollmentActionRequestDto`
  - `RevokeNodeTrustActionRequestDto`
  - `NodeEnrollmentDecisionResponseDto`
  - `NodeRevocationResponseDto`
- Heartbeats:
  - `NodeHeartbeatPayloadDto`
  - `NodeHeartbeatResponseDto`
- Inventory views:
  - `NodeInventorySummaryDto`
  - `NodeInventoryDetailDto`
  - `NodeInventoryListResponseDto`
  - `NodeInventoryDetailResponseDto`
- Node detail and enrollment detail views:
  - admin-visible DTOs (`NodeDetailDto`, `NodeEnrollmentDetailDto`)
  - internal DTOs (`NodeInternalDetailDto`, `NodeInternalEnrollmentDetailDto`)
- Capability profile serialization:
  - `NodeCapabilityProfileDto`

## Public/internal boundary posture

`NodeTrustApiContracts.ts` formalizes two transport scopes:

- `admin`: default DTO shape for UI/admin APIs.
- `internal`: richer internal shape that may include operator-only or infrastructure-only fields.

Projection helpers enforce safe defaults:

- `toNodeDetailDto(...)`
- `toNodeEnrollmentDetailDto(...)`
- `toNodePendingEnrollmentSummaryDto(...)`
- `toNodeInventorySummaryDto(...)`
- `toNodeInventoryDetailDto(...)`

These helpers intentionally remove internal-only fields (for example certificate authority references, certificate thumbprints, revision metadata, and revocation actor identity) unless explicitly using internal DTO types.

## Schema validation contracts

`NodeTrustApiSchemaContracts.ts` adds zod-backed schemas and parse helpers for all public action payloads and view DTOs:

- enrollment submission and pending enrollment summaries
- approval/rejection/revocation action requests
- heartbeat payloads
- capability profile serialization
- admin-visible and internal detail payloads
- admin inventory summary/detail payloads

Validation behavior includes:

- strict object schemas at transport boundaries
- trusted/revoked lifecycle coherence checks for node detail payloads
- pending-summary status restrictions (`submitted`, `under-review` only)
- bootstrap envelope minimum-content checks
- bootstrap public trust-material metadata support (`trustMaterialRef`, public key algorithm/fingerprint/PEM)
- typed schema validation failures via `NodeTrustApiSchemaValidationError`

## Boundary guidance for adapters

- HTTP/IPC handlers should parse inbound payloads with the `parse*` helpers before invoking application use cases.
- Admin/UI response handlers should return admin DTOs by default (`NodeDetailDto`, `NodeEnrollmentDetailDto`), derived from internal records via projection helpers.
- Internal-only fields should remain confined to operator service boundaries unless explicitly required.

## Test coverage

- `NodeTrustApiContracts.test.ts` validates admin/internal transport separation and projection behavior.
- `NodeTrustApiSchemaContracts.test.ts` validates request/response schemas, invariants, strictness against internal field leakage, and typed validation errors.

## Story 5.2.2 server enrollment lifecycle

Story 5.2.2 adds the first server-side enrollment transport flow on top of these shared contracts:

- Backend API adapter:
  - `infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- HTTP transport integration:
  - `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `POST /api/v1/nodes/enrollments`
  - `GET /api/v1/nodes/enrollments/pending`

Lifecycle behavior for this slice:

- Enrollment submissions are parsed with `parseNodeEnrollmentSubmissionRequestDto(...)` and rejected with stable `invalid-request` responses when malformed.
- Valid submissions call `RegisterNodeEnrollmentRequestUseCase` and persist as pending (`submitted`) enrollment requests; they do not activate node trust or execution privileges.
- Duplicate pending requests for the same `nodeId` return stable `conflict` responses.
- Pending-review queries call `ReviewPendingNodeEnrollmentUseCase` and project records into `NodePendingEnrollmentSummaryDto` for admin-facing review flows.
- Bootstrap public trust material is captured via submission payload metadata and `trustMaterialRef` promotion to `certificateRef` when no explicit certificate reference is provided.

## Story 5.2.4 enrollment review and approval transport APIs

Story 5.2.4 extends the node-trust admin transport surface so trusted admin UIs can complete the initial review workflow end to end.

Canonical artifacts:

- `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/nodes/tests/NodeTrustBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

Added API operations:

- `GET /api/v1/nodes/enrollments/:requestId`
  - returns `GetNodeEnrollmentDetailApiResponse` with one admin-safe `NodeEnrollmentDetailDto`
- `POST /api/v1/nodes/enrollments/:requestId/approve`
  - validates approval payload with shared node-trust schema contracts
  - executes `ApproveNodeEnrollmentUseCase`
  - returns `NodeEnrollmentDecisionResponseDto` with admin-safe node projection
- `POST /api/v1/nodes/enrollments/:requestId/reject`
  - validates rejection payload with shared node-trust schema contracts
  - executes `RejectNodeEnrollmentUseCase`
  - returns `NodeEnrollmentDecisionResponseDto`

Server-side enforcement posture:

- all review/detail/decision routes require an authenticated session
- actor identity is bound to `context.principal.userIdentityId` in HTTP handlers rather than client-supplied actor values
- use-case authorization hooks remain the policy seam for admin permissions

Sensitive data posture:

- responses are shaped via `toNodeEnrollmentDetailDto(...)` and `toNodeDetailDto(...)`
- certificate authority internals, certificate thumbprints, mutation metadata, and other internal trust material remain excluded from admin transport responses

## Story 5.3.3 heartbeat ingestion and operational presence transport

Story 5.3.3 extends node-trust transport so trusted nodes can publish liveness and admins can query current trusted presence.

Canonical artifacts:

- `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

Added API operations:

- `POST /api/v1/nodes/:nodeId/heartbeat`
  - validates heartbeat payload with `parseNodeHeartbeatPayloadDto(...)`
  - binds `actorUserIdentityId` to authenticated session principal
  - binds `nodeId` from route parameters so client payload spoof values are ignored
  - records `lastSeenAt`, `heartbeatStatus`, and optional `observedBy`
- `GET /api/v1/nodes/trusted`
  - returns admin-safe trusted node inventory (`NodeDetailDto[]`)
  - supports filters: `nodeType`, `capability`, `deploymentTag`, `lastSeenAfter`, `lastSeenBefore`, `limit`, `offset`

Server-side enforcement posture:

- heartbeat route requires authenticated transport
- unknown nodes return `not-found`
- non-trusted nodes (including revoked nodes) are rejected by application trusted-state checks before persistence mutation

## Story 5.3.4 trusted inventory list/detail transport

Story 5.3.4 extends node-trust transport with full lifecycle inventory queries and per-node admin detail read models.

Canonical artifacts:

- `infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/nodes/tests/NodeTrustBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

Added API operations:

- `GET /api/v1/nodes/inventory`
  - returns admin-safe inventory summaries across trusted + pending + rejected + revoked + offline operational states
  - supports filters: `approvalStatus`, `operationalState`, `enrollmentStatus`, `presenceState`, `nodeType`, `capability`, `deploymentTag`, `lastSeenAfter`, `lastSeenBefore`, `limit`, `offset`
- `GET /api/v1/nodes/inventory/:nodeId`
  - returns one admin-safe inventory detail
  - includes pending enrollment context when available

Sensitive data posture:

- inventory DTOs intentionally expose operational trust state, capability profile, and presence metadata needed by admin UIs
- internal trust fields (for example revocation actor identity, certificate authority refs, certificate thumbprints, and persistence revision internals) remain excluded
