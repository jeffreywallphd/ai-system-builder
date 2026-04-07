# AI Companion: Unified API Contributor Guide

## Fast path

1. Read `docs/architecture/unified-api-authoritative-surface.md`.
2. Read `docs/architecture/unified-api-endpoint-reference.md` for route-family endpoint mapping.
3. Add/update DTO contracts in `src/shared/contracts/*`.
4. Add/update schema validation in `src/shared/schemas/*`.
5. Implement authoritative backend + transport (`src/infrastructure/api/*`, `src/infrastructure/transport/http-server/*`).
   - domain route-family registration modules live in `src/infrastructure/transport/http-server/authoritative-route-families/*`
   - authoritative route-family catalog lives in `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
6. Integrate desktop/thin clients through `src/ui/shared/*` using `SharedApiClient`.

## Must not do

1. Direct raw storage access as protected-operation authority.
2. UI-only DTO forks that drift from shared contracts.
3. Local bypass paths around authoritative auth/session/authorization.

## Migration reminders

- Preload protected shortcuts: converge to authoritative HTTP/WSS.
- Managed-service direct side channels: broker through authoritative API/WSS.
- Browser fallback persistence: degraded-mode-only, no protected/admin mutations.
- Keep remaining bypass helpers isolated under explicit legacy boundaries:
  - `src/ui/composition/legacy/LegacyManagedServiceBypassBoundary.ts`
  - `src/ui/composition/legacy/LegacyBrowserFallbackRepositories.ts`
  - `src/ui/composition/BrowserFallbackRepositories.ts` is compatibility-shim-only.
- New feature modules should not import bypass helpers directly; use shared API clients/contracts first.

## Canonical docs

- `docs/unified-api-contributor-guide.md`
- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/unified-api-endpoint-reference.md`
- `docs/architecture/shared-api-contract-package.md`
- `docs/unified-api-observability-troubleshooting.md`

## Story 14.3.8 verification guardrails

- Cross-surface regression baseline:
  - `src/ui/shared/tests/UnifiedApiCrossSurfaceRegression.test.ts`
  - Covers desktop/thin-client parity for bootstrap, representative reads/mutations, runtime realtime subscription behavior, authorization denials, and transport-failure normalization.
- Contract drift guardrail:
  - `src/infrastructure/transport/http-server/tests/UnifiedApiContractDriftVerification.test.ts`
  - Verifies converged shared client route prefixes stay aligned with authoritative route-family registration and convergence contracts.
- Keep route-family composition checks green:
  - `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
