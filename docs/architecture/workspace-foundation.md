# Workspace Foundation

This note documents the production workspace-tenancy foundation for Feature 3 / Epic 3.1.

Scope in stories 3.1.1 through 3.1.5:

- workspace aggregate and lifecycle invariants
- workspace membership aggregate and lifecycle invariants
- workspace role-assignment aggregate and role-governance invariants
- workspace invitation aggregate and invitation lifecycle invariants
- reusable workspace-scoped ownership metadata patterns for downstream protected resources
- application-layer workspace repository port contracts for persistence and query seams
- shared workspace contract DTOs for create/update/query/list/invitation/membership/role mutation operations
- SQLite persistence schema, migrations, row mappers, and repository adapter for workspace tenancy data
- concrete repository adapter behavior for workspace, membership, role-assignment, and invitation persistence
  - create/read/update/list + lookup paths
  - stale-write protection on mutable records
  - contextual persistence failure surfacing for operational debugging

## Canonical artifacts

- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/shared/contracts/workspaces/WorkspaceRepositoryContracts.ts`
- `src/application/workspaces/ports/IWorkspaceRepository.ts`
- `src/application/workspaces/ports/IWorkspaceMembershipRepository.ts`
- `src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository.ts`
- `src/application/workspaces/ports/IWorkspaceInvitationRepository.ts`
- `src/application/workspaces/ports/IWorkspaceAuthorizationReadRepository.ts`
- `src/application/workspaces/ports/IWorkspaceTransactionManager.ts`
- `src/application/workspaces/ports/WorkspaceRepositoryPorts.ts`
- `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
- `src/application/workspaces/use-cases/AddWorkspaceMemberUseCase.ts`
- `src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase.ts`
- `src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase.ts`
- `src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase.ts`
- `src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase.ts`
- `src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase.ts`
- `src/application/workspaces/use-cases/UpdateWorkspaceUseCase.ts`
- `src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase.ts`
- `src/application/workspaces/use-cases/WorkspaceAdministrationQueryService.ts`
- `src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase.ts`
- `src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase.ts`
- `src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase.ts`
- `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceMigrations.ts`
- `src/infrastructure/persistence/workspaces/WorkspacePersistenceMapper.ts`
- `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`

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
- Invitation issuance persists secure token hash references; raw invitation tokens are never stored.
- Accepted invitations require `acceptedByUserIdentityId` and `respondedAt`.
- Invitation lifecycle transitions are explicit and transition-guarded.

## Ownership metadata reuse pattern

`src/shared/workspaces/WorkspaceOwnership.ts` defines reusable ownership metadata for workspace-scoped protected resources:

- `workspaceId`
- `ownerUserId`
- `visibility` (`private`, `team`, `public`)
- optional `sharingPolicy` reference (`policyId`, optional `policyVersion`)
- `createdBy`
- `lastModifiedBy`
- `createdAt`
- `lastModifiedAt`

Domain helpers provide controlled updates for ownership transfer, visibility changes, sharing-policy linkage, and mutation attribution (`touchWorkspaceOwnershipMetadata`) so downstream resource aggregates can reuse the same semantics.

Protected-resource composition is standardized through `withWorkspaceScopedOwnership(...)`:

- protected resources keep a canonical top-level `workspaceId`
- protected resources attach ownership metadata under `ownership`
- resource `workspaceId` must match `ownership.workspaceId` (enforced by helper validation)
- downstream systems (assets, workflows, runs, logs) should compose this shared envelope rather than introducing parallel workspace-link fields

## Architectural posture

- Domain invariants are enforced in code, not deferred to UI validation.
- Application use cases now have explicit repository seams for workspace aggregates, memberships, invitations, role assignments, and authorization read snapshots.
- Read-model needs and write-model persistence boundaries are separated at the application contract level.
- Shared contracts include explicit actor attribution (`WorkspaceAdministrativeActionContext`) for audit-friendly lifecycle and membership mutations.
- Terminology aligns with existing identity and trusted-device baselines (`userIdentityId`, workspace linkage, lifecycle transition maps, structured mutation attribution).
- No infrastructure details (SQL rows, storage engine APIs, transport objects) leak into workspace application contracts.

## SQLite persistence schema

- Schema is migration-versioned via `workspace_repository_migrations`.
- Core tenancy tables:
  - `workspace_records`
  - `workspace_memberships`
  - `workspace_role_assignments`
  - `workspace_invitations`
- Referential integrity:
  - memberships, role assignments, and invitations reference `workspace_records`.
  - role assignments reference membership scope via `(workspace_id, user_identity_id)`.
  - membership invitation linkage is constrained to same-workspace invitations.
- Ambiguous ownership and duplicate-role prevention:
  - single active owner per workspace (`workspace_role_assignments_single_active_owner_unique` partial unique index)
  - no duplicate active `(workspace_id, user_identity_id, role)` bindings
  - no duplicate membership row per `(workspace_id, user_identity_id)`
  - no duplicate pending invitations for `(workspace_id, invited_email)`
- Lifecycle-state constraints are represented as SQL `CHECK` clauses for membership, role-assignment, and invitation state/metadata coherence.
- Query-supporting indexes cover owner/status, membership workspace/status, invitation pending/expires, and role-assignment workspace/user/role filters used by repository contracts.

## Tests in this slice

- `src/domain/workspaces/tests/WorkspaceDomain.test.ts`
- `src/shared/workspaces/tests/WorkspaceOwnership.test.ts`
- `src/application/workspaces/tests/WorkspaceRepositoryPortsContracts.test.ts`
- `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
- `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceAdministrationQueryService.test.ts`
- `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts`
- `src/application/workspaces/tests/ResolveAuthenticatedWorkspaceOnboardingUseCase.test.ts`
- `src/infrastructure/persistence/workspaces/tests/WorkspacePersistenceMapper.test.ts`
- `src/infrastructure/persistence/workspaces/tests/SqliteWorkspacePersistenceAdapter.test.ts`

Story 3.1.4 extends the adapter integration tests to validate:

- update mutations persist correctly for workspace/membership/role-assignment/invitation records
- stale updates are rejected when a newer persisted record already exists
- SQL constraint failures are surfaced with repository-operation context

## Story 3.2.1 workspace creation and initialization flow

- Added `CreateWorkspaceUseCase` in `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts` as the canonical application entry point for workspace provisioning.
- The use case defines explicit input/output DTOs and structured result/error contracts for predictable calling behavior.
- Initialization orchestration now performs:
  - workspace creation with lifecycle + ownership metadata attribution,
  - creator active membership bootstrap,
  - creator owner role-assignment bootstrap.
- Duplicate handling is explicit:
  - slug uniqueness checks run before writes,
  - generated id collision checks run before writes,
  - write-time uniqueness failures are mapped to deterministic duplicate outcomes.
- Added optional extension seams in the use case for:
  - authorization gating (`assertCanCreateWorkspace`),
  - post-commit audit emission (`recordWorkspaceCreated`, best effort for now).
- Added transaction seam `IWorkspaceTransactionManager` and wired SQLite adapter support:
  - `SqliteWorkspacePersistenceAdapter.runInTransaction(...)` uses `BEGIN IMMEDIATE`, `COMMIT`, and rollback on error.
  - This allows workspace + membership + role initialization writes to be persisted atomically.
- Added test coverage for:
  - successful workspace initialization path,
  - invalid input and duplicate slug rejection,
  - authorization denial path,
  - transaction rollback on initialization failure (both in-memory use-case-level and SQLite adapter-level).

## Story 3.2.2 workspace update/archive/reactivation lifecycle management

- Added `UpdateWorkspaceUseCase` (`src/application/workspaces/use-cases/UpdateWorkspaceUseCase.ts`) to govern mutable workspace metadata updates:
  - only `displayName`, `description`, and `visibility` are accepted in the update path,
  - immutable/protected fields (`id`, `slug`, `ownerUserId`) are preserved by design,
  - actor authorization is checked through `IWorkspaceAuthorizationReadRepository` snapshots, requiring active membership and either `owner` or `admin` role.
- Added `TransitionWorkspaceLifecycleUseCase` (`src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase.ts`) to provide explicit lifecycle actions:
  - `archive`, `reactivate`, `suspend`, `activate`,
  - explicit role policy (`owner` required for archive/reactivate; `owner` or `admin` for suspend/activate),
  - deterministic invalid-transition outcomes for unsupported status paths.
- Domain lifecycle transitions now explicitly permit workspace reactivation (`archived -> active`) while preserving guarded invalid transitions through `transitionWorkspaceStatus(...)`.
- New tests in `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts` and updated domain tests in `src/domain/workspaces/tests/WorkspaceDomain.test.ts` cover:
  - happy-path metadata updates and archive/reactivation flows,
  - permission-denied and invalid-transition edge cases,
  - idempotent lifecycle actions and protected-field behavior.

## Story 3.2.3 membership add/remove/status administration flows

- Added membership-focused use cases:
  - `AddWorkspaceMemberUseCase` (`src/application/workspaces/use-cases/AddWorkspaceMemberUseCase.ts`)
  - `ChangeWorkspaceMembershipStatusUseCase` (`src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase.ts`)
  - `RemoveWorkspaceMemberUseCase` (`src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase.ts`)
- Membership administration now enforces explicit admin authorization policy for protected operations:
  - actor must have active workspace membership
  - actor must have `owner` or `admin` role
- Membership add flow behavior:
  - supports initial status `pending` or `active`
  - defaults to `member` role assignment when no explicit role set is provided
  - rejects `owner` assignment in add flow (ownership transfer remains separate)
  - rejects duplicate member creation with actionable conflict output
- Membership status transition flow behavior:
  - uses domain lifecycle transitions for `pending`/`active`/`suspended`/`removed`
  - emits deterministic invalid-transition outcomes for unsupported paths
  - removal transitions revoke all active role assignments for the target member in the same orchestration
- Admin continuity guard is now enforced for status and removal flows:
  - operations that would remove/suspend the last active admin-capable member (`owner` or `admin`) are blocked
  - actionable conflict guidance is returned so callers can assign a replacement admin first
- Actor/timestamp metadata is persisted through domain mutation fields:
  - membership: `createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`, `joinedAt`, `removedAt`, `removedByUserId`
  - role assignment revocation: `revokedBy`, `revokedAt`
- New test coverage in `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts` validates:
  - member add happy path and metadata attribution
  - admin-only operation gating
  - status change transitions and invalid transition handling
  - remove flow role revocation behavior
  - last-admin continuity edge-case enforcement
  - actionable result-code mapping across add/status/remove failure paths

## Story 3.2.4 workspace role assignment and reassignment administration flows

- Added role-focused use cases:
  - `AssignWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase.ts`)
  - `ReassignWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase.ts`)
  - `RevokeWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase.ts`)
- Role administration now enforces explicit mutation policy:
  - actor must have active workspace membership
  - actor must have `owner` or `admin` role
  - `owner` role mutation is blocked in role-administration flows and remains in ownership-transfer lifecycle
- Role mutation invariants are now explicit in application orchestration:
  - target membership must exist and be `active`
  - duplicate active role assignment creation for `(workspaceId, userIdentityId, role)` is blocked
  - contradictory reassignment requests (`fromRole === toRole`) are rejected
  - continuity guard blocks admin-role removals that would leave no active `owner` or `admin` membership
- Role mutation inputs now support optional audit context capture (`reason`, `correlationId`, `metadata`) for future admin UX and audit stream integration.
- Coverage in `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts` now includes:
  - role assignment happy path
  - role reassignment revoke+replace behavior
  - duplicate and unauthorized role mutation denials
  - continuity-policy conflicts for last active admin-capable membership
  - owner-role mutation rejection in role-administration paths

## Story 3.2.5 workspace membership query and listing services

- Added `WorkspaceAdministrationQueryService` (`src/application/workspaces/use-cases/WorkspaceAdministrationQueryService.ts`) as the explicit workspace-administration read-path application service.
- Query operations are explicit and stable for admin/operations interfaces:
  - `listWorkspaces` (actor-scoped workspace listing with filter and pagination),
  - `listWorkspaceMemberships`,
  - `listWorkspaceInvitations`,
  - `listWorkspaceRoleAssignments`.
- Read responses are UI/API-oriented DTOs with summary data and no raw persistence-row exposure:
  - workspace membership/role/invitation summary counts,
  - per-member active role summaries and admin-capable flags,
  - invitation active/expired indicators at query time,
  - consistent pagination envelope (`limit`, `offset`, `returned`, `hasMore`).
- Access-aware behavior assumptions are enforced in the application layer:
  - workspace listing is scoped to workspaces where the actor has active membership visibility,
  - membership/invitation/role listing requires active workspace membership and an `owner` or `admin` role.
- Added `src/application/workspaces/tests/WorkspaceAdministrationQueryService.test.ts` coverage for:
  - filtering and pagination behavior,
  - DTO shape and summary-field behavior,
  - forbidden access paths for non-admin actors,
  - invalid-request handling for missing required identifiers.

## Story 3.3.1 workspace invitation issuance and persistence

- Added `IssueWorkspaceInvitationUseCase` (`src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase.ts`) for admin-protected invitation issuance.
- Issuance policy now enforces:
  - actor active workspace membership,
  - actor role gate (`owner` or `admin`),
  - duplicate pending invitation conflict handling by workspace/email,
  - explicit expiration-policy bounds using default/max invitation TTL.
- Invitation records now persist issuance metadata required for secure onboarding:
  - `invitationTokenHash` and `invitationTokenHint` (hash persisted; raw token returned only during issuance),
  - optional `targetUserIdentityIdHint`,
  - optional `onboardingMetadata`.
- Workspace invitation persistence now includes token/onboarding columns and repository lookup by pending token hash (`findPendingInvitationByTokenHash(...)`) to support secure join flow continuation stories.

## Story 3.3.2 invitation acceptance, decline, invalidation, and expiry resolution

- Added `ResolveWorkspaceInvitationLifecycleUseCase` (`src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase.ts`) to provide explicit invitation lifecycle mutation actions:
  - `accept` (invite token -> invitation acceptance + membership projection),
  - `decline` (invite token -> declined invitation response),
  - `cancel` (admin-protected pending invitation invalidation/revocation).
- Acceptance flow now enforces application-level invariants before membership conversion:
  - actor identity compatibility with invitation target (`invitedEmail` and optional `targetUserIdentityIdHint`),
  - workspace lifecycle compatibility (`active` only for join conversion),
  - invitation pending-state and expiry validation before use.
- Expiry resolution behavior is now explicit and deterministic:
  - pending invitations encountered past `expiresAt` are transitioned to `expired`,
  - stale/replayed/invalid token usage returns a safe generic token failure without revealing invite state.
- Membership conversion behavior on acceptance now supports explicit onboarding posture:
  - accepted invitations can materialize target membership as `active` (default) or `pending`,
  - invited roles are projected as active role assignments when missing,
  - existing suspended/removed membership conflicts are rejected with actionable conflict outcomes.
- Added focused use-case tests in `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts` covering:
  - acceptance happy path (membership + role projection),
  - pending-membership acceptance mode,
  - decline flow behavior,
  - cancellation authorization and revocation behavior,
  - expiry resolution and stale/reused token rejection,
  - identity/workspace-state compatibility failures.

## Story 3.3.3 authenticated join and onboarding resolution flow

- Added `ResolveAuthenticatedWorkspaceOnboardingUseCase` (`src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase.ts`) as the signed-in join orchestration entry point for invitation onboarding.
- Authenticated join resolution now:
  - requires explicit authenticated session context (`sessionId`, `userIdentityId`, `email`),
  - exposes a session verification seam (`AuthenticatedWorkspaceOnboardingSessionVerifier`) for trusted-device and security posture checks,
  - exposes a membership posture policy seam (`AuthenticatedWorkspaceOnboardingMembershipPolicy`) to resolve `active` vs `pending` onboarding outcomes without redesign.
- Invitation acceptance now captures onboarding completion state in persisted invitation metadata:
  - `ResolveWorkspaceInvitationLifecycleUseCase` accepts `resolvedOnboardingMetadata` in the `accept` flow,
  - metadata is merged and persisted atomically with invitation acceptance + membership/role projection using `withWorkspaceInvitationOnboardingMetadata(...)`.
- Identity mismatch and invalid invite scenarios continue to fail safely through existing invitation-lifecycle guards, while authenticated onboarding maps those outcomes to dedicated onboarding-safe error codes (`invalidInvite`, `forbidden`, `conflict`, etc.).
- Added coverage:
  - `ResolveAuthenticatedWorkspaceOnboardingUseCase.test.ts` for session verification, policy-driven pending onboarding, and invalid-invite mapping.
  - updated `WorkspaceInvitationLifecycleUseCase.test.ts` to verify onboarding-resolution metadata persistence.
  - updated `WorkspaceDomain.test.ts` for invitation onboarding metadata merge helper behavior.

