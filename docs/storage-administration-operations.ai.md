# AI Companion: Storage Administration Screens

## Scope

- Story 9.4.1 initial storage admin UI implementation.
- Story 9.4.2 create/edit workflow implementation for managed storage instances.
- Adds list/detail inspection plus create/edit administration workflows.

## Canonical files

- `ui/pages/StorageAdministrationPage.tsx`
- `ui/components/storage/StorageInstanceWorkflowPanel.tsx`
- `ui/services/StorageAdministrationService.ts`
- `ui/shared/storage/StorageAdministrationClient.ts`
- `ui/web/storage/StorageAdministrationRoutes.ts`

## Behavior summary

- Authenticated admin UI route: `/settings/storage` (`ROUTE_PATHS.storageAdmin`).
- Uses authoritative storage API endpoints only (`list`, `detail`, `health`).
- Uses authoritative storage API endpoints for mutation flows (`create`, `metadata update`) in addition to list/detail/health.
- List view projects:
  - name
  - backend type
  - workspace scope
  - lifecycle
  - health summary
  - policy highlights
- Detail view projects lifecycle/access/policy/replication/health contracts with explicit loading/empty/error handling.
- Create workflow captures backend/access/policy metadata and validates via shared storage schema contracts before submit.
- Edit workflow updates allowed metadata/policy-label fields only and validates via shared storage schema contracts.
- Mutation flows apply confirmation prompts and render API validation feedback with path-level detail.

## Boundary posture

- Renderer remains thin and contract-driven through client/service seams.
- No renderer-owned path or backend binding internals are exposed.
- Lifecycle, policy, and health semantics remain backend-authoritative.
- Client/server validation posture stays aligned through shared storage transport schema parsers.

## Tests

- `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
- `ui/pages/tests/StorageAdministrationPage.test.tsx`
- `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
