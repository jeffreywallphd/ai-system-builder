# AI Companion: Unified API Contributor Guide

## Fast path

1. Read `docs/architecture/unified-api-authoritative-surface.md`.
2. Add/update DTO contracts in `src/shared/contracts/*`.
3. Add/update schema validation in `src/shared/schemas/*`.
4. Implement authoritative backend + transport (`src/infrastructure/api/*`, `src/infrastructure/transport/http-server/*`).
   - domain route-family registration modules live in `src/infrastructure/transport/http-server/authoritative-route-families/*`
   - authoritative route-family catalog lives in `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
5. Integrate desktop/thin clients through `src/ui/shared/*` using `SharedApiClient`.

## Must not do

1. Direct raw storage access as protected-operation authority.
2. UI-only DTO forks that drift from shared contracts.
3. Local bypass paths around authoritative auth/session/authorization.

## Migration reminders

- Preload protected shortcuts: converge to authoritative HTTP/WSS.
- Managed-service direct side channels: broker through authoritative API/WSS.
- Browser fallback persistence: degraded-mode-only, no protected/admin mutations.

## Canonical docs

- `docs/unified-api-contributor-guide.md`
- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/shared-api-contract-package.md`
