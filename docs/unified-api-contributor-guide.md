# Unified API Contributor Guide

## Who this is for

Contributors adding or modifying protected client-facing operations for desktop, browser, or mobile-responsive surfaces.

## What to read first

1. `docs/architecture/unified-api-authoritative-surface.md`
2. `docs/architecture/unified-api-endpoint-reference.md`
3. `docs/architecture/unified-api-convergence-plan.md`
4. `docs/architecture/shared-api-contract-package.md`

## Where to add new shared contracts

1. Transport DTOs and route constants: `src/shared/contracts/<domain>/`
2. Schema validation/parsers: `src/shared/schemas/<domain>/`
3. API orchestration: `src/infrastructure/api/<domain>/`
4. Authoritative server transport routes:
   - route-family registration catalog: `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
   - domain route-family modules: `src/infrastructure/transport/http-server/authoritative-route-families/*`
   - HTTP runtime handler assembly: `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
5. Cross-client shared clients: `src/ui/shared/<domain>/`

## Implementation rules

1. Define contract and schema first, then implement backend/transport, then integrate clients.
2. Keep one shared envelope and error behavior across desktop and thin clients.
3. Reuse `src/ui/shared/api/SharedApiClient.ts` for new HTTP client operations unless a documented exception exists.
4. Keep desktop IPC additions as temporary host adapters only; do not introduce new protected business mutation shortcuts.

## Explicitly prohibited for new work

1. Direct raw storage access from clients for protected operations.
2. UI-only DTO drift from shared contract packages.
3. Unauthorized local bypass paths that skip authoritative authentication/session/authorization checks.

## Migration rules for legacy pathways

1. If touching desktop preload protected shortcuts in `electron/preload.ts`, include migration toward authoritative HTTP/WSS parity.
2. If touching direct managed-service side channels (`HttpManagedServiceSupervisorClient`, `ManagedServiceEventStream`), route external consumption through authoritative API authorization.
3. If touching browser fallback repositories (`createUiDependencies.ts`, `BrowserFallbackRepositories.ts`), keep scope to degraded-mode-only and avoid protected/admin mutations.
4. If touching compatibility SDK contracts (`src/infrastructure/api/*/sdk/Public*Contract.ts`), land new contract changes in shared contract/schema roots first.
5. Keep remaining bypass helpers isolated under explicit legacy boundaries:
   - managed-service bypass boundary: `src/ui/composition/legacy/LegacyManagedServiceBypassBoundary.ts`
   - browser fallback boundary: `src/ui/composition/legacy/LegacyBrowserFallbackRepositories.ts`
   - compatibility shim only: `src/ui/composition/BrowserFallbackRepositories.ts`
6. Do not import managed-service or browser fallback bypass helpers directly into new feature modules; depend on shared API clients first and use legacy boundaries only when migration blockers are explicit.

## PR checklist

1. Shared contract + schema changes are present and referenced by both backend and clients.
2. Transport handlers enforce authoritative session and policy checks.
3. Route-family registration remains domain-oriented (not client-surface-oriented) and is wired from authoritative host composition.
4. No prohibited pattern was introduced.
5. Docs were updated (both `.md` and `.ai.md` where applicable).

## Observability requirements for transport changes

1. Emit structured transport events (request/upgrade/route failure/realtime failure) with `requestId`.
2. Propagate `x-correlation-id`/`x-request-id` and return correlation metadata on safe client-visible errors.
3. Ensure logs/hooks use centralized redaction and avoid secret, prompt, token, or raw storage leakage.
4. Keep HTTP and websocket failure handling semantically consistent and safe.
5. Validate with tests that cover correlation metadata and redaction behavior.

Reference: `docs/unified-api-observability-troubleshooting.md`
