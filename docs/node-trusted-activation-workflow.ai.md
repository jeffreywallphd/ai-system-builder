# AI Companion: Node Trusted Activation Workflow

## Scope

Story 5.3.1, Story 5.3.2, and Story 5.3.3 (Feature 5 / Epic 5.3): approved-node activation plus capability profile registration/validation and operational presence heartbeat ingestion.

## Canonical files

- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/domain/nodes/NodeTrustDomain.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`
- `infrastructure/api/nodes/NodeTrustBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServerNodeTrust.test.ts`

## Lifecycle semantics

- Approval and activation are distinct lifecycle steps.
- Approval transitions enrollment decisions and node approval metadata:
  - enrollment status becomes `approved`
  - node approval becomes `approved`
  - node trust state remains `pending-approval`
  - certificate metadata may be attached as activation prerequisite material
- Activation transitions only approved, non-revoked nodes from `pending-approval` to `trusted`.
- Heartbeat presence remains independent (`RecordNodeHeartbeatUseCase`) and does not perform trust activation.
- Heartbeat updates are accepted only for nodes that are already in `trustState=trusted`.

## Activation guardrails

- Unapproved nodes are rejected for activation (`invalid-state` outcome).
- Revoked nodes are rejected for activation.
- Activation requires certificate reference material to be present or supplied.
- Repeated activation calls are idempotent/safely guarded:
  - already trusted with equivalent trust metadata returns without additional mutation
  - conflicting certificate re-activation is rejected as conflict
- Capability profiles are validated and normalized before persistence.
- Existing nodes are updated to approved enrollment capability profiles during approval.

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
- Heartbeat emits `node-heartbeat-recorded`.

## Presence transport and storage

- Node heartbeat endpoint:
  - `POST /api/v1/nodes/:nodeId/heartbeat`
  - authenticated transport only
  - request actor is bound to authenticated principal
  - request `actorUserIdentityId` and `nodeId` fields are transport-bound from authenticated principal + route parameters (client values are ignored)
- Admin visibility endpoint:
  - `GET /api/v1/nodes/trusted`
  - supports query filters: `nodeType`, `capability`, `deploymentTag`, `lastSeenAfter`, `lastSeenBefore`, `limit`, `offset`
- Persisted presence fields:
  - `lastSeen.lastSeenAt`
  - `lastSeen.heartbeatStatus`
  - `lastSeen.observedBy` (optional)

## Heartbeat cadence guidance

- Default cadence: every 30 seconds.
- Alerting/offline guidance:
  - degraded signal at >90 seconds since last heartbeat,
  - offline signal at >180 seconds since last heartbeat.
- Future certificate-authenticated transport can reuse the same heartbeat payload and persistence fields while replacing bearer-session principal resolution.
