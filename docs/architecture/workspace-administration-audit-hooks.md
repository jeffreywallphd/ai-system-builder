# Workspace Administration Audit Hooks

This architecture note defines the Story 3.4.5 audit integration seam for workspace administration.

## Purpose

- Keep workspace administration production-operational before the dedicated audit subsystem ships.
- Make mutation-side audit integration points explicit, stable, and consistent at the application boundary.
- Avoid coupling domain invariants to transport or audit infrastructure concerns.

## Canonical seam

- `src/application/workspaces/use-cases/WorkspaceAdministrationAudit.ts`

It introduces:

- `WorkspaceAdministrationAuditSink`
- `WorkspaceAdministrationAuditEvent`
- `WorkspaceAdministrationAuditEventTypes`
- `publishWorkspaceAdministrationAuditEventBestEffort(...)`

## Boundary decision

- Events are emitted from workspace application use cases, after successful persistence.
- Emission is best-effort by design in this story:
  - admin mutations succeed even if audit dispatch fails.
  - a future audit subsystem can replace the sink implementation without changing use-case contracts.

## Event coverage in this slice

- Workspace lifecycle and metadata:
  - `workspace-created`
  - `workspace-updated`
  - `workspace-lifecycle-transitioned`
- Membership administration:
  - `workspace-membership-added`
  - `workspace-membership-status-changed`
- Role administration:
  - `workspace-role-assigned`
  - `workspace-role-reassigned`
  - `workspace-role-revoked`
- Invitation administration:
  - `workspace-invitation-issued`
  - `workspace-invitation-accepted`

## Current use-case wiring

- `CreateWorkspaceUseCase`
- `UpdateWorkspaceUseCase`
- `TransitionWorkspaceLifecycleUseCase`
- `AddWorkspaceMemberUseCase`
- `ChangeWorkspaceMembershipStatusUseCase`
- `RemoveWorkspaceMemberUseCase` (via status-change flow with `mutationKind: "remove"`)
- `AssignWorkspaceRoleUseCase`
- `ReassignWorkspaceRoleUseCase`
- `RevokeWorkspaceRoleUseCase`
- `IssueWorkspaceInvitationUseCase`
- `ResolveWorkspaceInvitationLifecycleUseCase` (accept action)

## Extension expectations for protected resources

Future workspace-scoped resources (workflows, assets, runs, logs, etc.) should follow the same shape:

- define resource mutation events at the application boundary,
- include `workspaceId`, `actorUserIdentityId`, `occurredAt`, and compact `details`,
- reuse best-effort sink dispatch until a durable audit pipeline is wired,
- avoid writing audit concerns into domain aggregate invariants.

## Related operational doc

- `docs/workspace-administration-operations.md`
