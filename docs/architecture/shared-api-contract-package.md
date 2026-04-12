# Shared API Contract Package

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.1, Establish Shared API Contracts and Access Foundations
- Story: 14.1.2, Create the shared API contract and schema package for multi-surface clients
- Story: 14.1.3, Standardize API error, permission-denied, and not-found response semantics
- Story: 14.1.5, Build a shared API client library for desktop and thin-client consumers
- Story: 14.1.6, Add shared query key, pagination, and filter conventions for multi-surface data access
- Story: 14.1.7, Implement real-time event contract foundations for status, queue, and run updates

## Purpose

Provide a canonical shared transport package so desktop, browser, and responsive clients depend on one authoritative request/response contract surface for protected operations.

## Package layout

- `src/shared/contracts/api/SharedApiContractPrimitives.ts`
  - Canonical identifier envelopes, pagination/filtering primitives, mutation result envelopes, and standardized error semantics.
- `src/shared/contracts/api/SharedApiQueryConventions.ts`
  - Canonical query parameter keys, list/read query-string builders, and centralized list query key generation.
- `src/shared/schemas/api/SharedApiQuerySchemaContracts.ts`
  - Shared query parser/validation helpers for pagination, sorting, and search semantics.
- `src/ui/shared/api/SharedApiClient.ts`
  - Shared thin/desktop-ready transport client for authenticated JSON requests, retry/cancellation, response-envelope parsing, and error normalization.
- `src/shared/api/SharedApiClient.ts`
  - Shared re-export for non-UI consumers that need the same client contract.
- `src/shared/contracts/identity/IdentityTransportContracts.ts`
  - Session, trusted-device, and identity admin-lite transport route catalog and typed operation contracts.
- `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`
  - Workspace administration and invitation transport contracts.
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
  - Runtime run lifecycle and queue transport contracts.
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - Canonical run submission/mutation/status contracts for authoritative run lifecycle orchestration.
- `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - Runtime real-time envelope, topic, and subscription contracts for converged desktop/thin-client event handling.
- `src/shared/contracts/deployment/DeploymentTransportContracts.ts`
  - Deployment lifecycle transport contracts.
- `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts`
- `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- `src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts`
  - Schema-backed payload parsers and validation error shaping for shared contracts.

## Usage guidance

1. Prefer imports from `src/shared/contracts/*` in client and backend API adapters.
2. Use schema parser helpers from `src/shared/schemas/*` at transport boundaries (HTTP/WSS handlers, SDK ingest points, or adapter input normalization).
3. Keep UI-specific state out of shared transport contracts; only include server-authoritative DTOs and envelopes.
4. Treat infrastructure `Public*ApiContract.ts` modules as compatibility shims during migration.

## Error semantics standardization (Story 14.1.3)

- Shared error primitives now define:
  - canonical shared error code taxonomy including retryable operational failure classification (`temporarily-unavailable`),
  - stable machine-readable metadata fields for transport errors (`sharedCode`, `domainCode`, `retryable`),
  - user-safe error message field (`userMessage`) for client rendering without leaking internals.
- Authoritative HTTP and websocket-adjacent transport now applies one server-side translation pass before writing client-visible error payloads:
  - maps domain-specific codes into shared semantics while preserving domain code for compatibility,
  - emits shared classification metadata consistently across converged endpoints,
  - sanitizes sensitive/internal message content (paths, credentials, token/secrets, stack/db internals) from client-visible error text.
- Unknown API routes are now emitted with canonical not-found semantics (`404` + `not-found`) instead of endpoint-specific invalid-request fallbacks.

## Current integration points

- Client-side imports:
  - `src/ui/shared/identity/IdentityAuthClient.ts`
  - `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`
- Server-side imports:
  - `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
  - `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`
- Shared transport contracts re-export stable runtime constants from compatibility SDK contracts (for example, `IdentityAuthApiErrorCodes`, `WorkspaceAdministrationApiErrorCodes`, and `WorkspaceInvitationApiErrorCodes`) so backend and client imports remain centered on `src/shared/contracts/*`.

## Migration notes

- Existing `src/infrastructure/api/*/sdk/Public*Contract.ts` files include migration notes and remain source-compatible for current consumers.
- New contract additions for protected domains should land in `src/shared/contracts/*` with corresponding schema validators in `src/shared/schemas/*`.
- New shared API domain clients should compose `SharedApiClient` instead of calling `fetch` directly.

## Shared client usage notes (Story 14.1.5)

1. Domain clients own route/query/body mapping and should delegate HTTP transport to `SharedApiClient`.
2. `SharedApiClient` centralizes:
   - bearer session propagation (`sessionToken`),
   - host-specific transport configuration (`baseUrl`, credentials, timeouts, fetch implementation, retry policy),
   - retry behavior for retryable GET requests,
   - cancellation via `AbortSignal` and timeout controls,
   - normalized error envelopes for transport and non-envelope failures.
3. Domain-specific schema parsing can be injected per call with `parseResponse`.

## Shared list query conventions (Story 14.1.6)

1. Canonical list/read keys are `workspaceId`, `actorWorkspaceId`, `limit`, `offset`, `search`, `sortBy`, and `sortDirection`.
2. Multi-value filters use repeated parameters (`status=a&status=b`), not one-off names for new endpoints.
3. Converged clients should build list/read query strings with helpers from `SharedApiQueryConventions`.
4. HTTP transport handlers should parse and validate list/read pagination/sort/search with `parseSharedApiListQueryConventions`.
5. Client list caches should use `buildSharedApiListQueryKey` so key semantics are stable across desktop and thin surfaces.

## Realtime event contracts (Story 14.1.7)

1. Shared event envelope and topic semantics are defined in `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`.
2. Initial converged categories are schema-backed in `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`:
   - `run-status`
   - `queue-movement`
   - `connectivity-state`
   - `admin-change`
3. Subscription semantics include actor and workspace scope, topic-level filters (`workspaceId`, `executionId`), and reconnect-safe cursors (`runtime-realtime:<sequence>`).
4. The first server-side publish/subscribe seam is implemented at `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts` and integrated into `SystemRuntimeBackendApi`.
5. Desktop and thin clients can consume one stable envelope shape and topic taxonomy without client-specific shortcuts.

### Example: adding a new endpoint to a domain client

```ts
public async listSomething(
  request: { readonly workspaceId: string; readonly limit?: number },
  sessionToken: string,
): Promise<WorkspaceAdministrationApiResponse<ListSomethingApiResponse>> {
  const query = new URLSearchParams();
  query.set("workspaceId", request.workspaceId);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }

  return this.apiClient.requestJson({
    method: "GET",
    path: `/api/v1/workspaces/something?${query.toString()}`,
    sessionToken,
  });
}
```
