# AI Companion: Workspace Administration Operations

## Scope

- Operational behavior and extension guidance for Story 3.4.5 workspace administration audit hooks.

## Current behavior

- Workspace administration mutations write via application use cases.
- On successful writes, use cases emit best-effort audit events through `WorkspaceAdministrationAuditSink`.
- Audit dispatch failure is intentionally non-blocking in this slice.

## Event coverage

- workspace create/update/lifecycle transition
- membership add/status/remove
- role assign/reassign/revoke
- invitation issue/accept

## Event contract

Common fields:

- `type`
- `workspaceId`
- `actorUserIdentityId`
- `occurredAt`
- optional `details`

## Implementation guidance

- Wire concrete sink adapters in host composition.
- Keep event handling idempotent/durable at adapter level (outbox/log stream/queue), not inside domain/application mutation logic.
- Extend this pattern to future workspace-scoped protected resources.

## Verification

- Hook invocation tests:
  - `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
  - `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts`
  - `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts`
  - `src/application/workspaces/tests/WorkspaceInvitationIssuanceUseCase.test.ts`
  - `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts`
