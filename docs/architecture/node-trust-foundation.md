# Node Trust Foundation

This note documents the node trust domain foundation introduced for Feature 5 / Epic 5.1. It defines framework-free contracts for node identity, enrollment, approval, capability-scoped participation, lifecycle observability, and revocation semantics.

## Scope

Implemented in this slice:

- node-trust domain contracts in `src/domain/nodes/NodeTrustDomain.ts`
- explicit lifecycle vocabularies for approval, trust, enrollment, and revocation
- node capability-profile modeling based on enabled capabilities
- last-seen heartbeat metadata contracts for future heartbeat/scheduling integration
- domain tests for invariants and transition guards

Out of scope in this slice:

- enrollment orchestration services/use-cases
- persistence schema/adapters for node trust
- certificate issuance infrastructure
- scheduler integration and runtime trust enforcement

## Domain model

Primary domain entities and value objects:

- `NodeIdentity`:
  - canonical node identity and lifecycle state (`nodeId`, `nodeType`, `displayName`)
  - capability-scoped participation via `capabilityProfile`
  - trust and approval metadata (`approvalStatus`, `trustState`, `certificateRef`)
  - deployment and observability metadata (`deploymentTags`, `lastSeen`)
  - revocation envelope (`revocation`, `revokedAt`)
- `NodeEnrollmentRequest`:
  - enrollment lifecycle representation for pending/reviewed/terminal enrollment decisions
  - carries capability and metadata proposed during enrollment
- `NodeCapabilityProfile`:
  - explicit enabled capabilities (`NodeRoleCapability[]`) with optional concurrency/scheduling metadata
  - avoids hard-coded single-role assumptions
- `LastSeenMetadata`:
  - heartbeat/observability metadata with normalized `lastSeenAt`
- `NodeRevocation`:
  - explicit revocation-state and reason metadata

## Lifecycle vocabularies

Explicit transition maps are first-class exports:

- `NodeApprovalLifecycleTransitions`
- `NodeTrustLifecycleTransitions`
- `NodeEnrollmentRequestLifecycleTransitions`

Transition helpers:

- `isNodeApprovalTransitionAllowed(...)`
- `isNodeTrustTransitionAllowed(...)`
- `isNodeEnrollmentRequestTransitionAllowed(...)`
- transition operations that enforce those rules:
  - `transitionNodeApprovalStatus(...)`
  - `transitionNodeTrustState(...)`
  - `transitionNodeEnrollmentRequestStatus(...)`

## Invariant posture

Key invariants enforced by domain constructors and transition operations:

- capability profiles must include at least one enabled capability
- trusted nodes must be approved and include `certificateRef`
- revoked nodes must include revocation metadata (`revokedAt`, reason) and `trustState=revoked`
- non-revoked nodes cannot carry revocation metadata
- `approvedAt` is required for approved nodes and invalid for rejected nodes
- lifecycle timestamps are normalized and ordered (`createdAt <= enrolledAt <= approvedAt`, and `lastSeenAt >= enrolledAt`)
- revoked nodes cannot receive last-seen heartbeat updates

## Extension seams

This domain model is designed to support later stories without changing vocabulary contracts:

- enrollment/approval application workflows can consume `NodeEnrollmentRequest` and lifecycle transition helpers
- certificate issuance can use `assignNodeCertificate(...)` and trust-transition guards
- heartbeat pipelines can use `recordNodeLastSeen(...)`
- scheduling and placement policy can reason over capability profile plus deployment tags
- trust revocation flows can use `revokeNodeIdentity(...)`

## Test coverage

Story coverage for this foundation is implemented in:

- `src/domain/nodes/tests/NodeTrustDomain.test.ts`

Tests validate:

- capability-enabled modeling and deduped deployment tags
- trust prerequisites (approval + certificate)
- lifecycle transition guards for approval/trust/enrollment
- last-seen metadata handling and revoked-node heartbeat blocking
- revocation invariant enforcement
