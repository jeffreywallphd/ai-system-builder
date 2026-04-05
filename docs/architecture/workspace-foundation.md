# Workspace Foundation

This note documents the initial production workspace-tenancy foundation for Feature 3 / Epic 3.1.

Scope in stories 3.1.1 and 3.1.2 is intentionally inner-layer first:

- workspace aggregate and lifecycle invariants
- workspace membership aggregate and lifecycle invariants
- workspace role-assignment aggregate and role-governance invariants
- workspace invitation aggregate and invitation lifecycle invariants
- reusable workspace-scoped ownership metadata patterns for downstream protected resources
- application-layer workspace repository port contracts for persistence and query seams
- shared workspace contract DTOs for create/update/query/list/invitation/membership/role mutation operations

## Canonical artifacts

- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/shared/contracts/workspaces/WorkspaceRepositoryContracts.ts`
- `src/application/workspaces/ports/IWorkspaceRepository.ts`
- `src/application/workspaces/ports/IWorkspaceMembershipRepository.ts`
- `src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository.ts`
- `src/application/workspaces/ports/IWorkspaceInvitationRepository.ts`
- `src/application/workspaces/ports/IWorkspaceAuthorizationReadRepository.ts`
- `src/application/workspaces/ports/WorkspaceRepositoryPorts.ts`

## Core concepts and contracts

### Workspace

- Aggregate root representing tenancy boundary identity and lifecycle.
- Canonical fields include:
  - `id`, `slug`, `displayName`, optional `description`
  - lifecycle `status` (`provisioning`, `active`, `suspended`, `archived`)
  - ownership metadata envelope (`workspaceId`, `ownerUserId`, `visibility`, `createdBy`, `lastModifiedBy`, timestamps)

### WorkspaceMembership

- Represents user membership inside a workspace tenancy boundary.
- Canonical fields include:
  - `workspaceId`, `userIdentityId`
  - lifecycle `status` (`pending`, `active`, `suspended`, `removed`)
  - invitation linkage (`invitationId`, `invitedByUserId`) and transition metadata (`joinedAt`, `removedAt`, `removedByUserId`)
  - mutation attribution (`createdBy`, `lastModifiedBy`)

### WorkspaceRoleAssignment

- Represents role bindings over workspace membership scope.
- Canonical fields include:
  - `workspaceId`, `userIdentityId`, `role`
  - assignment lifecycle (`active`, `revoked`)
  - assignment/revocation attribution and timestamps
- Roles are explicit:
  - `owner`, `admin`, `member`, `viewer`

### WorkspaceInvitation

- Represents pending workspace onboarding actions by email.
- Canonical fields include:
  - `workspaceId`, `invitedEmail`, `invitedByUserId`, `invitedRoles`
  - lifecycle `status` (`pending`, `accepted`, `declined`, `revoked`, `expired`)
  - invitation window (`createdAt`, `expiresAt`) and response metadata (`respondedAt`, `acceptedByUserIdentityId`)

## Invariants enforced in domain code

### Workspace invariants

- Workspace slug is canonical lowercase identifier (`a-z`, `0-9`, `-` separated).
- Ownership metadata creation requires `createdBy === ownerUserId`.
- Archived workspaces cannot remain `public`.
- Lifecycle transitions are explicit and transition-guarded.

### Membership invariants

- `active` memberships require `joinedAt`.
- `suspended` memberships require `suspendedAt`.
- `removed` memberships require both `removedAt` and `removedByUserId`.
- Membership lifecycle transitions are explicit and transition-guarded.

### Role-assignment invariants

- Assignment role must be one of canonical workspace roles.
- Revoked assignments must include revocation metadata.
- Duplicate active role assignments for the same `(workspaceId, userIdentityId, role)` are rejected.
- Workspace assignment sets must have exactly one active `owner` role assignment.
- Last active owner role assignment cannot be revoked.

### Invitation invariants

- Invitation email is normalized and validated.
- Invitation expiry must be strictly after creation timestamp.
- Invitations must include at least one role.
- Invitations cannot directly assign `owner` role (ownership transfer is separate).
- Accepted invitations require `acceptedByUserIdentityId` and `respondedAt`.
- Invitation lifecycle transitions are explicit and transition-guarded.

## Ownership metadata reuse pattern

`src/shared/workspaces/WorkspaceOwnership.ts` defines reusable ownership metadata for workspace-scoped protected resources:

- `workspaceId`
- `ownerUserId`
- `visibility` (`private`, `team`, `public`)
- `createdBy`
- `lastModifiedBy`
- `createdAt`
- `lastModifiedAt`

Domain helpers provide controlled updates for ownership transfer and visibility changes so downstream resource aggregates can reuse the same mutation and attribution semantics.

## Architectural posture

- Domain invariants are enforced in code, not deferred to UI validation.
- Application use cases now have explicit repository seams for workspace aggregates, memberships, invitations, role assignments, and authorization read snapshots.
- Read-model needs and write-model persistence boundaries are separated at the application contract level.
- Shared contracts include explicit actor attribution (`WorkspaceAdministrativeActionContext`) for audit-friendly lifecycle and membership mutations.
- Terminology aligns with existing identity and trusted-device baselines (`userIdentityId`, workspace linkage, lifecycle transition maps, structured mutation attribution).
- No infrastructure details (SQL rows, storage engine APIs, transport objects) leak into workspace application contracts.

## Tests in this slice

- `src/domain/workspaces/tests/WorkspaceDomain.test.ts`
- `src/application/workspaces/tests/WorkspaceRepositoryPortsContracts.test.ts`

