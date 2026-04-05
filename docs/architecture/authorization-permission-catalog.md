# Authorization Permission Catalog

This note documents Story 4.1.2 (Feature 4 / Epic 4.1): the canonical permission catalog and resource-action matrix used as the authoritative source for permission keys across AI Loom Studio.

## Canonical artifacts

- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`

## Purpose

The permission catalog defines:

- the protected resource families that authorization operates on,
- the supported actions for each resource family,
- deterministic permission key naming,
- helper APIs for consuming permissions without hard-coded string literals.

This keeps policy evaluation, role mapping, explicit sharing, and future enforcement seams aligned to one stable contract.

## Naming contract

All catalog permissions follow this deterministic format:

- `<resource-family>.<action>`

Examples:

- `asset.read`
- `workflow.run`
- `storage-instance.mount`
- `secret-metadata.manage`

The catalog itself owns these strings. Consuming code should derive keys from exported helpers and registry lookups instead of writing literals directly.

## Resource families and action matrix

The catalog currently includes:

- `asset`
- `system`
- `workflow`
- `template`
- `run`
- `queue`
- `log`
- `storage-instance`
- `secret-metadata`
- `artifact` (future publishable artifact family seam)

Each family has an explicit action list in `AuthorizationPermissionActionMatrix`, including capabilities for:

- CRUD-style access where relevant,
- run/queue execution controls,
- sharing and publication lifecycle controls,
- operational management actions.

## Consuming permissions in code

Use exported APIs from `AuthorizationPermissionCatalog.ts`:

- `AuthorizationPermissionCatalog.resources.<family>.<action>` for direct lookup,
- `createCatalogPermissionKey(family, action)` when the pair is known at compile time,
- `isCatalogPermissionKey(value)` for guard/validation paths,
- `getCatalogActionsForResourceFamily(family)` to build UI/configuration surfaces from the matrix.

This prevents duplicate literals and centralizes permission evolution.

## Backward-compatible extension patterns

When adding permissions:

1. Add new actions to an existing family without renaming/removing existing keys.
2. Add new resource families as additive entries in the matrix.
3. Keep existing `<resource-family>.<action>` keys stable to avoid breaking persisted grants, role contracts, and sharing records.
4. Add tests that verify deterministic ordering, uniqueness, and key derivation for new entries.
5. Update this doc and `authorization-permission-catalog.ai.md` in the same change.

Avoid in-place renames of resource families or action names; treat existing keys as durable contracts.
