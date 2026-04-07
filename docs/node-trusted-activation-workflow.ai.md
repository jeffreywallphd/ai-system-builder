# AI Companion: Node Trusted Activation Workflow

## Scope

Story 5.3.1, Story 5.3.2, Story 5.3.3, Story 5.3.4, Story 5.3.5, Story 5.4.1, Story 5.4.2, Story 5.4.3, and Story 5.4.5 (Feature 5 / Epic 5.3 and 5.4): approved-node activation plus capability profile registration/validation, operational presence heartbeat ingestion, admin inventory list/detail query views, renderer-side admin inventory inspection UI, durable revocation semantics, node-authenticated trust enforcement, and lifecycle hardening for stale/duplicate enrollment and revoked-node edge cases.

## Canonical files

- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase.ts`
- `src/application/nodes/use-cases/NodeInventoryReadModels.ts`
- `src/application/nodes/use-cases/ListNodeInventoryUseCase.ts`
- `src/application/nodes/use-cases/GetNodeInventoryDetailUseCase.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/domain/nodes/NodeTrustDomain.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`
- `src/infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`
- `ui/shared/nodes/NodeInventoryClient.ts`
- `ui/services/NodeInventoryService.ts`
- `ui/pages/NodeInventoryPage.tsx`
- `ui/pages/tests/NodeInventoryPage.test.tsx`
- `ui/shared/nodes/tests/NodeInventoryClient.test.ts`
- `ui/pages/NodeEnrollmentReviewPage.tsx`

## Lifecycle semantics

- Approval and activation are distinct lifecycle steps.
- Approval transitions enrollment decisions and node approval metadata:
  - enrollment status becomes `approved`
  - node approval becomes `approved`
  - node trust state remains `pending-approval`
  - certificate metadata may be attached as activation prerequisite material
- Activation transitions only approved, non-revoked nodes from `pending-approval` to `trusted`.
- Heartbeat presence remains independent (`RecordNodeHeartbeatUseCase`) and does not perform trust activation.
- Heartbeat updates are accepted only for nodes that pass centralized node-authenticated trust gates (approved + trusted + non-revoked + certificate-present).

## Activation guardrails

- Unapproved nodes are rejected for activation (`invalid-state` outcome).
- Revoked nodes are rejected for activation.
- Nodes with revocation timestamps are also treated as revoked for activation and trust-gated operations.
- Activation requires certificate reference material to be present or supplied.
- Repeated activation calls are idempotent/safely guarded:
  - already trusted with equivalent trust metadata returns without additional mutation
  - conflicting certificate re-activation is rejected as conflict
- Capability profiles are validated and normalized before persistence.
- Existing nodes are updated to approved enrollment capability profiles during approval.
- Revocation is admin-authorized and durable:
  - revocation metadata (`revokedAt`, `revokedByUserIdentityId`, optional `note`) is preserved in node identity persistence
  - revoked nodes remain visible to admin inventory as `operationalState=revoked`
  - repeated revocation requests for already-revoked nodes are safe no-op operations that preserve original metadata
- Enrollment registration expires stale pending requests on retry and then accepts a new request.
- Enrollment registration rejects duplicate `requestId` reuse.
- Approval against already-revoked existing nodes is blocked.
- Reject decisions against revoked existing nodes keep node trust state immutable (`revoked`).

## Capability profile rules

- Canonical capability set:
  - `ui`
  - `api`
  - `scheduler`
  - `executor`
  - `storage-access`
  - `preview-worker`
- Validation:
  - `ui` requires `api`
  - `scheduler` requires `api` + `executor`
  - `preview-worker` requires `executor`
  - `supportsRemoteScheduling=true` requires `executor`
  - `maxConcurrentWorkloads` requires `executor`

## Observability

- Approval emits `node-approved`.
- Activation emits `node-activated`.
- Revocation emits `node-revoked`.
- Heartbeat emits `node-heartbeat-recorded`.
- Rejected heartbeat security/trust-gate writes emit `node-heartbeat-rejected`.

## Audited trust actions

- enrollment request registration (`node-enrollment-requested`)
- stale enrollment expiration (`node-enrollment-expired`)
- pending enrollment review (`node-pending-enrollment-reviewed`)
- enrollment approval (`node-approved`)
- enrollment rejection (`node-rejected`)
- trusted activation (`node-activated`)
- node trust revocation, including safe repeat revocation (`node-revoked`)
- heartbeat write success (`node-heartbeat-recorded`)
- heartbeat write rejected for trust/security reasons (`node-heartbeat-rejected`)
- sensitive trust-material detail keys are redacted before sink delivery (`[REDACTED]`)

## Presence transport and storage

- Node heartbeat endpoint:
  - `POST /api/v1/nodes/:nodeId/heartbeat`
  - authenticated transport only
  - authenticated principal/session identity must be bound to route `nodeId`
  - request `actorUserIdentityId` and `nodeId` fields are transport-bound from authenticated node identity + route parameters (client values are ignored)
- Admin visibility endpoint:
  - `GET /api/v1/nodes/trusted`
  - supports query filters: `nodeType`, `capability`, `deploymentTag`, `lastSeenAfter`, `lastSeenBefore`, `limit`, `offset`
- Admin inventory endpoints:
  - `GET /api/v1/nodes/inventory`
  - `GET /api/v1/nodes/inventory/:nodeId`
  - supports filters: `approvalStatus`, `operationalState`, `enrollmentStatus`, `presenceState`, `nodeType`, `capability`, `deploymentTag`, `lastSeenAfter`, `lastSeenBefore`, `limit`, `offset`
  - operational categories: `active`, `pending`, `rejected`, `revoked`, `offline`
- Persisted presence fields:
  - `lastSeen.lastSeenAt`
  - `lastSeen.heartbeatStatus`
  - `lastSeen.observedBy` (optional)

## Admin UI inventory inspection

- Route surface:
  - renderer route: `/settings/node-inventory`
  - discoverable via Settings quick action: `Trusted node inventory`
- Renderer contracts:
  - list inventory via `GET /api/v1/nodes/inventory`
  - inspect detail via `GET /api/v1/nodes/inventory/:nodeId`
- Supported UI filters align to backend query contract:
  - `operationalState`, `presenceState`, `approvalStatus`, `enrollmentStatus`
  - `nodeType`, `capability`, `deploymentTag`
  - `lastSeenAfter`, `lastSeenBefore`
- Renderer behavior:
  - explicit loading/empty/error states for list and detail panes,
  - no placeholder node data,
  - state labels and badge treatment keep `pending`, `active`, `offline`, and `revoked` distinct for operators.

## Admin node revocation procedure

1. Open `/settings/node-inventory` with an authenticated admin session.
2. Select the target node and review trust + revocation metadata in the detail panel.
3. In **Trust actions**, select revocation reason, add optional administrative note, and type exact `nodeId` confirmation.
4. Submit **Revoke node trust**; the UI invokes `POST /api/v1/nodes/:nodeId/revoke`.
5. Verify result:
   - `trustState=revoked`
   - revocation state/reason/revoked timestamp populated
   - node remains visible in inventory as `operationalState=revoked`

Guardrails:

- actor identity is bound from authenticated session (client spoof values ignored),
- route `nodeId` is transport-bound from URL path,
- request validation uses shared node-trust schema contracts,
- repeated revoke requests are safe no-op and preserve original revocation metadata.

## Heartbeat cadence guidance

- Default cadence: every 30 seconds.
- Alerting/offline guidance:
  - degraded signal at >90 seconds since last heartbeat,
  - offline signal at >180 seconds since last heartbeat.
- Future certificate-authenticated transport can reuse the same heartbeat payload and persistence fields while replacing bearer-session principal resolution.
