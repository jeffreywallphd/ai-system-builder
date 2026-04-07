# AI Companion: Shared API Contract Package

## Purpose

- Canonical shared API contract layer for Story 14.1.2.
- Ensure desktop and thin clients consume the same typed server transport contracts.
- Extend convergence with Story 14.1.3 shared error semantics.
- Extend convergence with Story 14.1.5 shared client transport behavior.
- Extend convergence with Story 14.1.6 shared list/read query and cache key conventions.
- Extend convergence with Story 14.1.7 realtime event contract foundations.

## Added shared contract homes

- `src/shared/contracts/api/SharedApiContractPrimitives.ts`
- `src/shared/contracts/api/SharedApiQueryConventions.ts`
- `src/shared/contracts/identity/IdentityTransportContracts.ts`
- `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
- `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
- `src/shared/contracts/deployment/DeploymentTransportContracts.ts`
- `src/ui/shared/api/SharedApiClient.ts`
- `src/shared/api/SharedApiClient.ts`

## Story 14.1.3 error-semantic additions

- Shared API primitives now include retryable operational failure code support (`temporarily-unavailable`) and standardized error metadata fields:
  - `sharedCode`
  - `domainCode`
  - `retryable`
  - `userMessage`
- Server transport now applies centralized error translation for HTTP and websocket-adjacent denials so converged routes emit one consistent error surface.
- Client-visible error messages are sanitized to prevent leaking raw paths, credentials, token/secret values, or low-level internal failure details.
- Unknown converged routes now return canonical `not-found` error semantics.

## Added schema homes

- `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts`
- `src/shared/schemas/api/SharedApiQuerySchemaContracts.ts`
- `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- `src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts`

## Converged initial domains covered

- Sessions and trusted-device flows (identity)
- Workspace administration and invitation flows
- Runtime run lifecycle and queue visibility
- Deployment lifecycle and health operations
- Existing converged contracts retained for assets and nodes

## Integration points updated

- Client imports now target shared contracts for identity and workspaces.
- Identity and workspace thin/desktop HTTP clients now compose `SharedApiClient` instead of duplicating raw `fetch` transport logic.
- Server backend API imports now target shared contracts for identity and workspaces.
- Legacy infrastructure SDK contracts are marked as compatibility shims for migration.

## Shared client behavior baseline (Story 14.1.5)

- Auth/session propagation: domain clients pass `sessionToken`; shared client writes bearer auth.
- Configurable transport per host: base URL, credentials mode, fetch implementation, timeouts, default headers, retry policy.
- Normalized error output: transport failures and malformed/non-envelope payloads are mapped to stable shared error semantics.
- Retry and cancellation: GET retries with bounded backoff for retryable failures; callers can cancel using `AbortSignal`.
- Schema enforcement: shared envelope parsing is validated centrally; domain clients can inject stronger endpoint-specific parsers.

## Shared list/read query baseline (Story 14.1.6)

- Canonical list/read keys are centralized: `workspaceId`, `actorWorkspaceId`, `limit`, `offset`, `search`, `sortBy`, `sortDirection`.
- Shared list/read query builders are now reused in converged identity/workspace/node clients.
- Shared list query key generation is centralized via `buildSharedApiListQueryKey` and used by converged asset-selector caches.
- Shared query parser validation (`parseSharedApiListQueryConventions`) now drives consistent pagination validation for converged server list routes.

## Realtime event baseline (Story 14.1.7)

- Shared converged envelope/topic contracts now live in `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`.
- Schema-backed payload parsing now lives in `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`.
- Initial converged categories:
  - `run-status`
  - `queue-movement`
  - `connectivity-state`
  - `admin-change`
- Subscription semantics include actor/workspace scope, topic filters, and reconnect cursors (`runtime-realtime:<sequence>`).
- First server-side publish/subscribe seam is implemented at `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts` and integrated via `SystemRuntimeBackendApi`.

## Canonical doc

- `docs/architecture/shared-api-contract-package.md`
