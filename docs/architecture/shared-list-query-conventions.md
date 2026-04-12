# Shared List Query Conventions

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.1, Establish Shared API Contracts and Access Foundations
- Story: 14.1.6, Add shared query key, pagination, and filter conventions for multi-surface data access

## Purpose

Define one canonical query contract for converged list/read endpoints so desktop and thin clients use the same parameter names, pagination semantics, filter encoding, and cache-key behavior.

## Canonical parameter conventions

### Baseline list/read keys

- `workspaceId`: required for workspace-scoped protected list/read routes.
- `actorWorkspaceId`: optional actor scope where authorization requires explicit actor workspace context.
- `limit`: optional page size, integer `>= 1`, `<= 200`.
- `offset`: optional page offset, integer `>= 0`.
- `search`: optional text search, trimmed, max length `256`.
- `sortBy`: optional server-supported sort field name.
- `sortDirection`: optional sort direction, `asc` or `desc`.

### Filter encoding

- Multi-value filters use repeated keys: `?status=active&status=suspended`.
- Single-value filters use one key/value pair.
- Boolean filters use explicit `true` or `false`.
- Avoid one-off plural CSV names for new endpoints. If legacy params exist, support them only as compatibility fallbacks during migration.

## Shared helper locations

- Query conventions and key builders:
  - `src/shared/contracts/api/SharedApiQueryConventions.ts`
- Query parser/validation helpers:
  - `src/shared/schemas/api/SharedApiQuerySchemaContracts.ts`

## Current converged integrations

- Shared list-query builders now used by multi-surface clients:
  - `src/ui/shared/identity/IdentityAuthClient.ts`
  - `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`
  - `src/ui/shared/nodes/NodeInventoryClient.ts`
- Shared query key builder now centralizes selector cache keys:
  - `src/ui/studio-shell/asset-selector/AgentAssistantAssetSelectorAdapter.ts`
  - `src/ui/studio-shell/asset-selector/DatasetAssetSelectorAdapter.ts`
- Server-side pagination parsing for converged list routes uses shared parser:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Developer guidance for new list endpoints

1. Build query strings with shared helpers, not ad hoc `URLSearchParams` utilities.
2. Reuse canonical keys (`workspaceId`, `limit`, `offset`, `search`, `sortBy`, `sortDirection`) unless an endpoint has a documented exception.
3. Validate pagination/search/sort via `parseSharedApiListQueryConventions` at the transport boundary.
4. Return `invalid-request` with path-scoped validation details for invalid query inputs.
5. Use `buildSharedApiListQueryKey` when adding client-side list cache/query keys.
6. Preserve workspace scope and actor scope explicitly (`workspaceId`, `actorWorkspaceId`) for protected resource routes.
