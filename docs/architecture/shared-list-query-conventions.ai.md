# AI Companion: Shared List Query Conventions

## Purpose

- Canonical list/read query conventions for Story 14.1.6.
- Ensure desktop + thin-client list access uses one shared query contract.
- Standardize pagination/filter/search/sort parsing and cache key generation.

## Canonical list/read query keys

- `workspaceId`
- `actorWorkspaceId`
- `limit`
- `offset`
- `search`
- `sortBy`
- `sortDirection` (`asc` | `desc`)

## Shared implementation homes

- Client/query helpers and query-key builder:
  - `src/shared/contracts/api/SharedApiQueryConventions.ts`
- Server parser and validation helpers:
  - `src/shared/schemas/api/SharedApiQuerySchemaContracts.ts`

## Integrated convergence points

- Shared query builders in converged clients:
  - `src/ui/shared/identity/IdentityAuthClient.ts`
  - `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`
  - `src/ui/shared/nodes/NodeInventoryClient.ts`
- Shared cache/query key generation:
  - `src/ui/studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter.ts`
  - `src/ui/studio-shell/asset-selector/DatasetAssetSelectorAdapter.ts`
- Shared pagination parsing in server transport:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Developer guidance

1. Use shared query builders for new list/read client routes.
2. Use repeated query params for multi-value filters.
3. Validate `limit`/`offset`/`sortDirection`/`search` with shared parser helpers.
4. Emit `invalid-request` validation errors for bad query inputs.
5. Use centralized query key builders for list caches.
6. Keep workspace/actor scope explicit and stable.

## Canonical doc

- `docs/architecture/shared-list-query-conventions.md`
