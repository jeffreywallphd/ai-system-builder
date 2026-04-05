# AI Companion: Node Trust Application Use Cases

## Purpose

Quick baseline for Story 5.1.4 node trust application orchestration seams, Story 5.2.1 node bootstrap identity generation, Story 5.2.3 admin review/approval decisions, and Story 5.2.4 enrollment detail retrieval support (Feature 5 / Epic 5.1 and Epic 5.2).

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
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`
- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/infrastructure/security/nodes/tests/NodeBootstrapIdentityService.test.ts`

## Lifecycle orchestration coverage

- register enrollment request
- review/list pending enrollment queue
- fetch a single enrollment detail for admin review workflows
- approve node (admin-authorized, explicit lifecycle transitions, decision metadata, certificate hook seam)
- approve node includes capability profile normalization/validation and existing-node capability-profile registration
- activate approved node (idempotent trusted-state transition with capability and certificate/trust metadata continuity)
- reject node (admin-authorized, explicit lifecycle transitions, decision metadata)
- revoke node trust (including certificate-revocation seam)
- record node heartbeat
- query trusted node inventory
- query trusted node inventory with normalized capability filtering
- generate/recover node-local bootstrap identity + trust material
- build enrollment submission payloads from persisted bootstrap material

## Boundary notes

- Use cases are application-layer only and depend on:
  - node persistence ports,
  - domain transitions/invariant helpers,
  - hook ports for authorization/certificates/audit.
- Use cases do not depend on concrete transport/UI/infrastructure adapters.
- Audit publication is intentionally best-effort in this slice.

## Extension posture

- Authorization policy engines can plug in through `NodeTrustAuthorizationHook` without changing use-case signatures.
- PKI/certificate services can plug in through `NodeTrustCertificateHook` without changing node approval/revocation orchestration.
- Audit pipelines can plug in through `NodeTrustAuditSink` while preserving non-blocking application flow.
- Enrollment approval/rejection metadata (`reviewedAt`, `reviewedByUserIdentityId`, `decisionNote`) remains in persistence contracts so admin decisions are auditable and durable.
- Approval/rejection audit events include the persisted decision metadata for downstream audit consumers.
- Activation is explicitly separate from heartbeat presence writes so approval/activation lifecycle transitions and liveness updates remain independently auditable.
