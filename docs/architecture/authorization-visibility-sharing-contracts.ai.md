# AI Companion: Authorization Visibility and Sharing Contracts

## Purpose

Story 4.1.4 adds one canonical protected-resource authorization metadata contract for visibility + explicit sharing state across resource families.

## Canonical files

- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/contracts/authorization/tests/ResourceVisibilitySharingContracts.test.ts`

## Core contract

`ProtectedResourceAuthorizationContract` standardizes:

- resource subject identity (`resourceFamily`, `resourceType`, `resourceId`)
- workspace/owner fields (`workspaceId`, `ownerUserId`)
- visibility (`private`, `workspace`, `shared`, `published`)
- sharing policy (`owner-only`, `workspace-members`, `explicit`, `published`)
- attribution (`createdBy`, `lastModifiedBy`)
- publication metadata (`isPublishedCapable`, `publishedAt`)

## Sharing targets

Explicit sharing grants support:

- `user`
- `workspace-role`
- `workspace`
- `public` (published-only)

Helper constructors provide stable target creation for user/role/workspace/public grant subjects.

## Invariant summary

- `workspace` visibility requires `workspaceId`.
- `private`/`workspace` visibility cannot carry explicit grants.
- `shared` requires explicit mode + one-or-more grants.
- `published` requires published mode + `isPublishedCapable=true` + `publishedAt`.
- workspace-oriented targets require resource `workspaceId` and must match it.
- `public` sharing target is valid only for `published`.

## DTO + migration seams

- DTO round-trip helpers:
  - `toProtectedResourceAuthorizationDto(...)`
  - `rehydrateProtectedResourceAuthorizationFromDto(...)`
- Legacy migration helper:
  - `adaptLegacyProtectedResourceAuthorizationContract(...)`
  - defaults missing owner/modifier attribution from `createdBy`
  - defaults visibility/policy to `private` + `owner-only`

Use the adaptation helper while resources phase in explicit ownership/visibility/sharing fields without breaking current aggregate structures.
