# Node Trust Application Use Cases

This note documents Story 5.1.4 (Feature 5 / Epic 5.1): initial node trust application-layer use cases and orchestration seams, plus Story 5.2.1 (Feature 5 / Epic 5.2): node-side bootstrap identity material generation for enrollment.

## Canonical files

- `src/application/nodes/use-cases/NodeTrustUseCaseShared.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustCertificatePorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase.ts`
- `src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/RejectNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/RevokeNodeTrustUseCase.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase.ts`
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
- `ApproveNodeEnrollmentUseCase`
  - authorizes approval action
  - transitions enrollment request lifecycle (`submitted -> under-review -> approved` as needed)
  - issues/accepts certificate via hook seam
  - upserts node approval/trust state using persistence ports
- `RejectNodeEnrollmentUseCase`
  - authorizes rejection action
  - transitions enrollment request lifecycle (`submitted -> under-review -> rejected` as needed)
  - upserts node as rejected/quarantined for explicit lifecycle traceability
- `RevokeNodeTrustUseCase`
  - authorizes revocation action
  - validates revocation semantics through domain helpers
  - revokes node trust state and revocation envelope in persistence
  - invokes optional certificate revocation hook before state mutation
- `RecordNodeHeartbeatUseCase`
  - authorizes heartbeat writes
  - validates heartbeat update against domain rules (for example revoked nodes cannot update heartbeat)
  - persists last-seen metadata
- `ListTrustedNodeInventoryUseCase`
  - authorizes trusted inventory queries
  - queries trusted-node-only inventory using persistence query presets and filters
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

## Hook-port seams

- `NodeTrustAuthorizationHook`
  - explicit per-use-case permission hooks for register/review/approve/reject/revoke/heartbeat/query operations
  - keeps policy engines and admin role checks out of use-case internals
- `NodeTrustCertificateHook`
  - explicit certificate issuance and optional revocation hook
  - allows later PKI integration without changing use-case boundaries
- `NodeTrustAuditSink`
  - best-effort audit publication seam with typed event vocabulary
  - non-blocking by default for current slice

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
- pending review listing
- approval flow including certificate hook and trust-state mutation
- rejection flow and quarantine state mutation
- revocation flow with certificate-revocation hook
- heartbeat recording and revoked-node rejection behavior
- trusted inventory query filtering

`src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts` validates:

- bootstrap identity/keypair creation and normalized record fields
- idempotent recovery when material is already present
- compute/hybrid support guardrails and unsupported node-type rejection
- enrollment payload compatibility with node-trust transport schema parsing
