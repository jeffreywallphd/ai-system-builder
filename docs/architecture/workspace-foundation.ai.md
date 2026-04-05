# AI Companion: Workspace Foundation

## Purpose

Implementation-truth baseline for workspace tenancy domain contracts introduced in Feature 3 / Epic 3.1.

## Canonical files

- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/domain/workspaces/tests/WorkspaceDomain.test.ts`

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
- `createdBy`
- `lastModifiedBy`
- `createdAt`
- `lastModifiedAt`

Helpers support creation, visibility updates, and ownership transfer with invariant checks.

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
- This slice is foundation-only: no repository or transport adapters added yet.

