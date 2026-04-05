# Node Trust Application Use Cases

This note documents Story 5.1.4 (Feature 5 / Epic 5.1): initial node trust application-layer use cases and orchestration seams, Story 5.2.1 (Feature 5 / Epic 5.2): node-side bootstrap identity material generation for enrollment, Story 5.2.3 (Feature 5 / Epic 5.2): admin review/approval decisions for pending node enrollment, Story 5.2.4 (Feature 5 / Epic 5.2): enrollment detail retrieval transport orchestration support, Story 5.3.4 (Feature 5 / Epic 5.3): admin inventory list/detail query read models across trust and presence states, Story 5.4.1 (Feature 5 / Epic 5.4): durable node revocation semantics and repeat-revocation safety, and Story 5.4.2 (Feature 5 / Epic 5.4): node-authenticated trust enforcement for runtime operations.

## Canonical files

- `src/application/nodes/use-cases/NodeTrustUseCaseShared.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustCertificatePorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase.ts`
- `src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase.ts`
- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/use-cases/RejectNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/RevokeNodeTrustUseCase.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase.ts`
- `src/application/nodes/use-cases/NodeInventoryReadModels.ts`
- `src/application/nodes/use-cases/ListNodeInventoryUseCase.ts`
- `src/application/nodes/use-cases/GetNodeInventoryDetailUseCase.ts`
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`
- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts`

## Scope and intent

- Establish production-oriented application seams for the node trust lifecycle before transport/UI workflows are added.
- Keep orchestration in the application layer while reusing domain invariant validation and persistence contracts.
- Keep certificate issuance/revocation, permission enforcement, and audit delivery as explicit ports (hooks), not infrastructure dependencies.

## Use-case coverage in this slice

- `RegisterNodeEnrollmentRequestUseCase`
  - validates request through domain constructors
  - blocks duplicate pending enrollment per node
  - persists enrollment request with mutation envelope metadata
- `ReviewPendingNodeEnrollmentUseCase`
  - lists pending/under-review enrollment requests for administrative review
  - keeps review authorization as a dedicated seam
- `GetNodeEnrollmentDetailUseCase`
  - resolves one enrollment request by `requestId` for admin review surfaces
  - reuses review authorization seam (`assertCanReviewPendingEnrollment`) to enforce server-side access
- `ApproveNodeEnrollmentUseCase`
  - authorizes approval action
  - transitions enrollment request lifecycle (`submitted -> under-review -> approved` as needed)
  - persists decision metadata (`reviewedAt`, `reviewedByUserIdentityId`, `decisionNote`) on the enrollment request
  - emits approval audit events that include persisted decision metadata
  - issues/accepts certificate via hook seam
  - upserts node approval state and activation prerequisites (`trustState=pending-approval`) using persistence ports
  - normalizes and validates approved enrollment capability profiles before persistence
  - updates existing node records with approved enrollment capability profiles for stable capability registration
- `ActivateApprovedNodeUseCase`
  - authorizes activation action
  - requires node approval before trust activation and blocks revoked/unapproved nodes
  - enforces certificate-backed trust prerequisites before transition to `trustState=trusted`
  - preserves approved capability profile and certificate/trust metadata on activation
  - is idempotent for repeated activation attempts
  - emits activation audit events for trusted-state transitions
- `RejectNodeEnrollmentUseCase`
  - authorizes rejection action
  - transitions enrollment request lifecycle (`submitted -> under-review -> rejected` as needed)
  - persists decision metadata (`reviewedAt`, `reviewedByUserIdentityId`, `decisionNote`) on the enrollment request
  - emits rejection audit events that include persisted decision metadata
  - upserts node as rejected/quarantined for explicit lifecycle traceability
- `RevokeNodeTrustUseCase`
  - authorizes revocation action
  - requires revocation reason when revoking non-revoked nodes
  - validates revocation semantics through domain helpers
  - revokes node trust state and revocation envelope in persistence with durable metadata (`revokedAt`, `revokedByUserIdentityId`, optional `note`)
  - invokes optional certificate revocation hook before state mutation
  - safely handles repeated revocation requests for already-revoked nodes without mutating previously persisted revocation metadata
  - emits revocation audit events for both initial revocation and safe already-revoked retries (`alreadyRevoked` detail flag)
- `RecordNodeHeartbeatUseCase`
  - authorizes heartbeat writes
  - enforces centralized node-authenticated trust preconditions before heartbeat writes (approved + trusted + non-revoked + certificate-present)
  - validates heartbeat update against domain rules (for example revoked nodes cannot update heartbeat)
  - persists last-seen metadata
- `ListTrustedNodeInventoryUseCase`
  - authorizes trusted inventory queries
  - queries trusted-node-only inventory using persistence query presets and filters
  - supports capability-filtered trusted inventory queries using normalized capability profiles
- `ListNodeInventoryUseCase`
  - authorizes admin inventory queries for full trust lifecycle visibility (active, pending, rejected, revoked, offline)
  - merges node identity records and pending enrollment requests into one inventory read model
  - supports filters by approval status, capability, node type, deployment tag, and presence state
  - preserves admin-safe output by returning operational summaries without internal certificate/revision internals
- `GetNodeInventoryDetailUseCase`
  - authorizes admin inventory detail reads for one `nodeId`
  - resolves node operational detail from node identity records plus pending enrollment context when present
  - supports pending-only detail retrieval for nodes that only exist as enrollment requests
- `NodeBootstrapIdentityService`
  - generates durable local bootstrap identity for `compute` and `hybrid` nodes
  - persists one local bootstrap record and Ed25519 keypair in a secure node-local directory
  - recovers idempotently when bootstrap material already exists
  - keeps lifecycle state explicitly untrusted (`approvalStatus=pending`, `trustState=pending-enrollment`)
  - builds normalized enrollment submission payloads with bootstrap trust-material metadata

## Shared application contracts

`NodeTrustUseCaseShared.ts` provides:

- common error/outcome model for node trust use cases
- mutation envelope builder with actor/context metadata
- deterministic ID generator namespace seams
- shared normalization and domain-error mapping helpers
- `enforceNodeAuthenticatedOperationTrust(...)` for reusable node-authenticated trust gating across heartbeat and future node-scoped runtime operations

## Hook-port seams

- `NodeTrustAuthorizationHook`
  - explicit per-use-case permission hooks for register/review/approve/activate/reject/revoke/heartbeat/query operations
  - keeps policy engines and admin role checks out of use-case internals
  - supports explicit admin-only enforcement for review/approval/rejection actions
- `NodeTrustCertificateHook`
  - explicit certificate issuance and optional revocation hook
  - allows later PKI integration without changing use-case boundaries
  - approval flow can trigger certificate issuance while keeping certificate concerns outside enrollment-decision state transitions
- `NodeTrustAuditSink`
  - best-effort audit publication seam with typed event vocabulary
  - non-blocking by default for current slice
  - activation audit events are distinct from heartbeat presence events

## Boundary posture

- Application layer depends on:
  - domain contracts/transition helpers for invariant enforcement,
  - node persistence ports for read/write orchestration,
  - new hook ports for cross-cutting concerns.
- Application layer does not depend on:
  - transport/UI artifacts,
  - concrete authorization engines,
  - concrete certificate providers,
  - concrete audit transports.

## Test coverage in this slice

`src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts` validates:

- enrollment registration orchestration
- pending review listing (including denied review authorization path)
- enrollment detail retrieval (including denied review authorization path)
- approval flow including authorization gating, explicit lifecycle transition sequence, decision metadata persistence, certificate hook, and pending-activation trust-state staging
- approval flow includes capability profile normalization/validation and existing-node capability profile updates
- activation flow including approved-only guardrails, idempotent trusted-state transition, and activation audit publication
- rejection flow including authorization gating, explicit lifecycle transition sequence, decision metadata persistence, and quarantine state mutation
- revocation flow with certificate-revocation hook, authorization denial coverage, durable revocation metadata assertions, and safe repeat-revocation idempotency behavior
- heartbeat recording with centralized node-authenticated trust enforcement and rejection coverage for unknown, pending, rejected, and revoked nodes
- trusted inventory query filtering
- full inventory query filtering across node + pending-enrollment read models
- node inventory detail retrieval for pending-only and persisted node records

`src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts` validates:

- bootstrap identity/keypair creation and normalized record fields
- idempotent recovery when material is already present
- compute/hybrid support guardrails and unsupported node-type rejection
- enrollment payload compatibility with node-trust transport schema parsing
