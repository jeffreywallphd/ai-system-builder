# AI Companion: Authorization Role Reference

## Purpose

Story 4.1.3 role-definition baseline for workspace membership authorization semantics.

## Canonical files

- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`

## Contract summary

- Workspace role keys are explicit and centrally discoverable:
  - `owner`, `admin`, `member`, `viewer`.
- Role definitions are workspace-scoped and machine-readable through `baselinePermissionKeys`.
- Role grants are baseline `static` by default, with profile override support for future `policy-influenced` posture.
- Workspace membership role assignment normalization is explicit (`normalizeWorkspaceMembershipRoleKeys(...)`) and rejects invalid role keys.
- Membership-to-authorization projection (`createWorkspaceMembershipAuthorizationSemantics(...)`) returns:
  - normalized role keys,
  - deduplicated baseline permission keys,
  - role-to-permission provenance entries (`permissionSources`).

## Baseline role posture

- `owner`: full permission catalog.
- `admin`: full catalog except publish/unpublish lifecycle actions.
- `member`: collaborator run/create/update posture (no broad manage/delete lifecycle).
- `viewer`: read/list posture.

## Profile override seam

- `createAuthorizationRoleCatalog({ deploymentProfileId, rolePermissionOverrides })` supports additive/subtractive permission layering per role.
- Override inputs are validated against canonical role keys and `AuthorizationPermissionCatalog` permission keys.
- Baseline catalog remains immutable; profile variants are resolved as separate catalog values.

## Separation boundary

- Role membership semantics are intentionally separate from explicit sharing grants in `AuthorizationDomain`.
- This story does not wire runtime enforcement paths; it defines the authoritative role-definition and role-grant contracts consumed by later policy evaluation.
