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
  - `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
  - `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- HTTP transport integration:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
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

- `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/nodes/tests/NodeTrustBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

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

- `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

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

- `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/nodes/tests/NodeTrustBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

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

## Story 5.4.2 node-authenticated trust enforcement transport hooks

Story 5.4.2 tightens node-authenticated operation enforcement on transport + application boundaries.

Canonical artifacts:

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/application/nodes/use-cases/NodeTrustUseCaseShared.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

Heartbeat transport enforcement:

- `POST /api/v1/nodes/:nodeId/heartbeat` still requires authenticated transport and strict schema payload validation.
- The route now rejects authenticated sessions that are not bound to route `nodeId` (principal/session identifiers must match the node identity).
- Actor identity for node-authenticated heartbeat is transport-bound from authenticated node context, so client-supplied actor/node fields remain ignored.

Application enforcement guidance:

- Node-authenticated operations must call `enforceNodeAuthenticatedOperationTrust(...)` to avoid scattered state checks.
- This centralized gate enforces approved + activated (`trustState=trusted`) + non-revoked + certificate-present preconditions before node-scoped writes.
- Future node-authenticated handlers (for example execution registration flows) should reuse this same helper to preserve consistent denial semantics and certificate-transport compatibility.

## Story 7.3.1 node-to-server mutually authenticated transport adapter hooks

- Node transport APIs now expose a certificate-authenticated resolution seam through:
  - `ResolveNodeMutualTlsTransportIdentityApiRequest`
  - `ResolveNodeMutualTlsTransportIdentityApiResponse`
  - `NodeTrustBackendApi.resolveNodeMutualTlsTransportIdentity(...)`
- Runtime transport posture for node channels:
  - `GET /api/v1/nodes/:nodeId/runtime-trust-material`
  - `POST /api/v1/nodes/:nodeId/heartbeat`
  now uses dedicated node mTLS transport validation when host transport trust enforcement is configured.
- Node certificate identity binding is validated against trusted node records through application use-case boundaries rather than direct transport persistence access.

## Story 7.3.2 secure node heartbeat and capability exchange channel contracts

Story 7.3.2 extends node runtime transport contracts so recurring operational exchanges can carry heartbeat, capability profile synchronization, and deployment-tag synchronization over the same authenticated node channel.

Canonical artifacts:

- `src/shared/contracts/nodes/NodeTrustApiContracts.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/application/nodes/use-cases/RecordNodeOperationalUpdateUseCase.ts`

Added API operation:

- `POST /api/v1/nodes/:nodeId/operational-update`
  - request contract: `NodeOperationalUpdatePayloadDto`
  - response contract: `NodeOperationalUpdateResponseDto`
  - route is protected by `requireAuthenticatedNodeTransport(...)` (mTLS validation when transport trust is enforced)
  - actor/node identity values are transport-bound from authenticated node context; payload-claimed identities are overridden
  - optional capability profile + deployment tag fields allow trust-aware operational metadata sync without adding insecure side channels

Operational metadata posture:

- response `update` metadata includes:
  - `transportAuthenticatedNodeId`
  - `capabilityProfileSynchronized`
  - `deploymentTagsSynchronized`
- this metadata is intended for orchestration/scheduling services that need deterministic node capability and placement evidence from authenticated channels.

## Story 7.3.3 node-to-node policy seam (no broad mesh transport)

Story 7.3.3 does not add a new public HTTP node-peer API surface. Instead it adds an explicit application/infrastructure seam that future node-peer channels must use:

- `src/application/security/ports/NodePeerCommunicationPolicyPorts.ts`
  - operation-class and capability-aware policy contract for node-peer transport.
- `src/application/security/use-cases/AuthorizeNodePeerCommunicationUseCase.ts`
  - policy-gated authorization path that composes shared transport trust validation and peer certificate identity checks.
- `src/infrastructure/transport/StaticNodePeerCommunicationPolicyResolver.ts`
  - default-deny policy resolver with explicit local/remote pair allow rules.
- `src/infrastructure/transport/NodePeerCertificateIdentityResolver.ts`
  - certificate serial/fingerprint binding + node approval/trust/revocation posture resolution.
- `src/infrastructure/transport/NodePeerTransportValidationAdapter.ts`
  - protocol-safe allow/deny mapping for node-peer transport boundaries.

Constraints for this seam:

- peer channels are disabled unless a policy rule explicitly enables an operation class;
- peer trust is certificate identity + trust lifecycle based, never raw network/LAN location based;
- capability exposure is explicit per approved operation class.

## Story 7.3.4 transport lifecycle resilience and trust-invalidated channel handling

- `NodeMutualTlsTransportAdapter` now emits lifecycle metadata alongside node-channel validation outcomes:
  - certificate rotation awareness against prior serial/fingerprint bindings;
  - reconnect directives that are explicit and policy-aware (deny on revoked/policy failures, bounded backoff guidance for transient failures).
- `IdentityHttpServer` websocket channel handling now supports active-channel lifecycle monitoring:
  - periodic trust/session revalidation while channel is active;
  - revocation/trust-invalidation-triggered channel invalidation and shutdown;
  - lifecycle event hooks for channel state transitions and reconnect guidance.
- `SecureWebSocketChannelContext` now provides shared lifecycle/reconnect helpers so transport adapters avoid ad hoc reconnect behavior.

## Story 5.4.4 admin revocation and trust-state management transport/UI hooks

Story 5.4.4 adds concrete admin-facing revocation transport and renderer wiring on top of node inventory/detail.

Canonical artifacts:

- `src/infrastructure/api/nodes/sdk/PublicNodeTrustApiContract.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`
- `src/infrastructure/api/nodes/tests/NodeTrustBackendApi.test.ts`
- `ui/shared/nodes/NodeInventoryClient.ts`
- `ui/services/NodeInventoryService.ts`
- `ui/pages/NodeInventoryPage.tsx`
- `ui/shared/nodes/tests/NodeInventoryClient.test.ts`

Added API operation:

- `POST /api/v1/nodes/:nodeId/revoke`
  - validates payload via `parseRevokeNodeTrustActionRequestDto(...)`
  - binds actor identity from authenticated admin session principal
  - binds `nodeId` from route path (client body spoof values are ignored)
  - executes `RevokeNodeTrustUseCase` via backend API
  - returns admin-safe `NodeRevocationResponseDto`

Renderer behavior for this slice:

- Node detail includes production revoke controls (reason, optional note, explicit node-id confirmation).
- Success path refreshes real inventory/detail state from backend.
- Revoked nodes are explicitly marked and remain visible as non-active trust participants.
