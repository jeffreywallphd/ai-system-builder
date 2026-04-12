---
title: HTTP Transport Modularization Module Map
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-12
related_code_paths:
  - src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts
  - src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts
  - src/infrastructure/transport/http-server/identity/composition/IdentityHttpTransportComposition.ts
  - src/infrastructure/transport/http-server/identity/composition/RouteModuleRegistry.ts
  - src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts
  - src/infrastructure/transport/http-server/identity/IdentityHttpServerErrorTranslation.ts
  - src/infrastructure/transport/http-server/identity/middleware/session-authentication.ts
  - src/infrastructure/transport/http-server/identity/middleware/workspace-context.ts
  - src/infrastructure/transport/http-server/identity/middleware/request-metadata.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpRequestPrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpResponsePrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpFileResponsePrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpQueryPrimitives.ts
  - src/infrastructure/transport/http-server/identity/tests/HttpTransportPrimitives.test.ts
  - src/infrastructure/transport/http-server/identity/tests/HttpQueryPrimitives.test.ts
  - src/infrastructure/transport/http-server/identity/tests/RequestMetadataMiddleware.test.ts
  - src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerErrorTranslation.test.ts
  - src/infrastructure/transport/http-server/identity/tests/SessionAuthenticationMiddleware.test.ts
  - src/infrastructure/transport/http-server/identity/tests/WorkspaceContextMiddleware.test.ts
  - src/hosts/server/AuthoritativeServerApiRouteComposition.ts
  - src/hosts/server/IdentityServerHost.ts
---
# HTTP Transport Modularization Module Map

Feature: 1  
Epic: 1.1  
Story: 1.1.4

## Purpose

Define the execution-ordered modularization map for the current monolithic HTTP transport so follow-on stories can extract route families and shared transport concerns without changing external behavior.

## Current Transport Audit (Dev Branch)

Primary transport entrypoint:
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` (`createIdentityHttpServer(...)`)

Current shape:
- One large request listener with modular route-family dispatch and a reduced inline fallback shell for route families not yet migrated.
- One large websocket upgrade/realtime handler path (`server.on("upgrade", ...)` -> `handleWebSocketUpgrade(...)`).
- Large shared helper surface in the same file (auth guards, schema parse helpers, path/query parsing, status mapping, response shaping).

Route-family metadata now drives first-pass execution routing:
- `AuthoritativeApiRouteRegistrationCatalog.ts` composes route-family plans.
- In `IdentityHttpServer.ts`, `routeRegistrationPlan` is used by `routeModuleRegistry` for modular dispatch before any retained inline fallback branches.

Current inline route-family execution order in `IdentityHttpServer.ts`:
1. `identity-auth`
2. `security-secret-metadata`
3. `security-certificate-operations`
4. `execution-node-management`
5. `node-trust`
6. `storage-management`
7. `generated-result-management` + `image-asset-management` + `asset-management`
8. `audit-ledger`
9. `run-submission` + `run-read` + `deployment-policy-read/write` + `run-execution-update` + `run-mutation` + `system-runtime` + `image-run-api`
10. `authorization-management`
11. `workspace-administration` + `workspace-invitations/onboarding`
12. readiness probe (`GET /`)

## Shared Middleware Concerns To Extract

Shared request/response concerns currently mixed into route handlers:
- request correlation and structured request/response/timing logging
- API CORS evaluation + preflight handling
- secure transport gates (`requireHttps` / `requireWss` with loopback policy)
- authenticated session guard, including trusted-session enforcement (`sessionAssuranceRequirement: "require-trusted"`)
- workspace context derivation (`requireAuthenticatedWorkspaceSession(...)` from query/path context)
- node-authenticated transport guard (`requireAuthenticatedNodeTransport(...)`) with mTLS trust path
- standardized parse/validation wrappers (JSON body parsing + schema translation)
- per-domain error/status mapping and response envelope writing

## Non-HTTP Responsibilities Currently Entangled

The HTTP file currently also owns responsibilities that should become separate transport modules:
- websocket upgrade admission + auth + trust + origin policy
- runtime realtime websocket protocol framing/subscription handling
- websocket lifecycle trust revalidation/reconnect/certificate-rotation invalidation
- stream/file response orchestration for asset/image/generated-result downloads/previews
- stream request body adapters for upload paths (`toRequestBodyStream(...)`)

## Target Module Map

Target location (within current architecture direction):
- `src/infrastructure/transport/http-server/identity/`

Target module families:
- `composition/`
  - `IdentityHttpTransportComposition.ts` (top-level wiring)
  - `RouteModuleRegistry.ts` (ordered registration from `routeRegistrationPlan`)
- `middleware/`
  - `request-observability.ts`
  - `cors-gate.ts`
  - `secure-transport-gate.ts`
  - `auth-session-guard.ts`
  - `workspace-context-guard.ts`
  - `node-transport-guard.ts`
- `route-families/`
  - one module per authoritative route family id (identity, workspaces, authorization, deployment, audit, node-trust, execution-node-management, security-certificate, security-secrets, storage, assets, image-assets, runtime/run-submission/run-read/run-mutation/run-execution-update/image-run)
- `dto/`
  - route-family scoped request parsers and response mappers
- `websocket/`
  - `upgrade-handler.ts`
  - `runtime-realtime-channel.ts`
  - `lifecycle-monitor.ts`
  - `frame-codec.ts`
- `primitives/`
  - shared transport response writers, error/status mapping helpers, path/query decoders

Boundary rule:
- Domain/application policy stays in backend APIs/use-cases; transport modules remain adapters.

## Story 1.1.2 Implementation Status

Implemented scaffolding in production paths:
- `identity/composition/IdentityHttpTransportComposition.ts` creates a transport composition artifact from server adapter + route plan + route-module registry.
- `identity/composition/RouteModuleRegistry.ts` defines typed route-family module contracts and deterministic registration/lookup behavior.
- `identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts` provides explicit route-family modules mapped to existing authoritative route metadata.
- `identity/dto/IdentityHttpRouteRegistryDtos.ts`, `identity/primitives/RoutePrefixMatcher.ts`, and `identity/middleware/request-observability.ts` provide shared registry DTO/primitives/observability helpers.
- `identity/adapters/IdentityHttpTransportAdapterContracts.ts` establishes the transport adapter interface used by server composition.

Behavioral posture:
- `IdentityHttpServer.ts` now composes route families through `composeIdentityHttpTransport(...)` during startup.
- Request dispatch order and existing inline handler behavior remain unchanged in this story.

## Story 1.1.3 Implementation Status

Implemented shared request/response primitives in production paths:
- `identity/primitives/HttpRequestPrimitives.ts` centralizes URL/query parsing, content-type normalization, JSON request body parsing with payload-size enforcement, and request body stream adaptation.
- `identity/primitives/HttpResponsePrimitives.ts` centralizes JSON emission, no-content responses, and streamed byte writing with backpressure handling.
- `identity/primitives/HttpFileResponsePrimitives.ts` centralizes content-disposition and download filename sanitization behavior.
- `IdentityHttpServer.ts` now consumes these primitives for shared transport concerns across route families while preserving existing route ordering and response semantics.

Targeted regression coverage:
- `identity/tests/HttpTransportPrimitives.test.ts` covers JSON body parsing limits/error behavior, request body streaming, content-type and URL normalization, JSON/no-content response writing, stream response writing, and file content-disposition primitives.

## Story 1.1.4 Implementation Status

Implemented centralized transport error translation in production paths:
- `identity/IdentityHttpServerErrorTranslation.ts` now contains explicit, testable route-family status translation helpers plus shared fallback mapping for canonical error categories.
- `IdentityHttpServer.ts` consumes shared status translators for identity, workspace, authorization, node, storage, asset/image/generated-result, audit, runtime, and run-submission routes instead of in-file per-family status switch blocks.
- Translation metadata (`domainCode`, `sharedCode`, `retryable`) is available from shared helpers to support correlation-friendly diagnostics payloads/logs without leaking unsafe internals.

Targeted regression coverage:
- `identity/tests/IdentityHttpServerErrorTranslation.test.ts` verifies representative override mappings, shared fallback behavior, and runtime default-fallback parity.

## Story 1.2.1 Implementation Status

Implemented shared session-authentication middleware utilities in production paths:
- `identity/middleware/session-authentication.ts` centralizes bearer-token extraction, authenticated session resolution, normalized invalid-session handling, session assurance helpers, and authenticated actor-context derivation.
- `IdentityHttpServer.ts` now consumes the shared middleware utility for user-authenticated HTTP routes via `requireAuthenticatedSession(...)` instead of owning inline bearer/session resolution branches.
- Existing auth semantics and transport trust sequencing are preserved; only session-auth transport concerns were extracted.

Targeted regression coverage:
- `identity/tests/SessionAuthenticationMiddleware.test.ts` covers missing bearer, malformed authorization header, expired/invalid session resolution, and valid session actor-context derivation flows.

## Story 1.2.2 Implementation Status

Implemented shared workspace-context resolution middleware utilities in production paths:
- `identity/middleware/workspace-context.ts` centralizes workspace scope extraction from route/query inputs and returns a normalized workspace transport context (`workspaceId`, `source`, and scope key metadata).
- `IdentityHttpServer.ts` now consumes the shared workspace-context utility through `requireAuthenticatedWorkspaceSession(...)` so workspace-scoped handlers receive normalized context instead of inline scope parsing.
- Existing behavior remains transport-safe: missing or blank workspace scope still rejects early as `invalid-request`, while downstream authorization/business policy remains in backend APIs.

Targeted regression coverage:
- `identity/tests/WorkspaceContextMiddleware.test.ts` covers query-scoped resolution, explicit route-scoped resolution, custom workspace query keys, and representative missing/blank workspace rejection flows.

## Story 1.2.3 Implementation Status

Implemented shared trusted-session/device-assurance enforcement middleware in production paths:
- `identity/middleware/trusted-session-assurance.ts` centralizes assurance requirement mapping (`allow-untrusted`, `allow-pairing`, `require-trusted`) and fail-closed enforcement responses for protected routes.
- `IdentityHttpServer.ts` now consumes shared assurance middleware in `requireAuthenticatedSession(...)`, so protected route declarations use `sessionAssuranceRequirement` instead of route-local trust checks.
- User-session trust and node transport trust remain separate gates; node transport routes continue to use `requireAuthenticatedNodeTransport(...)` without conflating trust domains.

Targeted regression coverage:
- `identity/tests/TrustedSessionAssuranceMiddleware.test.ts` covers requirement mapping, passing assurance levels, and failing trust posture with consistent forbidden response metadata.

## Story 1.2.5 Implementation Status

Implemented shared request metadata and query normalization utilities in production paths:
- `identity/middleware/request-metadata.ts` centralizes request/correlation header names, inbound correlation resolution, response correlation header emission, response-header normalization, and error-envelope correlation metadata injection.
- `identity/primitives/HttpQueryPrimitives.ts` centralizes optional query-string normalization, shared list pagination parsing, enum-list query normalization, and deduplicated repeated/csv query-list handling.
- `IdentityHttpServer.ts` now consumes these shared helpers instead of keeping correlation and shared pagination/query parsing logic inline, preserving current route behavior and diagnostics envelope compatibility.

Targeted regression coverage:
- `identity/tests/RequestMetadataMiddleware.test.ts` covers correlation precedence, invalid/fallback behavior, response header emission, and error-envelope correlation injection behavior.
- `identity/tests/HttpQueryPrimitives.test.ts` covers shared pagination parsing/defaulting behavior and representative query normalization flows.

## Story 1.2.6 Implementation Status

Documented canonical middleware composition order and safety rules for route-family migrations:
- order below is aligned with `IdentityHttpServer.ts` request handling and the extracted middleware/primitives modules.
- guidance is intentionally fail-closed and precedence-preserving so route-family extraction does not change externally observable behavior.

### Required HTTP Middleware Composition Order

Apply the chain in this order for `/api/*` HTTP routes:
1. request metadata bootstrap
   - `resolveRequestCorrelationId(...)` then `setResponseCorrelationHeaders(...)`.
2. request observability start
   - request-received log emission and request timing tracking.
3. CORS gate
   - `evaluateApiCorsRequest(...)` and preflight short-circuit.
4. secure-transport gate
   - `enforceApiSecureTransport(...)` (`requireHttps` + loopback policy).
5. route-family dispatch seam
   - resolve family from `routeModuleRegistry.resolveRouteFamilyByPath(...)`, invoke `routeFamilyHandlers[routeFamilyId]`, then only fall back to inline legacy dispatch when handler returns `handled: false`.
6. route-category authentication and trust gate
   - pre-login routes: no session middleware.
   - session routes: `requireAuthenticatedSession(...)` (`resolveAuthenticatedSessionFromRequest(...)` -> `enforceTrustedSessionAssurance(...)` -> transport trust validation).
   - workspace routes: `requireAuthenticatedWorkspaceSession(...)` (session gate first, then `resolveWorkspaceContextFromRequest(...)`).
   - node routes: `requireAuthenticatedNodeTransport(...)` (required `nodeId`, then mTLS trust path or session-principal fallback depending on transport-trust configuration).
7. request parsing and normalization
   - `parseJsonBody(...)` and route parsers after auth/trust gates in the normal path.
   - query normalization through `HttpQueryPrimitives.ts` helpers where shared list/pagination semantics are required.
8. backend invocation and status translation
   - invoke backend API and map status via route-family translators from `IdentityHttpServerErrorTranslation.ts`.
9. response and error envelope translation
   - always emit via `writeJson(...)`, which applies `normalizeSharedApiErrorEnvelope(...)` and `addCorrelationIdToErrorEnvelope(...)`.
10. terminal fallback behavior
    - unmatched routes return 404.
    - unhandled errors return 500 with sanitized diagnostics.

### Middleware Safety Rules

- Keep gate order immutable: metadata -> CORS -> secure transport -> auth/trust -> parse/validate -> backend -> status translation -> `writeJson(...)`.
- Do not resolve workspace context before a successful authenticated-session gate.
- Do not parse large/complex authenticated payloads before auth/trust checks unless the route requires parsed data to determine trust identity (see lifecycle exception below).
- For node transport routes, do not substitute workspace/session middleware for `requireAuthenticatedNodeTransport(...)`; mTLS and node-id binding must stay authoritative when transport trust is configured.
- Preserve `sessionAssuranceRequirement` semantics (`allow-untrusted`, `allow-pairing`, `require-trusted`) and keep defaults fail-closed for protected routes.
- After any failed middleware/gate, write response and `return`; never continue downstream handler execution.
- Keep status mapping centralized in `IdentityHttpServerErrorTranslation.ts`; avoid ad hoc per-route status switches.
- Keep error envelope normalization centralized in `writeJson(...)`; avoid direct `writeJsonResponse(...)` calls from route handlers.
- Preserve first-match route precedence and legacy fallback behavior across modular route-family migrations.

### Common Route-Category Composition Examples

- pre-login identity route (`POST /api/v1/identity/login`):
  metadata -> CORS -> secure transport -> parse body -> backend -> `mapIdentityAuthApiStatusCode(...)` -> `writeJson(...)`.
- session-only route (`GET /api/v1/security/secrets`):
  metadata -> CORS -> secure transport -> `requireAuthenticatedSession(...)` -> backend -> `mapSecretMetadataApiStatusCode(...)` -> `writeJson(...)`.
- workspace-scoped route (`GET /api/v1/assets`):
  metadata -> CORS -> secure transport -> `requireAuthenticatedWorkspaceSession(...)` -> query normalization/pagination parsing -> backend -> `mapAssetManagementApiStatusCode(...)` -> `writeJson(...)`.
- node route (`POST /api/v1/nodes/:nodeId/heartbeat`):
  metadata -> CORS -> secure transport -> `requireAuthenticatedNodeTransport(...)` -> parse body -> backend -> `mapNodeTrustApiStatusCode(...)` -> `writeJson(...)`.
- special-case authoritative lifecycle update (`POST /api/v1/runtime/runs/:runId/lifecycle`):
  metadata -> CORS -> secure transport -> parse+validate body to extract `senderNodeId` -> `requireAuthenticatedNodeTransport(..., senderNodeId, ...)` -> backend -> `mapRunSubmissionApiStatusCode(...)` -> `writeJson(...)`.

### WebSocket and Readiness Special Cases

- websocket upgrade (`handleWebSocketUpgrade(...)`) has a parallel gate order:
  secure-transport check -> websocket header validation -> bearer-session resolution -> thin-client origin policy -> purpose authorization -> websocket trust validation -> channel establishment.
- root readiness probe (`GET /`) intentionally bypasses API CORS/auth middleware and returns a minimal service-readiness payload.

## Story 1.3.3 Implementation Status

Migrated storage and asset-heavy route families to modular route-family handlers through the existing route-module registry:
- `storage-management` modular handler now owns storage create/list/detail/health/metadata/lifecycle endpoints.
- `asset-management` modular handler now owns logical asset register/list/detail/lifecycle/upload/download/preview endpoints.
- `image-asset-management` modular handler now owns image asset create/list/detail/upload/finalize/preview/original endpoints.
- generated-result retrieval/preview/original/lineage routes are now handled through modular route-family handlers, including run-scoped generated-result listing on `/api/v1/image-runs/:runId/generated-results`.

Behavioral posture:
- shared workspace-auth/session assurance gates continue to be enforced through shared middleware (`requireAuthenticatedWorkspaceSession(...)`).
- stream/file response behavior (headers, disposition, no-store cache posture, and byte streaming) remains transport-compatible with prior production behavior.
- route-family modular dispatch remains hybrid-safe: modular handlers execute first and may intentionally fall back for non-migrated paths.

## Story 1.3.5 Implementation Status

Removed legacy inline dispatch branches for route families now owned by modular handlers:
- `storage-management`
- `asset-management`
- `image-asset-management`
- `image-run-api`
- `audit-ledger`
- `execution-node-management`
- `deployment-policy-read`
- `deployment-policy-write`
- `run-submission`
- `run-read`
- `run-mutation`
- `run-execution-update`

Cleanup posture:
- top-level `IdentityHttpServer.ts` now keeps request entry, shared middleware gates, modular route-family dispatch, websocket/readiness lifecycle, and only the remaining inline fallback families.
- legacy-fallback logging/dispatch is limited to route families that still have retained inline branches.

## Story 1.3.6 Implementation Status

Added a migrated-family route-parity regression suite:
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRouteParityRegression.test.ts`

Parity scope locked by this suite:
- representative endpoint coverage across migrated modular families:
  - `storage-management`
  - `asset-management`
  - `image-asset-management`
  - `audit-ledger`
  - `execution-node-management`
  - `deployment-policy-read`
  - `deployment-policy-write`
  - `run-submission`
  - `run-read`
  - `run-mutation`
  - `run-execution-update`
  - `image-run-api`
- shared auth and workspace guard parity:
  - unauthenticated requests fail with `401`
  - workspace-scoped routes fail with `400` when workspace scope is missing
- trust/assurance parity:
  - run execution lifecycle updates reject mismatched sender identity with `403`
- transport-shape parity:
  - representative JSON success envelopes remain `ok: true` with stable status mapping
  - representative file/stream response (`image-asset-management` original content) preserves stream body and headers (`content-type`, `content-disposition`)
- modularization parity:
  - migrated families emit modular dispatch logs (`identity-http.route-family.modular-handled`)
  - migrated families must not emit legacy fallback logs (`identity-http.route-family.legacy-fallback`)

Expected scope for new migrated route-family modules:
1. Add one representative parity case to `IdentityHttpServerRouteParityRegression.test.ts` for the new `routeFamilyId`.
2. Include auth/workspace-gate assertions that match that route family's contract (`401`, plus `400` workspace missing when workspace-scoped).
3. Include one authorization/trust assertion when the family has protected trust semantics (`403`/fail-closed behavior).
4. Include one transport-shape assertion for the primary response type (JSON or stream/file headers/body).
5. Assert modular dispatch and absence of legacy fallback for that route family id.

## Registration and Composition Seams

Host seam remains authoritative:
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`

Transport seam additions:
- Route module registration must be driven by `AuthoritativeApiRouteRegistrationPlan` using deterministic order.
- Preserve today's first-match behavior for overlapping paths (especially runtime routes where authoritative and system-runtime handlers share path shapes).
- Keep websocket startup bound to explicit `webSocket` options from host composition.

Route-family registration checklist for new transport slices:
1. Add/update family metadata in `src/infrastructure/transport/http-server/authoritative-route-families/*` and keep canonical `routeFamilyId` + `routePrefixes` stable.
2. Ensure backend-key wiring in `AuthoritativeApiRouteRegistrationCatalog.ts` composes the family only when required backend adapters are available.
3. Add the module to `identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts` and preserve deterministic module list ordering.
4. If authoritative startup must require the family, update `AuthoritativeServerRequiredRouteFamilyIds` in `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`.
5. Extend transport bootstrap regression coverage (`IdentityHttpTransportComposition.test.ts`, `IdentityHttpServer.test.ts`, and host startup harness tests) for success path + invalid registration guards.

## DTO Mapping Seams

Create family-scoped transport DTO mappers so route handlers stop owning schema and mapping logic inline:
- identity/workspace/authorization/deployment/audit/node/security/storage/asset/image/runtime mapper modules
- shared parse/status helpers only for cross-family invariants, not family-specific payload logic

## Execution-Ordered Migration Plan

1. Extract shared primitives (`primitives/`) and middleware helpers without changing route behavior.
2. Introduce route-module interface + registry/composition seam; keep monolith as backing implementation.
3. Extract `identity-auth` routes first (smallest blast radius, strongest test coverage).
4. Extract `security-*`, `node-trust`, and `execution-node-management` routes while preserving trusted-session and node-transport enforcement.
5. Extract storage/assets/image/generated-result routes with stream/file behavior parity.
6. Extract audit/deployment/runtime route families, preserving current precedence between authoritative run routes and system-runtime fallbacks.
7. Extract authorization + workspace families.
8. Extract websocket upgrade/realtime/lifecycle modules.
9. Replace inline dispatch with composed route-module registry; keep readiness/404/500 semantics unchanged.

## Known Migration Risks

- Route precedence drift can silently change runtime backend used for shared endpoints.
- Trusted-session enforcement or workspace derivation drift can weaken authorization posture.
- Node mTLS fallback/validation drift can break node control-plane traffic.
- Stream/file response header/body behavior drift can break clients and caching/security semantics.
- Websocket handshake/frame/lifecycle drift can break runtime realtime reliability.

## Validation Expectations

No production behavior changes in Story 1.1.2:
- structural scaffolding + composition contracts only
- preserve existing external API behavior and host composition contracts

Key verification anchors:
- `src/infrastructure/transport/http-server/identity/tests/*.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerStartupHarness.test.ts`


