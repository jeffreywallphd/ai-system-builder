# AI Companion: Node Trust Operational Lifecycle

## Purpose

Story 5.4.5 operational baseline for the full node trust lifecycle with hardened edge-case behavior.

## Canonical files

- `src/infrastructure/security/nodes/NodeBootstrapIdentityService.ts`
- `src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase.ts`
- `src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase.ts`
- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/use-cases/RecordNodeHeartbeatUseCase.ts`
- `src/application/nodes/use-cases/ListNodeInventoryUseCase.ts`
- `src/application/nodes/use-cases/GetNodeInventoryDetailUseCase.ts`
- `src/application/nodes/use-cases/RevokeNodeTrustUseCase.ts`
- `ui/pages/NodeEnrollmentReviewPage.tsx`
- `ui/pages/NodeInventoryPage.tsx`

## Lifecycle sequence

1. Bootstrap: node identity and trust material created locally (`pending-enrollment`).
2. Enrollment: request submitted with capabilities and deployment tags.
3. Review: admin lists pending queue and inspects detail.
4. Approval: enrollment approved and node staged at `pending-approval`.
5. Activation: approved node with certificate transitions to `trusted`.
6. Heartbeat: only trusted, non-revoked, certificate-backed nodes can write presence.
7. Inventory: admin sees pending/active/offline/rejected/revoked states.
8. Revocation: node becomes `revoked` with durable reason metadata.

## Hardening in this story

- Duplicate pending enrollment per node is blocked.
- Stale pending enrollment is auto-expired on retry (`node-enrollment-expired`) to avoid queue deadlock.
- Duplicate enrollment `requestId` reuse is rejected.
- Approval is blocked when an existing node record is already revoked.
- Activation is blocked when any revocation markers exist, including revocation timestamps.
- Heartbeat is rejected for revoked/pending/rejected/unknown nodes.
- Rejecting stale enrollment for revoked node does not mutate node trust out of `revoked`.
- Enrollment review UI state labels align with lifecycle values (`withdrawn`, `expired`).

## Admin responsibilities

- Keep pending enrollment queue current.
- Validate capability profile and deployment tags before approval.
- Activate only after certificate prerequisites are present.
- Monitor heartbeat rejected events for trust violations.
- Revoke compromised or retired nodes with reason + note.
- Confirm expected operational state in inventory after every trust decision.

## Audit events

- `node-enrollment-requested`
- `node-enrollment-expired`
- `node-pending-enrollment-reviewed`
- `node-approved`
- `node-activated`
- `node-rejected`
- `node-heartbeat-recorded`
- `node-heartbeat-rejected`
- `node-revoked`
- `node-inventory-queried`
- `node-inventory-detail-queried`
