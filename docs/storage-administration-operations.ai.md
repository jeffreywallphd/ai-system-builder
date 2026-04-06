# AI Companion: Storage Administration Screens

## Scope

- Story 9.4.1 initial storage admin UI implementation.
- Story 9.4.2 create/edit workflow implementation for managed storage instances.
- Story 9.4.3 operational status/capability/sync posture presentation.
- Story 9.4.4 lifecycle activation/deactivation controls with safety confirmations.
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
  - sync posture
  - availability summary
  - policy highlights
- Detail view projects lifecycle/access/policy/replication/health contracts with explicit loading/empty/error handling.
- Story 9.4.3 adds inspection-driven readiness rendering:
  - `healthy`, `degraded`, `inactive`, and `unhealthy/unsupported` distinctions
  - operational usability messaging for non-usable instances
  - capability profile summary using contract-safe support flags
  - synchronization posture clarity (sync-capable vs not, deployment availability, sync status)
- Create workflow captures backend/access/policy metadata and validates via shared storage schema contracts before submit.
- Edit workflow updates allowed metadata/policy-label fields only and validates via shared storage schema contracts.
- Mutation flows apply confirmation prompts and render API validation feedback with path-level detail.
- Story 9.4.4 adds lifecycle controls for selected storage details:
  - activate and deactivate actions are surfaced only when both access summaries and lifecycle state rules allow them
  - lifecycle actions require explicit confirmation with operational impact messaging
  - conflict/invalid-state responses from the server are surfaced as operator guidance to refresh/retry from current authoritative state
  - mutation success paths trigger authoritative list/detail refresh through existing mutation-complete seams

## Boundary posture

- Renderer remains thin and contract-driven through client/service seams.
- No renderer-owned path or backend binding internals are exposed.
- Lifecycle, policy, and health semantics remain backend-authoritative.
- Client/server validation posture stays aligned through shared storage transport schema parsers.

## Tests

- `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
- `ui/services/tests/StorageAdministrationService.test.ts`
- `ui/pages/tests/StorageAdministrationPage.test.tsx`
- `ui/pages/tests/StorageAdministrationPage.presentation.test.ts`
- `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
