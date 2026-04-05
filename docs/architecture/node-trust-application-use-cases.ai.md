# AI Companion: Node Trust Application Use Cases

## Purpose

Quick baseline for Story 5.1.4 node trust application orchestration seams (Feature 5 / Epic 5.1).

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

## Lifecycle orchestration coverage

- register enrollment request
- review/list pending enrollment queue
- approve node (including certificate hook seam)
- reject node
- revoke node trust (including certificate-revocation seam)
- record node heartbeat
- query trusted node inventory

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
