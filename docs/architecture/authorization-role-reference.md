# Authorization Role Reference

This note documents Story 4.1.3 (Feature 4 / Epic 4.1): production role-definition contracts that bind workspace membership role assignments to baseline authorization permissions.

## Canonical artifacts

- `src/domain/authorization/AuthorizationRoleDefinitions.ts`
- `src/domain/authorization/tests/AuthorizationRoleDefinitions.test.ts`

## Purpose

The role-definition layer is the single source of truth for:

- valid workspace authorization role keys,
- baseline role-to-permission mappings,
- workspace membership role-assignment normalization,
- profile-aware role-grant overrides for future deployment policy variation.

It is intentionally separate from explicit sharing grants so role membership and ad-hoc sharing stay distinct policy channels.

## Supported workspace role keys

- `owner`
- `admin`
- `member`
- `viewer`

These role keys align with existing workspace domain terminology and can be assigned in combinations for one workspace membership.

## Baseline grant semantics

All role definitions are workspace-scoped and machine-readable (`baselinePermissionKeys`), with baseline grant strategy `static`.

- `owner`
  - full catalog permissions (`AuthorizationPermissionCatalog.keys`).
- `admin`
  - full catalog permissions except publish/unpublish lifecycle permissions.
- `member`
  - collaborator authoring and execution posture (read + selected create/update/share/run/cancel/retry/enqueue/export/mount actions), no broad manage/delete lifecycle.
- `viewer`
  - read/list posture only.

## Membership to authorization semantics

`createWorkspaceMembershipAuthorizationSemantics(...)` projects workspace membership role assignments into policy-ready authorization inputs:

- validates one-or-more role assignments,
- rejects invalid role keys,
- resolves deduplicated baseline permission keys,
- emits deterministic permission provenance (`permissionSources`) from role to permission.

This output is directly consumable by future policy-evaluation services.

## Deployment profile layering

`createAuthorizationRoleCatalog(...)` accepts profile-aware role permission overrides:

- profile id (`deploymentProfileId`),
- per-role additions/removals of catalog permission keys,
- optional per-role grant strategy overrides (for policy-influenced profiles).

Override application is additive/subtractive over the baseline role catalog and validates all role and permission references against canonical registries.

## Extension rules

1. Keep role keys stable (`owner`, `admin`, `member`, `viewer`) unless a story explicitly introduces new role contracts.
2. Add role grants by extending role definitions and tests in one change.
3. Do not couple role definitions to explicit sharing contracts; sharing is modeled separately in `AuthorizationDomain`.
4. Validate all override permission keys against `AuthorizationPermissionCatalog`.
5. Update `authorization-role-reference.ai.md` and any affected architecture docs with every role-contract change.
