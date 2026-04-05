# AI Companion: Authorization Foundation

## Purpose

Implementation baseline for Story 4.1.1: core authorization domain/value models for RBAC, visibility, sharing, actor/resource policy context, and reusable policy-decision contracts.

## Canonical files

- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/tests/AuthorizationDomain.test.ts`
- `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`
- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`

## Core contracts

- RBAC:
  - `RoleAssignment` (scope-aware role bindings),
  - `PermissionKey` (normalized namespaced permission ids),
  - `PermissionGrant` (allow/deny grants with explicit scope).
- Visibility + sharing:
  - `ResourceVisibility` (`private`, `workspace`, `shared`, `published`),
  - `SharingSubject` (user/workspace-role/workspace/public),
  - `SharingGrant`,
  - `SharingPolicy` (`owner-only`, `workspace-members`, `explicit`, `published`).
- Policy context + result:
  - `ActorContext`,
  - `ResourcePolicyContext`,
  - `PolicyDecision` (`allow`/`deny`/`not-applicable` + reason + matched refs).

## Key invariants enforced

- Role/grant scope fields must match scope kind (`global`, `workspace`, `resource`).
- `user-private` resources cannot carry `workspaceId`; `workspace` resources must.
- `workspace` visibility is valid only for workspace-owned resources.
- `private`/`workspace` visibility cannot include explicit sharing grants.
- `shared` visibility requires explicit policy mode + at least one sharing grant.
- Public sharing subjects are valid only for `published` visibility.
- `published` visibility requires:
  - `isPublishedCapable=true`,
  - `publishedAt`,
  - sharing policy mode `published`.
- Workspace-based sharing subjects must match resource `workspaceId`.

## Cross-layer seam added

- `AuthorizationPolicyEvaluationRequest`
- `AuthorizationPolicyEvaluationResult`

Defined in `src/shared/contracts/authorization/AuthorizationPolicyContracts.ts` for application-layer policy services/adapters to share one evaluation contract without leaking infrastructure concerns into domain code.

## Boundary posture

- Domain-only implementation: no UI, no transport, no persistence, no Electron/Express/filesystem coupling.
- Story provides the authoritative type system and invariants required before runtime enforcement wiring.
- Story 4.1.2 adds the canonical permission matrix/registry seam; see `docs/architecture/authorization-permission-catalog.md`.
- Story 4.1.3 adds the canonical workspace role-definition seam; see `docs/architecture/authorization-role-reference.md`.
