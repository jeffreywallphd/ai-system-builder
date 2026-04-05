# AI Companion: Authorization Permission Catalog

## Purpose

Story 4.1.2 canonical permission registry for authorization policy checks.

## Canonical files

- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/domain/authorization/tests/AuthorizationPermissionCatalog.test.ts`

## Contract summary

- Permission naming format is deterministic: `<resource-family>.<action>`.
- The matrix (`AuthorizationPermissionActionMatrix`) is the source of truth for:
  - resource families,
  - supported actions per family.
- Registry output (`AuthorizationPermissionCatalog`) provides:
  - `resources` lookup by family/action,
  - `keys` flattened deterministic list,
  - `keySet` uniqueness/validation lookup.

## Resource family coverage

- `asset`
- `system`
- `workflow`
- `template`
- `run`
- `queue`
- `log`
- `storage-instance`
- `secret-metadata`
- `artifact` (future publishable artifact seam)

## Usage helpers

- `createCatalogPermissionKey(family, action)` for typed key generation.
- `isCatalogPermissionKey(value)` for guard/validation checks.
- `getCatalogActionsForResourceFamily(family)` for matrix-driven UI/configuration.

## Extension rules

- Add-only evolution for families/actions.
- Do not rename or remove existing keys.
- Always update tests + docs with matrix changes.
