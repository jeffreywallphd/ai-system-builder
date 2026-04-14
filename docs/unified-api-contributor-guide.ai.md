---
title: "AI Companion: Unified API Contributor Guide"
doc_type: contributor-guide
status: active
authoritativeness: reference
owned_by: team:developer-experience
last_reviewed: 2026-04-12
related_code_paths:
  - src/shared/contracts
  - src/shared/schemas
  - src/infrastructure/api
  - src/infrastructure/transport/http-server
  - src/ui/shared
---

# AI Companion: Unified API Contributor Guide

## Fast path

1. Read `docs/architecture/unified-api-authoritative-surface.md`.
2. Read `docs/architecture/unified-api-endpoint-reference.md` for route-family endpoint mapping.
3. Read `docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md`.
4. Add/update DTO contracts in `src/shared/contracts/*`.
5. Add/update schema validation in `src/shared/schemas/*`.
6. Implement authoritative backend + transport (`src/infrastructure/api/*`, `src/infrastructure/transport/http-server/*`).
   - domain route-family registration modules live in `src/infrastructure/transport/http-server/authoritative-route-families/*`
   - authoritative route-family catalog lives in `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
   - route-family module ownership registry lives in `src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts`
   - modular route handlers live in `src/infrastructure/transport/http-server/identity/route-families/*`
7. Integrate desktop/thin clients through `src/ui/shared/*` using `SharedApiClient`.

## Route-family extension workflow

1. Add/update route-family metadata in `src/infrastructure/transport/http-server/authoritative-route-families/*` with stable `routeFamilyId`, canonical route prefixes, and required backend keys.
2. Wire backend availability in `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`.
3. Keep deterministic registration ownership in `src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts`.
4. Implement/adjust handler behavior in `src/infrastructure/transport/http-server/identity/route-families/*` and register the handler in `defaultRouteFamilyHandlers` in `IdentityHttpServer.ts`.
   - security/governance route-family handlers are modularized in:
     - `DeploymentPolicyRouteFamilyHandler.ts`
     - `SecretMetadataRouteFamilyHandler.ts`
     - `CertificateOperationsRouteFamilyHandler.ts`
     - `NodeTrustRouteFamilyHandler.ts`
5. Preserve middleware order: metadata -> CORS -> secure transport -> auth/trust -> parse/map -> backend -> status translation -> response envelope.
6. Keep transport mapping seams in `src/infrastructure/transport/http-server/identity/dto/*`; do not move business policy into transport handlers/mappers.
7. If the family is required at host startup, update `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`.

## Must not do

1. Direct raw storage access as protected-operation authority.
2. UI-only DTO forks that drift from shared contracts.
3. Local bypass paths around authoritative auth/session/authorization.
4. Transport-policy leakage into `src/application` or `src/domain`.
5. Route-specific bypasses around shared auth/workspace/node trust middleware.
6. Route-local status/error-envelope behavior that bypasses `IdentityHttpServerErrorTranslation.ts`.

## Permission-sensitive invariant adoption

Use shared invariant coverage as the default proof surface for permission-sensitive work.

When invariant tests are required:

1. authorization policy behavior changes (allow/deny semantics, reason codes, role/permission mapping, sharing semantics)
2. workspace target/resource scope applicability changes
3. route-family behavior changes that can alter composed runtime authorization outcomes
4. net-new permissioned capability keys or feature-family authorization paths

Standard workflow commands:

1. full repository workflow: `npm test`
2. targeted invariant loop: `npm run test:unit -- src/testing/invariants/tests src/application/authorization/tests/*InvariantCoverage.test.ts`

How to add adapter/scenario coverage:

1. add/update family adapter logic in `src/application/authorization/tests/*InvariantCoverageTestSupport.ts`
2. reuse baseline scenario builders from `src/testing/invariants/authorizationBaselineScenarios.ts` when baseline semantics apply
3. add family scenarios in `src/application/authorization/tests/*InvariantCoverage.test.ts` with explicit decision/runtime expectation metadata
4. add composed runtime proof in `*RuntimeComposedInvariantCoverage.test.ts` using `createAuthorizationInvariantRuntimeFixture(...)`
5. keep setup reusable by extending shared fixture helpers in `src/testing/invariants/fixtures.ts` and `src/testing/invariants/composedRuntimeFixtures.ts`

Choose test level intentionally:

1. invariant tests: cross-system permission truth and policy/scope/runtime outcome consistency
2. integration tests: route payload/status translation and middleware composition behavior
3. lower-level unit tests: isolated domain/application logic without composed authorization/runtime requirements

Permission-sensitive PR checklist:

1. include invariant scenarios for changed allow and deny outcomes
2. include scope mismatch/cross-workspace denial coverage when scope semantics are touched
3. include runtime-composed invariants when route-family wiring or runtime-composed authorization behavior changes
4. explain any permission-sensitive change that intentionally omits invariant coverage
5. prefer reusable fixtures/helpers over scenario-local setup duplication

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
- `docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md`
- `docs/baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.ai.md`
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
