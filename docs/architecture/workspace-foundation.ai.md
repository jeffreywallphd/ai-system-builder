# AI Companion: Workspace Foundation

## Purpose

Implementation-truth baseline for workspace tenancy domain + persistence contracts introduced in Feature 3 / Epic 3.1.

## Canonical files

- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/domain/workspaces/tests/WorkspaceDomain.test.ts`
- `src/shared/contracts/workspaces/WorkspaceRepositoryContracts.ts`
- `src/application/workspaces/ports/IWorkspaceRepository.ts`
- `src/application/workspaces/ports/IWorkspaceMembershipRepository.ts`
- `src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository.ts`
- `src/application/workspaces/ports/IWorkspaceInvitationRepository.ts`
- `src/application/workspaces/ports/IWorkspaceAuthorizationReadRepository.ts`
- `src/application/workspaces/ports/IWorkspaceTransactionManager.ts`
- `src/application/workspaces/ports/WorkspaceRepositoryPorts.ts`
- `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
- `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
- `src/application/workspaces/tests/WorkspaceRepositoryPortsContracts.test.ts`
- `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceMigrations.ts`
- `src/infrastructure/persistence/workspaces/WorkspacePersistenceMapper.ts`
- `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`
- `src/infrastructure/persistence/workspaces/tests/WorkspacePersistenceMapper.test.ts`
- `src/infrastructure/persistence/workspaces/tests/SqliteWorkspacePersistenceAdapter.test.ts`

## Aggregates and value contracts

- `Workspace`
  - identity + lifecycle + ownership metadata
  - statuses: `provisioning`, `active`, `suspended`, `archived`
- `WorkspaceMembership`
  - user membership lifecycle in a workspace
  - statuses: `pending`, `active`, `suspended`, `removed`
- `WorkspaceRoleAssignment`
  - explicit role bindings per workspace member
  - roles: `owner`, `admin`, `member`, `viewer`
  - assignment status: `active`, `revoked`
- `WorkspaceInvitation`
  - email-driven onboarding + invite role projection
  - statuses: `pending`, `accepted`, `declined`, `revoked`, `expired`

## Reusable ownership metadata pattern

Shared ownership model for workspace-scoped protected resources:

- `workspaceId`
- `ownerUserId`
- `visibility` (`private`, `team`, `public`)
- optional `sharingPolicy` reference (`policyId`, optional `policyVersion`)
- `createdBy`
- `lastModifiedBy`
- `createdAt`
- `lastModifiedAt`

Helpers support creation, rehydration, ownership touch attribution, visibility updates, sharing-policy updates, and ownership transfer with invariant checks.

Protected-resource composition pattern is canonical:

- protected resources keep top-level `workspaceId`
- ownership metadata is attached under `ownership`
- `withWorkspaceScopedOwnership(...)` enforces `resource.workspaceId === ownership.workspaceId`
- downstream slices (assets, workflows, runs, logs) should reuse this envelope as-is instead of defining alternate workspace linkage conventions

## Key invariants enforced

- ownership creation requires `createdBy === ownerUserId`
- workspace slug normalization/validation is strict
- workspace lifecycle transitions are explicit and guarded
- archived workspaces cannot remain `public`
- membership lifecycle transitions are explicit and guarded
- active/suspended/removed memberships require correct state timestamps/actor fields
- invitation expiry/order/email/role semantics are validated
- invitation flows cannot assign `owner` role directly
- role-assignment sets reject duplicate active role entries
- each workspace must have exactly one active owner role assignment
- revoking the last active owner role assignment is rejected

## Architectural intent

- Invariants live in domain code, not presentation validation.
- Contracts use existing identity-linked terminology (`userIdentityId`, `workspaceId`).
- Story 3.1.2 adds application repository seams only (no infrastructure adapters):
  - workspace aggregate lookup/persistence,
  - workspace membership lookup/persistence,
  - workspace role-assignment lookup/persistence + active-role counting,
  - workspace invitation lookup/persistence + pending-by-email lookup,
  - workspace-scoped authorization read snapshot projection.
- Shared workspace contract DTOs now define explicit create/update/query/list/mutation payloads and action attribution context for audit-friendly actor metadata.
- Story 3.1.3 adds concrete SQLite persistence:
  - migration-versioned schema (`workspace_repository_migrations`),
  - tenancy tables (`workspace_records`, `workspace_memberships`, `workspace_role_assignments`, `workspace_invitations`),
  - typed row/domain mappers,
  - repository adapter implementing all workspace repository ports.
- Story 3.1.4 hardens concrete repository adapter behavior:
  - full create/read/update/list + lookup persistence paths for workspace/membership/role-assignment/invitation contracts,
  - stale-write guards using persisted mutation timestamps (`last_modified_at`, `updated_at`, revocation/assignment mutation ordering),
  - explicit repository-operation error wrapping for clearer failure-path diagnostics.
- SQL constraints/indexes enforce core operational guarantees:
  - single active owner role assignment per workspace,
  - no duplicate active role binding per `(workspaceId, userIdentityId, role)`,
  - no duplicate membership per workspace/user pair,
  - no duplicate pending invitation per workspace/email,
  - lifecycle metadata coherence via table-level `CHECK` constraints.

## Story 3.2.1 workspace initialization use case

- Added `CreateWorkspaceUseCase` in `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts` for production-safe workspace provisioning flow:
  - validates creation input by reusing workspace domain invariants,
  - enforces slug/id duplicate checks before write path,
  - creates workspace + creator active membership + creator owner role assignment in one orchestration.
- Initialization flow now supports a transaction seam via `IWorkspaceTransactionManager`, so the multi-record create path is atomic when the adapter provides transaction execution.
- `SqliteWorkspacePersistenceAdapter` now implements `runInTransaction(...)` using explicit `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`.
- Creator metadata attribution is deterministic on initialization records (`createdBy` / `lastModifiedBy` and assignment/join timestamps from one clock instant).
- Creation flow has bounded extension hooks for:
  - authorization gating (pre-write actor validation seam),
  - best-effort audit event emission (post-commit seam for future durable audit integration).
- New tests cover:
  - successful workspace initialization with owner membership/role bootstrap,
  - invalid input and duplicate slug handling,
  - authorization hook denial behavior,
  - atomic rollback on initialization failure,
  - SQLite transaction rollback behavior.

## Story 3.1.4 verification additions

- adapter integration tests now assert update round-trips for mutable tenancy aggregates.
- stale update attempts are rejected once newer records are persisted.
- constraint and mutation failures surface contextual repository operation messages.
- ownership metadata standards now include dedicated shared tests at `src/shared/workspaces/tests/WorkspaceOwnership.test.ts`.

