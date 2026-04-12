# AI Companion: Workspace Administration Audit Hooks

## Purpose

- Story 3.4.5 adds a production-oriented audit integration seam for workspace administration mutations before the full audit subsystem exists.

## Canonical file

- `src/application/workspaces/use-cases/WorkspaceAdministrationAudit.ts`

## What was added

- `WorkspaceAdministrationAuditSink` with one event ingest method:
  - `recordWorkspaceAdministrationEvent(event)`
- `WorkspaceAdministrationAuditEvent` + stable event-type constants.
- `publishWorkspaceAdministrationAuditEventBestEffort(...)` helper to keep dispatch non-blocking.

## Emission boundary

- Workspace application use cases emit events only after successful persistence.
- Domain aggregates remain audit-agnostic.
- Failure to dispatch audit events does not fail user/admin mutation flows in this story.

## Covered event families

- Workspace: created, updated, lifecycle transitioned.
- Membership: added, status changed (including remove mutation kind).
- Roles: assigned, reassigned, revoked.
- Invitations: issued, accepted.

## Covered use cases

- `CreateWorkspaceUseCase`
- `UpdateWorkspaceUseCase`
- `TransitionWorkspaceLifecycleUseCase`
- `AddWorkspaceMemberUseCase`
- `ChangeWorkspaceMembershipStatusUseCase`
- `RemoveWorkspaceMemberUseCase`
- `AssignWorkspaceRoleUseCase`
- `ReassignWorkspaceRoleUseCase`
- `RevokeWorkspaceRoleUseCase`
- `IssueWorkspaceInvitationUseCase`
- `ResolveWorkspaceInvitationLifecycleUseCase` (accept action)

## Future protected-resource expectation

- New workspace-scoped protected-resource slices should emit similar application-boundary mutation events and reuse the same sink pattern.

## Ops guide

- `docs/workspace-administration-operations.md`
