# Authorization Visibility and Sharing Contracts

This note documents Story 4.1.4 (Feature 4 / Epic 4.1): canonical protected-resource visibility and explicit sharing contracts used by authorization enforcement seams.

## Canonical artifacts

- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/contracts/authorization/tests/ResourceVisibilitySharingContracts.test.ts`

## Purpose

Provide one reusable authorization metadata envelope for protected resources so assets, workflows, systems, templates, runs, queues, logs, storage instances, and future artifacts expose consistent policy-relevant fields:

- `workspaceId`
- `ownerUserId`
- `visibility`
- `sharingPolicy`
- `createdBy`
- `lastModifiedBy`

The contract is intentionally resource-family agnostic and aligns to existing authorization visibility modes (`private`, `workspace`, `shared`, `published`).

## Contract summary

`ProtectedResourceAuthorizationContract` contains:

- `subject` (`resourceFamily`, `resourceType`, `resourceId`)
- workspace/owner attribution (`workspaceId`, `ownerUserId`)
- visibility and sharing policy (`visibility`, `sharingPolicy`)
- mutation attribution (`createdBy`, `lastModifiedBy`)
- publication metadata (`isPublishedCapable`, optional `publishedAt`)

`sharingPolicy` contains:

- `mode` (`owner-only`, `workspace-members`, `explicit`, `published`)
- `allowResharing`
- explicit `grants`

Each grant contains:

- `id`
- `target` (`user`, `workspace-role`, `workspace`, `public`)
- `permissionKeys`

Helper constructors exist for explicit user/role/workspace/public sharing targets.

## Invariants

- `workspace` visibility requires `workspaceId`.
- `private` visibility requires `owner-only` mode and no explicit grants.
- `workspace` visibility requires `workspace-members` mode and no explicit grants.
- `shared` visibility requires `explicit` mode and one-or-more explicit grants.
- `published` visibility requires:
  - `published` mode,
  - `isPublishedCapable=true`,
  - `publishedAt`.
- public sharing targets are valid only for `published` resources.
- workspace and workspace-role sharing targets require `workspaceId` and must match the resource `workspaceId`.

## Serialization seam

DTO helpers are provided:

- `toProtectedResourceAuthorizationDto(...)`
- `rehydrateProtectedResourceAuthorizationFromDto(...)`

These normalize data through the same invariant checks used by canonical creation, so persistence/transport round-trips keep contract semantics stable.

## Legacy adaptation guidance

For resources that do not yet expose all canonical fields:

1. Keep existing aggregate shape unchanged for now.
2. Build a `ProtectedResourceAuthorizationContract` projection at application/service boundaries.
3. Use `adaptLegacyProtectedResourceAuthorizationContract(...)` during migration:
   - if `ownerUserId` is missing, it defaults to `createdBy`,
   - if `lastModifiedBy` is missing, it defaults to `createdBy`,
   - `visibility` defaults to `private` with `owner-only` sharing mode.
4. Backfill explicit `workspaceId` and sharing policy data before moving resources to `workspace`, `shared`, or `published`.

This keeps enforcement seams consistent immediately while allowing gradual field adoption by each resource family.
