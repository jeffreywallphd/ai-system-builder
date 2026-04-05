# Node Trusted Activation Workflow

This note documents Story 5.3.1 and Story 5.3.2 (Feature 5 / Epic 5.3): explicit activation of approved nodes into trusted operational state and capability profile registration/validation.

## Purpose

- Ensure approval materially changes lifecycle state without implicitly marking node presence.
- Keep trusted activation explicit, auditable, and idempotent.
- Preserve capability and trust metadata required for later certificate-backed transport and scheduling flows.
- Ensure node capabilities are normalized and validated as a stable profile before persistence and activation.

## Canonical implementation

- `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
- `src/application/nodes/use-cases/ActivateApprovedNodeUseCase.ts`
- `src/application/nodes/ports/NodeTrustAuthorizationPorts.ts`
- `src/application/nodes/ports/NodeTrustAuditPorts.ts`
- `src/domain/nodes/NodeTrustDomain.ts`
- `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`

## Lifecycle model

- Approval step:
  - enrollment request transitions to `approved`
  - node approval status transitions to `approved`
  - node trust state is staged as `pending-approval`
  - certificate metadata can be issued/attached as activation prerequisite material
- Activation step:
  - requires an approved and non-revoked node
  - requires certificate reference metadata
  - transitions node trust state to `trusted`
  - preserves approved capability profile and trust metadata
- Presence step:
  - heartbeat updates remain separate and do not activate trust

## Idempotency and safety

- Activation is idempotent when repeated with equivalent certificate/trust metadata.
- Re-activation attempts with conflicting certificate references are rejected.
- Unapproved nodes cannot be activated.
- Capability profiles are normalized and validated before registration/approval persistence.
- Existing nodes approved via enrollment are updated to the approved enrollment capability profile.

## Capability registration rules

- Canonical capabilities: `ui`, `api`, `scheduler`, `executor`, `storage-access`, `preview-worker`.
- Profiles are deduplicated and persisted in canonical order for stable admin/query behavior.
- Validation rules:
  - `ui` requires `api`.
  - `scheduler` requires both `api` and `executor`.
  - `preview-worker` requires `executor`.
  - `supportsRemoteScheduling=true` requires `executor`.
  - `maxConcurrentWorkloads` requires `executor`.
- Legacy persisted capability values from earlier stories are normalized to canonical values when loaded from persistence.

## Audit vocabulary

- `node-approved`
- `node-activated`
- `node-heartbeat-recorded`

## Test coverage

- lifecycle test coverage for approve -> activate trusted transition
- idempotent repeat activation behavior
- unapproved activation rejection behavior
- capability profile validation and invalid-combination rejection coverage in domain/schema tests
- approval flow coverage for updating existing-node capability profiles from approved enrollment metadata
