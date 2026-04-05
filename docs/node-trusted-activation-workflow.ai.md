# AI Companion: Node Trusted Activation Workflow

## Scope

Story 5.3.1 (Feature 5 / Epic 5.3): explicit approved-node activation into trusted operational state.

## Canonical files

- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`

## Lifecycle semantics

- Approval and activation are distinct lifecycle steps.
- Approval transitions enrollment decisions and node approval metadata:
  - enrollment status becomes `approved`
  - node approval becomes `approved`
  - node trust state remains `pending-approval`
  - certificate metadata may be attached as activation prerequisite material
- Activation transitions only approved, non-revoked nodes from `pending-approval` to `trusted`.
- Heartbeat presence remains independent (`RecordNodeHeartbeatUseCase`) and does not perform trust activation.

## Activation guardrails

- Unapproved nodes are rejected for activation (`invalid-state` outcome).
- Revoked nodes are rejected for activation.
- Activation requires certificate reference material to be present or supplied.
- Repeated activation calls are idempotent/safely guarded:
  - already trusted with equivalent trust metadata returns without additional mutation
  - conflicting certificate re-activation is rejected as conflict

## Observability

- Approval emits `node-approved`.
- Activation emits `node-activated`.
- Heartbeat emits `node-heartbeat-recorded`.
