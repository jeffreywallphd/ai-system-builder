# AI Companion: Workspace Administration Operations

## Scope

- Operational behavior and extension guidance for Story 3.4.5 workspace administration audit hooks.
- Story 11.3.1 workspace encryption-policy administration fields for create/update/list flows.

## Current behavior

- Workspace administration mutations write via application use cases.
- On successful writes, use cases emit best-effort audit events through `WorkspaceAdministrationAuditSink`.
- Audit dispatch failure is intentionally non-blocking in this slice.
- Story 4.3.2 adds centralized policy gating for workspace-sensitive mutations (`system.manage` workspace capability) before mutation use cases execute.
- Self-service invitation onboarding remains outside this admin mutation gate.
- Workspace create and update admin flows now accept explicit `encryptionPolicy` input:
  - `encryptionMode`
  - `contentEncryptionRequired`
  - `keyScope`
  - `allowPreviewDecryption`
  - `allowWorkerDecryption`
- Workspace admin list/read DTOs now surface workspace `encryptionPolicy` so policy posture is inspectable by downstream services and administration surfaces.
- Invalid workspace encryption-policy combinations are rejected at src/domain/application boundaries.

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
- Keep event handling idempotent/durable at adapter level (outbox/log stream/queue), not inside src/domain/application mutation logic.
- Extend this pattern to future workspace-scoped protected resources.

## Verification

- Hook invocation tests:
  - `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
  - `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts`
  - `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts`
  - `src/application/workspaces/tests/WorkspaceInvitationIssuanceUseCase.test.ts`
  - `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts`
