# Workspace Administration Operations

This runbook documents current workspace administration lifecycle, audit-hook behavior, and Story 11.3.1 encryption-policy administration behavior.

## Operational behavior in this slice

- Workspace administration mutations execute through application use cases.
- Successful writes emit best-effort audit events through `WorkspaceAdministrationAuditSink`.
- Audit dispatch failures are swallowed intentionally in this story to avoid blocking admin operations.
- Story 4.3.2 adds centralized workspace-capability policy checks (`system.manage`) ahead of workspace-sensitive admin mutations.
- Self-service invitation onboarding remains separate from admin-only mutation routes.
- Workspace create/update flows now accept explicit `encryptionPolicy` fields:
  - `encryptionMode`
  - `contentEncryptionRequired`
  - `keyScope`
  - `allowPreviewDecryption`
  - `allowWorkerDecryption`
- Workspace list/admin read DTOs now include `encryptionPolicy` for operator visibility and downstream policy consumers.
- Invalid encryption-policy combinations are rejected by workspace domain/application validation.

## Event matrix

- Workspace create: `workspace-created`
- Workspace metadata update: `workspace-updated`
- Workspace lifecycle transition (`archive`, `reactivate`, `suspend`, `activate`): `workspace-lifecycle-transitioned`
- Member add: `workspace-membership-added`
- Member status change or remove: `workspace-membership-status-changed`
- Role assign: `workspace-role-assigned`
- Role reassign: `workspace-role-reassigned`
- Role revoke: `workspace-role-revoked`
- Invitation issue: `workspace-invitation-issued`
- Invitation acceptance: `workspace-invitation-accepted`

## Hook payload shape

Each event includes:

- `type`
- `workspaceId`
- `actorUserIdentityId`
- `occurredAt`
- `details` (small event-specific metadata)

## Integration guidance

- Bind a concrete sink implementation in host composition (for example: structured logs, queue publisher, outbox writer).
- Keep sink implementations idempotent where possible.
- Route events to durable infrastructure in future audit stories without modifying use-case orchestration.

## Verification in tests

Core-flow hook invocation tests live in:

- `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
- `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceInvitationIssuanceUseCase.test.ts`
- `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts`
