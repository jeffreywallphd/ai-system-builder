# AI Companion: Storage Administration Screens

## Scope

- Story 9.4.1 initial storage admin UI implementation.
- Adds list/detail inspection surface for managed storage instances.

## Canonical files

- `ui/pages/StorageAdministrationPage.tsx`
- `ui/services/StorageAdministrationService.ts`
- `ui/shared/storage/StorageAdministrationClient.ts`
- `ui/web/storage/StorageAdministrationRoutes.ts`

## Behavior summary

- Authenticated admin UI route: `/settings/storage` (`ROUTE_PATHS.storageAdmin`).
- Uses authoritative storage API endpoints only (`list`, `detail`, `health`).
- List view projects:
  - name
  - backend type
  - workspace scope
  - lifecycle
  - health summary
  - policy highlights
- Detail view projects lifecycle/access/policy/replication/health contracts with explicit loading/empty/error handling.

## Boundary posture

- Renderer remains thin and contract-driven through client/service seams.
- No renderer-owned path or backend binding internals are exposed.
- Lifecycle, policy, and health semantics remain backend-authoritative.

## Tests

- `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `ui/pages/tests/StorageAdministrationPage.test.tsx`
- `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
