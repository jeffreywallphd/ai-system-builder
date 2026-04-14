---
title: Unified API Contributor Guide
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

# Unified API Contributor Guide

## Who this is for

Contributors adding or modifying protected client-facing operations for desktop, browser, or mobile-responsive surfaces.

## What to read first

1. `docs/architecture/unified-api-authoritative-surface.md`
2. `docs/architecture/unified-api-endpoint-reference.md`
3. `docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md`
4. Historical transition baseline: `docs/baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.md`
5. `docs/architecture/shared-api-contract-package.md`

## Where to add new shared contracts

1. Transport DTOs and route constants: `src/shared/contracts/<domain>/`
2. Schema validation/parsers: `src/shared/schemas/<domain>/`
3. API orchestration: `src/infrastructure/api/<domain>/`
4. Authoritative server transport routes:
   - route-family registration catalog: `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
   - domain route-family modules: `src/infrastructure/transport/http-server/authoritative-route-families/*`
   - HTTP runtime handler assembly: `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
5. Cross-client shared clients: `src/ui/shared/<domain>/`

## HTTP transport route-family workflow

Use this sequence when adding or modifying authoritative HTTP route families:

1. Update or add the route-family registration module in `src/infrastructure/transport/http-server/authoritative-route-families/*` with stable `routeFamilyId`, canonical `routePrefixes`, and required backend keys.
2. Wire backend availability in `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`.
3. Keep deterministic registry ownership in `src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts`.
4. Implement route-family handler behavior in `src/infrastructure/transport/http-server/identity/route-families/*` and register it in `defaultRouteFamilyHandlers` inside `IdentityHttpServer.ts` when migrating away from inline fallback.
   - Security/governance route-family handlers are now modularized in:
     - `DeploymentPolicyRouteFamilyHandler.ts`
     - `SecretMetadataRouteFamilyHandler.ts`
     - `CertificateOperationsRouteFamilyHandler.ts`
     - `NodeTrustRouteFamilyHandler.ts`
5. Keep middleware order unchanged: metadata -> CORS -> secure transport -> auth/trust -> parse/map -> backend -> status translation -> response envelope.
6. Keep transport DTO mapping in `src/infrastructure/transport/http-server/identity/dto/*` and keep business policy in backend APIs/use-cases.
7. If startup requires coverage for the route family, update `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`.

Reference: `docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md`

## Implementation rules

1. Define contract and schema first, then implement backend/transport, then integrate clients.
2. Keep one shared envelope and error behavior across desktop and thin clients.
3. Reuse `src/ui/shared/api/SharedApiClient.ts` for new HTTP client operations unless a documented exception exists.
4. Keep desktop IPC additions as temporary host adapters only; do not introduce new protected business mutation shortcuts.

## Transport boundary rules (must hold)

1. Do not move transport parsing, protocol, or middleware concerns into `src/application` or `src/domain`.
2. Do not implement business policy in transport handlers or DTO mappers.
3. Do not bypass shared error/status mapping (`IdentityHttpServerErrorTranslation.ts`) or correlation envelope behavior.
4. Do not bypass shared auth/workspace/node trust gates for route-specific convenience.

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

## Permission-sensitive invariant coverage workflow

Use the shared invariant framework as default proof for permission-sensitive behavior changes.

When invariant coverage is required:

1. A change modifies or adds authorization checks, role/permission mapping, sharing semantics, or deny reason behavior.
2. A change modifies workspace target/resource scope semantics, capability target semantics, or scope applicability logic.
3. A change modifies transport route-family behavior where runtime-composed allow/deny behavior must remain aligned with policy evaluation.
4. A change adds a new permissioned feature family or extends an existing one with new capability keys.

Run coverage in normal workflows:

1. Full workflow (docs lint + tests): `npm test`
2. Targeted invariant loop: `npm run test:unit -- src/testing/invariants/tests src/application/authorization/tests/*InvariantCoverage.test.ts`

How to add a new feature family adapter or scenario:

1. Add or update the family adapter in `src/application/authorization/tests/*InvariantCoverageTestSupport.ts` (or a new family-specific support file).
2. Add baseline scenario expectations with `buildAuthorizationBaselineScenarioBuilders()` when the new behavior should inherit shared baseline semantics.
3. Add family scenarios in `src/application/authorization/tests/*InvariantCoverage.test.ts` with explicit decision/runtime expectation metadata.
4. For composed runtime proof, add scenarios using `createAuthorizationInvariantRuntimeFixture(...)` in `*RuntimeComposedInvariantCoverage.test.ts`.
5. Keep scenario setup reusable by extending `src/testing/invariants/fixtures.ts` or `src/testing/invariants/composedRuntimeFixtures.ts` instead of duplicating setup.

Choosing test scope:

1. Use invariant tests when asserting cross-system authorization truth (policy intent, workspace scope semantics, capability/resource target semantics, and stable allow/deny outcomes).
2. Use integration tests when validating route payload shape, HTTP status translation, middleware composition order, or transport serialization concerns.
3. Use lower-level unit tests when validating isolated domain/application logic that does not need composed policy/runtime proof.

Permission-sensitive PR expectations:

1. Include invariant scenarios for all new or changed allow and deny paths.
2. Include at least one scope-mismatch or cross-workspace denial scenario when scope semantics are touched.
3. Include runtime-composed invariant coverage when transport route-family behavior or composed authorization wiring changes.
4. Document why invariant coverage is not needed when only non-permissioned behavior changes.
5. Keep fixture/helper additions reusable across feature families; avoid one-off ad hoc setup in individual tests.

## Authorization diagnostics extension workflow

Use this workflow whenever a change can alter authorization deny outcomes, cross-layer failure provenance, or public authorization error diagnostics.

Canonical contracts and catalogs:

1. Schema and redaction/projection contract: `src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts`
2. Canonical reason-code and provenance-stage catalogs: `src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts`
3. Integration and extension guidance: `docs/architecture/authorization-enforcement-integration-patterns.md`

Where diagnostics are emitted:

1. Route/API boundary mapping: `src/infrastructure/transport/authorization/AuthorizationTransportAdapters.ts`
2. Use-case/evaluator emission helpers: `src/application/authorization/use-cases/AuthorizationDecisionDiagnostics.ts`
3. Policy evaluator decisive and adapter-failure stages: `src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator.ts`
4. Transport status/envelope mapping and correlation continuity: `src/infrastructure/transport/http-server/identity/IdentityHttpServerErrorTranslation.ts`

How to add diagnostics for a new permissioned feature:

1. Reuse a catalog reason code when semantics already exist; otherwise add a stable namespaced reason code.
2. Emit `createAuthorizationDiagnosticRecord(...)` at the stage where evidence is known (`permission-snapshot`, `scope-filtering`, `evaluator-resolution`, `adapter-failure`, or `transport-mapping`).
3. Keep one correlation value across all stages for one decision path using request/correlation headers and evaluator correlation helpers.
4. Include explicit `evidence.missing` markers when upstream evidence is unavailable; do not omit missing evidence silently.
5. Project external diagnostics with `projectAuthorizationDiagnosticRecord(...)`; do not expose actor IDs, target identifiers, or identifier arrays on external surfaces.

Interpretation guardrails for contributors:

1. Correlation IDs answer "which events belong to this denial across layers?"
2. Reason codes answer "what specific policy or boundary condition caused this outcome?"
3. Provenance stages answer "where in the stack did the condition become authoritative?"
4. Extension keys stay namespaced (`team.feature`) and never replace canonical fields.

Required verification for authorization-sensitive changes:

1. Contract-level diagnostics coverage: `src/shared/contracts/authorization/tests/AuthorizationDiagnosticsContracts.test.ts`
2. Evaluator-stage and adapter-failure provenance coverage: `src/application/authorization/tests/AuthorizationPolicyDecisionEvaluator.test.ts`
3. Transport mapping and response posture coverage: `src/infrastructure/transport/authorization/tests/AuthorizationTransportAdapters.test.ts`
4. Invariant and composed integration proof when behavior spans route/API/use-case/evaluator boundaries:
   - `src/testing/invariants/tests`
   - `src/application/authorization/tests/*InvariantCoverage.test.ts`
   - `src/application/authorization/tests/AuthorizationRuntimeContextDriftRegression.test.ts`

## Observability requirements for transport changes

1. Emit structured transport events (request/upgrade/route failure/realtime failure) with `requestId`.
2. Propagate `x-correlation-id`/`x-request-id` and return correlation metadata on safe client-visible errors.
3. Ensure logs/hooks use centralized redaction and avoid secret, prompt, token, or raw storage leakage.
4. Keep HTTP and websocket failure handling semantically consistent and safe.
5. Validate with tests that cover correlation metadata and redaction behavior.

Reference: `docs/unified-api-observability-troubleshooting.md`

## Story 14.3.8 hardening verification baseline

Cross-surface convergence hardening for desktop and thin-client now includes explicit regression and drift checks:

1. Cross-surface parity regression:
   - `src/ui/shared/tests/UnifiedApiCrossSurfaceRegression.test.ts`
   - validates parity for bootstrap/session hydration, representative read+mutation routes, runtime realtime subscription handshake/topics, authorization denials, and transport failure normalization.
2. Authoritative route and client drift verification:
   - `src/infrastructure/transport/http-server/tests/UnifiedApiContractDriftVerification.test.ts`
   - verifies converged shared clients stay aligned to authoritative route-family registration prefixes and convergence domain contracts.
3. Existing route-family coverage remains required:
   - `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`

When touching converged identity/workspace/runtime flows, update these suites in the same PR to preserve desktop and thin-client behavioral parity.
