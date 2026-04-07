# AI Companion: Unified API Authoritative Surface

## Purpose

- Canonical production-facing guidance for Story 14.1.8.
- Keep desktop + thin clients on one authoritative API contract and transport surface.

## Non-negotiable rules

1. Protected operations must route through authoritative server contracts.
2. Shared request/response DTOs must live in `src/shared/contracts/*`.
3. Shared schema validation must live in `src/shared/schemas/*`.
4. Client code must consume shared clients/contracts, not create UI-only transport DTO forks.

## Prohibited patterns

1. Direct raw storage access for protected operations (filesystem/localStorage as authority).
2. UI-only DTO drift from shared server contracts.
3. Unauthorized local bypass paths that skip authoritative auth/session/authorization.

## Required extension flow

1. Add shared contract in `src/shared/contracts/<domain>/`.
2. Add schema validation in `src/shared/schemas/<domain>/`.
3. Add backend orchestration in `src/infrastructure/api/<domain>/`.
4. Add authoritative HTTP/WSS exposure in `src/infrastructure/transport/http-server/*`.
5. Consume from `src/ui/shared/<domain>/` (typically with `src/ui/shared/api/SharedApiClient.ts`).

## Remaining migration priorities

- Desktop preload protected shortcuts (`electron/preload.ts`) -> authoritative API consumption.
- Managed-service direct side channel (`HttpManagedServiceSupervisorClient`, `ManagedServiceEventStream`) -> authoritative API/WSS broker.
- Browser fallback persistence in `createUiDependencies.ts`/`BrowserFallbackRepositories.ts` -> degraded-mode-only, no protected/admin mutation.

## Canonical docs

- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/unified-api-endpoint-reference.md`
- `docs/architecture/unified-api-convergence-plan.md`
- `docs/architecture/shared-api-contract-package.md`
