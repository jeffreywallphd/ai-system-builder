---
title: HTTP Transport Modularization Module Map
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts
  - src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts
  - src/hosts/server/AuthoritativeServerApiRouteComposition.ts
  - src/hosts/server/IdentityServerHost.ts
---
# HTTP Transport Modularization Module Map

Feature: 1  
Epic: 1.1  
Story: 1.1.1

## Purpose

Define the execution-ordered modularization map for the current monolithic HTTP transport so follow-on stories can extract route families and shared transport concerns without changing external behavior.

## Current Transport Audit (Dev Branch)

Primary transport entrypoint:
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` (`createIdentityHttpServer(...)`)

Current shape:
- One large request listener with ordered inline route dispatch.
- One large websocket upgrade/realtime handler path (`server.on("upgrade", ...)` -> `handleWebSocketUpgrade(...)`).
- Large shared helper surface in the same file (auth guards, schema parse helpers, path/query parsing, status mapping, response shaping).

Route-family metadata already exists, but is not yet the execution router:
- `AuthoritativeApiRouteRegistrationCatalog.ts` composes route-family plans.
- In `IdentityHttpServer.ts`, `routeRegistrationPlan` is currently logged for observability, but request matching still uses inline `if (...)` chains.

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
- authenticated session guard, including trusted-session enforcement (`minimumAssuranceLevel: "authenticated-trusted"`)
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

## Registration and Composition Seams

Host seam remains authoritative:
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`

Transport seam additions:
- Route module registration must be driven by `AuthoritativeApiRouteRegistrationPlan` using deterministic order.
- Preserve today's first-match behavior for overlapping paths (especially runtime routes where authoritative and system-runtime handlers share path shapes).
- Keep websocket startup bound to explicit `webSocket` options from host composition.

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

No production behavior changes in Story 1.1.1:
- documentation and guardrails only
- preserve existing external API behavior and host composition contracts

Key verification anchors:
- `src/infrastructure/transport/http-server/identity/tests/*.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`


