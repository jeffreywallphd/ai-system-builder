# Node Trust Operational Lifecycle

This operational guide consolidates Story 5.4.5 (Feature 5 / Epic 5.4): bootstrap-to-revocation node trust lifecycle, hardened edge-case handling, and required administrator actions.

## Scope

- bootstrap identity creation
- enrollment submission and pending review
- approval and trusted activation
- heartbeat trust enforcement
- inventory visibility and revocation governance

## Canonical implementation

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
- `src/ui/pages/NodeEnrollmentReviewPage.tsx`
- `src/ui/pages/NodeInventoryPage.tsx`
- `src/ui/shared/nodes/NodeTrustAdministrationPanels.tsx`

## End-to-end lifecycle

1. Bootstrap identity creation
- Node generates durable local identity and public trust material.
- Initial lifecycle is untrusted: `approvalStatus=pending`, `trustState=pending-enrollment`.

2. Enrollment request submission
- Node submits identity/capability/deployment metadata.
- Duplicate pending enrollment for the same node is blocked.
- New hardening: stale pending requests are auto-transitioned to `expired` on retry so queues do not block forever.
- New hardening: duplicate `requestId` reuse is rejected.

3. Admin enrollment review
- Admin lists pending requests (`submitted`, `under-review`).
- Admin retrieves request detail and records decision note when needed.

4. Approval
- Enrollment transitions to `approved`.
- Node approval is set to `approved`, trust is staged at `pending-approval` until activation.
- Capability profile is revalidated and normalized.
- New hardening: approval is blocked if an existing node record is already revoked.

5. Activation
- Requires approved node and certificate reference.
- Transitions node trust to `trusted`.
- New hardening: activation is blocked when any revocation markers exist, including inconsistent revocation timestamps.

6. Heartbeat and trust enforcement
- Heartbeat writes require approved + trusted + non-revoked + certificate-present node state.
- Revoked/pending/rejected/unknown nodes are rejected and audited.

7. Inventory and observability
- Admin inventory includes pending, active, offline, rejected, and revoked states.
- Pending-only nodes remain visible through enrollment-backed inventory entries.
- UI trust-label mapping now matches lifecycle terms (`withdrawn`, `expired`).
- Desktop and thin-client/admin-lite surfaces now share node list/detail/status/action panels while preserving surface-specific density (desktop table/menu vs thin card/list).

8. Revocation
- Revocation is explicit, reasoned, and durable.
- Revoked nodes remain visible in inventory for governance and forensics.
- Repeat revocation is safe and idempotent.
- New hardening: reject decisions on stale enrollment for revoked nodes do not mutate node trust back out of `revoked`.

## Managed trust material provisioning

- Approved and activated nodes retrieve managed runtime trust material through:
  - `GET /api/v1/nodes/{nodeId}/runtime-trust-material`
  - authenticated session bound to the same `nodeId` principal.
- Retrieval is fail-closed unless node trust lifecycle state is eligible (`approved`, `trusted`, non-revoked, and certificate-present).
- Returned runtime package material includes only node-safe payloads:
  - leaf certificate PEM,
  - certificate chain PEM (optional),
  - trust bundle PEM (optional).
- Protected storage references are intentionally excluded from node-facing runtime retrieval responses.
- Unapproved, revoked, missing, or principal-mismatched requests are rejected.

## Administrator responsibilities

- Review pending enrollment queue regularly and resolve old entries.
- Confirm capability profile and deployment tags before approval.
- Activate only after certificate prerequisites are satisfied.
- Monitor heartbeat rejection events for unauthorized or stale node behavior.
- Revoke compromised or decommissioned nodes promptly with reason and note.
- Verify inventory state after approval, activation, and revocation actions.

## Audit and governance hooks

Primary lifecycle events:

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

Sensitive trust-material fields are sanitized before sink delivery.
