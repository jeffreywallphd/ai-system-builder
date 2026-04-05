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
- `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
- `src/application/workspaces/tests/WorkspaceLifecycleUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts`
- `src/application/workspaces/tests/WorkspaceAdministrationQueryService.test.ts`
- `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts`
- `src/application/workspaces/tests/ResolveAuthenticatedWorkspaceOnboardingUseCase.test.ts`
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
- invitation issuance persists secure token hash references (raw tokens are not stored)
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

## Story 3.2.2 workspace update/archive/reactivation lifecycle management

- Added `UpdateWorkspaceUseCase` in `src/application/workspaces/use-cases/UpdateWorkspaceUseCase.ts` for production-safe workspace metadata changes:
  - mutable fields are explicit (`displayName`, `description`, `visibility`),
  - immutable/protected fields remain unchanged (workspace `id`, `slug`, ownership `ownerUserId`),
  - actor permissions are validated through `IWorkspaceAuthorizationReadRepository` snapshots (active membership + `owner`/`admin` role).
- Added `TransitionWorkspaceLifecycleUseCase` in `src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase.ts` with explicit lifecycle actions:
  - `archive`, `reactivate`, `suspend`, `activate`,
  - role-gated transitions (`owner` required for archive/reactivate; `owner` or `admin` for suspend/activate),
  - invalid state transitions return deterministic invalid-transition outcomes.
- Workspace domain lifecycle map now explicitly supports reactivation (`archived -> active`) while preserving guarded transition behavior for unsupported paths.
- Lifecycle transitions are still domain-first:
  - `transitionWorkspaceStatus(...)` remains the source-of-truth transition guard,
  - archived visibility invariants are preserved (`archived` workspaces cannot be `public`).
- New coverage in `WorkspaceLifecycleUseCases.test.ts` and `WorkspaceDomain.test.ts` validates:
  - happy-path metadata updates and lifecycle archive/reactivation,
  - authorization denials and invalid lifecycle transitions,
  - idempotent lifecycle actions (`changed: false`) and protected-field preservation.

## Story 3.2.3 membership add/remove/status administration flows

- Added:
  - `AddWorkspaceMemberUseCase` (`src/application/workspaces/use-cases/AddWorkspaceMemberUseCase.ts`)
  - `ChangeWorkspaceMembershipStatusUseCase` (`src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase.ts`)
  - `RemoveWorkspaceMemberUseCase` (`src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase.ts`)
- Admin-protected policy is explicit for all membership mutations:
  - actor must have active membership
  - actor must hold `owner` or `admin` role
- Add flow:
  - supports initial `pending` or `active`,
  - defaults role to `member`,
  - rejects `owner` assignment in member-add path,
  - returns deterministic conflict for duplicate membership creation.
- Status/remove flow:
  - uses domain lifecycle transition guards for membership statuses,
  - removal revokes active target role assignments in same orchestration.
- Continuity rule:
  - operations that would leave no active admin-capable member (`owner`/`admin`) are rejected with actionable conflict messaging.
- Metadata persistence for audit friendliness is preserved:
  - membership mutation attribution (`createdBy`, `lastModifiedBy`, status timestamps),
  - role revocation attribution (`revokedBy`, `revokedAt`).
- Coverage added in `src/application/workspaces/tests/WorkspaceMembershipAdministrationUseCases.test.ts` for:
  - add/remove/status happy paths,
  - admin authorization failures,
  - invalid transition handling,
  - last-admin continuity edge cases,
  - actionable add/status/remove result-code mappings.

## Story 3.2.4 workspace role assignment and reassignment administration flows

- Added:
  - `AssignWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase.ts`)
  - `ReassignWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase.ts`)
  - `RevokeWorkspaceRoleUseCase` (`src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase.ts`)
- Role mutation policy is now explicit:
  - actor must have active workspace membership
  - actor must hold `owner` or `admin` role
  - `owner` role mutations are intentionally blocked in role-administration flows (ownership transfer remains separate)
- Assignment/reassignment/revocation orchestration now blocks contradictory state mutations:
  - target membership must exist and be `active`
  - duplicate active `(workspaceId, userIdentityId, role)` assignment attempts are rejected
  - `fromRole === toRole` reassignment requests are rejected
  - admin-role removals are blocked if they would leave no active `owner`/`admin` membership
- Role mutation inputs now capture optional audit-oriented context (`reason`, `correlationId`, `metadata`) for future admin UX and audit integration.
- `WorkspaceMembershipAdministrationUseCases.test.ts` now also validates role assign/reassign/revoke flows, duplicate/forbidden mutation denials, continuity conflicts, and owner-role mutation rejection.

## Story 3.2.5 workspace membership query and listing services

- Added `WorkspaceAdministrationQueryService` (`src/application/workspaces/use-cases/WorkspaceAdministrationQueryService.ts`) as explicit read-path application service for workspace administration interfaces.
- Query paths are explicit and stable:
  - `listWorkspaces` (actor-scoped workspace list with filter and pagination support),
  - `listWorkspaceMemberships`,
  - `listWorkspaceInvitations`,
  - `listWorkspaceRoleAssignments`.
- Read outputs are UI/API-friendly DTOs (not persistence rows) and include operational summaries:
  - workspace membership/role/invitation status summaries,
  - per-member active role summary and admin-capable flags,
  - invitation active/expired indicators relative to query `asOf`,
  - consistent pagination envelopes (`limit`, `offset`, `returned`, `hasMore`).
- Access-aware behavior is enforced at the application boundary:
  - workspace listing is actor-scoped to active workspace membership visibility,
  - workspace membership/invitation/role listing requires active membership plus `owner` or `admin` role in the workspace.
- Added focused tests in `src/application/workspaces/tests/WorkspaceAdministrationQueryService.test.ts` validating:
  - filtering and pagination behavior,
  - summary and DTO shape expectations,
  - forbidden access behavior for non-admin actors,
  - invalid-request handling for missing identifiers.

## Story 3.1.4 verification additions

- adapter integration tests now assert update round-trips for mutable tenancy aggregates.
- stale update attempts are rejected once newer records are persisted.
- constraint and mutation failures surface contextual repository operation messages.
- ownership metadata standards now include dedicated shared tests at `src/shared/workspaces/tests/WorkspaceOwnership.test.ts`.

## Story 3.3.1 workspace invitation issuance and persistence

- Added `IssueWorkspaceInvitationUseCase` (`src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase.ts`) for admin-protected invitation issuance.
- Issuance now enforces:
  - actor active membership + `owner`/`admin` role,
  - duplicate active pending invitation rejection by `(workspaceId, invitedEmail)`,
  - explicit expiration policy bounds (`defaultInvitationTtlMs`, `maxInvitationTtlMs`, optional explicit `expiresAt`/`expiresInMs` input).
- Invitation records now capture issuance metadata needed for join/onboarding flows:
  - `invitationTokenHash` + `invitationTokenHint` (secure token reference persisted, plaintext token returned only at issue time),
  - optional `targetUserIdentityIdHint`,
  - optional `onboardingMetadata`.
- Workspace invitation persistence now includes token-reference and onboarding metadata columns/indexes, plus pending lookup by token hash through `IWorkspaceInvitationRepository.findPendingInvitationByTokenHash(...)`.

## Story 3.3.2 invitation acceptance/decline/invalidation + expiry handling

- Added `ResolveWorkspaceInvitationLifecycleUseCase` (`src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase.ts`) with explicit lifecycle actions:
  - `accept` (token-driven invitation acceptance + membership conversion),
  - `decline` (token-driven invitation decline response),
  - `cancel` (admin-protected pending invitation revocation path).
- Acceptance policy now validates:
  - actor identity compatibility with invite target (`invitedEmail` + optional `targetUserIdentityIdHint`),
  - workspace lifecycle readiness (`active` required for membership conversion),
  - invitation pending/expiry window before token use.
- Expiry handling is now deterministic in application flow:
  - pending invitations encountered after `expiresAt` are persisted as `expired`,
  - replayed/stale/invalid token usage is rejected with a safe generic token failure posture.
- Membership conversion behavior for accepted invitations now supports explicit onboarding outcomes:
  - accepted invites can create/transition membership to `active` (default) or `pending`,
  - invited role projection creates missing active role assignments for the accepting actor,
  - suspended/removed membership conflicts are rejected with deterministic conflict outcomes.
- Added focused coverage in `src/application/workspaces/tests/WorkspaceInvitationLifecycleUseCase.test.ts` for success + failure paths (accept, decline, cancel, expiry resolution, stale token replay rejection, identity/workspace compatibility guards).

## Story 3.3.3 authenticated join and onboarding resolution flow

- Added `ResolveAuthenticatedWorkspaceOnboardingUseCase` (`src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase.ts`) as the signed-in join orchestration entry point for invitation onboarding.
- Authenticated join resolution now:
  - requires explicit authenticated session context (`sessionId`, `userIdentityId`, `email`),
  - supports optional session verification seam (`AuthenticatedWorkspaceOnboardingSessionVerifier`) for trusted-device and security posture checks,
  - supports optional membership posture policy seam (`AuthenticatedWorkspaceOnboardingMembershipPolicy`) to resolve `active` vs `pending` onboarding outcomes without redesign.
- Invitation acceptance bridge now captures onboarding completion state in persisted invitation metadata:
  - `ResolveWorkspaceInvitationLifecycleUseCase` accepts `resolvedOnboardingMetadata` in the `accept` action path,
  - metadata is merged and persisted atomically with invitation acceptance + membership/role projection through `withWorkspaceInvitationOnboardingMetadata(...)`.
- Identity mismatch and invalid invite scenarios remain safely rejected through existing invitation-lifecycle compatibility and token-validation guards; authenticated onboarding maps lifecycle failures to dedicated onboarding-safe error codes (`invalidInvite`, `forbidden`, `conflict`, etc.).
- Added coverage:
  - `ResolveAuthenticatedWorkspaceOnboardingUseCase.test.ts` for authenticated session validation, policy-driven pending onboarding posture, and invalid-invite mapping.
  - updated `WorkspaceInvitationLifecycleUseCase.test.ts` to assert onboarding-resolution metadata persistence on accept.
  - updated `WorkspaceDomain.test.ts` for onboarding metadata merge helper behavior.

## Story 3.3.4 invitation and onboarding API transport exposure

- Added workspace invitation/onboarding public API contracts:
  - `infrastructure/api/workspaces/sdk/PublicWorkspaceInvitationApiContract.ts`
  - `infrastructure/api/workspaces/sdk/index.ts`
- Added `WorkspaceInvitationBackendApi` (`infrastructure/api/workspaces/WorkspaceInvitationBackendApi.ts`) to map transport DTOs into workspace invitation issuance and authenticated onboarding use cases while exposing stable external error codes.
- Extended authoritative HTTP server transport (`infrastructure/transport/http-server/identity/IdentityHttpServer.ts`) with authenticated workspace routes:
  - `POST /api/v1/workspaces/:workspaceId/invitations`
  - `POST /api/v1/workspaces/:workspaceId/onboarding/accept`
- Route behavior is transport-safe and production-oriented:
  - `zod` request validation at boundary,
  - bearer-session authentication enforced via existing authenticated-session guard,
  - workspace admin authorization enforced through existing invitation issuance use-case policy (`owner`/`admin` + active membership),
  - stable external error envelope mapping (`invalid-request`, `forbidden`, `not-found`, `conflict`, `invalid-invite`, `internal`),
  - invitation token hash and persistence internals are not exposed in response payloads.
- Host composition now wires workspace invitation APIs in runtime server bootstrap (`hosts/server/IdentityServerHost.ts`) using existing SQLite workspace persistence and workspace use cases.
- Added HTTP integration coverage for route behavior and contract shape in:
  - `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceInvitations.test.ts`

## Story 3.4.1 workspace administration backend endpoints and presenters

- Added workspace administration API contracts for admin surfaces:
  - `infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract.ts`
  - updated `infrastructure/api/workspaces/sdk/index.ts`
- Added `WorkspaceAdministrationBackendApi` (`infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`) as the transport-facing orchestration/presenter layer for workspace administration screens.
- Backend API behavior now:
  - reuses existing application use cases/query service (no direct domain/persistence bypass),
  - exposes explicit response contracts for workspace list/admin-view/members/invitations/roles,
  - exposes admin mutation flows for workspace create/update/lifecycle, member add/status/remove, role assign/reassign/revoke, and invitation cancellation,
  - maps internal use-case/query errors into stable external error codes for UI clients.
- Extended authoritative HTTP transport (`infrastructure/transport/http-server/identity/IdentityHttpServer.ts`) with authenticated workspace administration endpoints:
  - `GET /api/v1/workspaces`
  - `POST /api/v1/workspaces`
  - `GET /api/v1/workspaces/:workspaceId/admin-view`
  - `PATCH /api/v1/workspaces/:workspaceId`
  - `POST /api/v1/workspaces/:workspaceId/lifecycle`
  - `GET|POST /api/v1/workspaces/:workspaceId/members`
  - `POST /api/v1/workspaces/:workspaceId/members/:userIdentityId/status`
  - `DELETE /api/v1/workspaces/:workspaceId/members/:userIdentityId`
  - `GET|POST /api/v1/workspaces/:workspaceId/invitations` (existing POST invite issuance plus new GET list)
  - `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId`
  - `GET /api/v1/workspaces/:workspaceId/roles`
  - `POST /api/v1/workspaces/:workspaceId/roles/{assign|reassign|revoke}`
- Host composition now wires the workspace administration backend at runtime in `hosts/server/IdentityServerHost.ts`.
- Added HTTP/host integration coverage updates for route behavior and response shape:
  - `infrastructure/transport/http-server/identity/tests/IdentityHttpServerWorkspaceAdministration.test.ts`
  - updated `hosts/server/tests/IdentityServerHost.test.ts`

