---
title: HTTP Transport Modularization Module Map
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-12
related_code_paths:
  - src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts
  - src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts
  - src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts
  - src/infrastructure/transport/http-server/identity/composition/IdentityHttpTransportComposition.ts
  - src/infrastructure/transport/http-server/identity/composition/IdentityHttpUpgradeBoundary.ts
  - src/infrastructure/transport/http-server/identity/composition/RouteModuleRegistry.ts
  - src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts
  - src/infrastructure/transport/http-server/identity/route-families/IdentityAndTrustedDeviceRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/WorkspaceRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/AuthorizationRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/AuditRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/ExecutionNodeManagementRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/DeploymentPolicyRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/SecretMetadataRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/CertificateOperationsRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/NodeTrustRouteFamilyHandler.ts
  - src/infrastructure/transport/http-server/identity/route-families/RunRouteFamilyHandlers.ts
  - src/infrastructure/transport/http-server/identity/dto/AuditRouteDtoMapper.ts
  - src/infrastructure/transport/http-server/identity/dto/ExecutionNodeManagementRouteDtoMapper.ts
  - src/infrastructure/transport/http-server/identity/dto/RunRouteDtoMapper.ts
  - src/infrastructure/transport/http-server/identity/IdentityHttpServerErrorTranslation.ts
  - src/infrastructure/transport/http-server/identity/middleware/session-authentication.ts
  - src/infrastructure/transport/http-server/identity/middleware/workspace-context.ts
  - src/infrastructure/transport/http-server/identity/middleware/request-metadata.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpRequestPrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpResponsePrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpFileResponsePrimitives.ts
  - src/infrastructure/transport/http-server/identity/primitives/HttpQueryPrimitives.ts
  - src/hosts/server/AuthoritativeServerApiRouteComposition.ts
  - src/hosts/server/IdentityServerHost.ts
---
# HTTP Transport Modularization Module Map

Feature: 1  
Epic: 1.4  
Story: 1.4.5

## Purpose

Document the final HTTP transport modular architecture and extension rules so contributors can evolve route families without changing production behavior or violating architecture boundaries.

## Final Module Layout

Authoritative route metadata and registration:
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/*`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`

Transport composition and route-family registry:
- `src/infrastructure/transport/http-server/identity/composition/IdentityHttpTransportComposition.ts`
- `src/infrastructure/transport/http-server/identity/composition/RouteModuleRegistry.ts`
- `src/infrastructure/transport/http-server/identity/route-families/AuthoritativeIdentityRouteFamilyModules.ts`

Shared transport seams:
- middleware: `identity/middleware/*`
- DTO mappers: `identity/dto/*`
- request/response primitives: `identity/primitives/*`
- upgrade-boundary installer: `identity/composition/IdentityHttpUpgradeBoundary.ts`
- HTTP entrypoint composition surface: `identity/IdentityHttpServer.ts`

## Route-Family Registry Model

1. The host composes a deterministic `AuthoritativeApiRouteRegistrationPlan`.
2. `composeIdentityHttpTransport(...)` builds a `routeModuleRegistry`.
3. The registry performs first-match route-prefix resolution in registration order.
4. `IdentityHttpServer.ts` executes a modular handler when one exists for the matched `routeFamilyId`.
5. When a route family has no modular handler ownership, request handling continues through the canonical route implementations in `IdentityHttpServer.ts` without migration-specific fallback markers.

Current modular handler ownership (in `defaultRouteFamilyHandlers`) includes:
- `identity-auth`
- `workspace-invitations`
- `workspace-administration`
- `authorization-management`
- `storage-management`
- `asset-management`
- `image-asset-management`
- `audit-ledger`
- `execution-node-management`
- `deployment-policy-read`
- `deployment-policy-write`
- `security-secret-metadata`
- `security-certificate-operations`
- `node-trust`
- `run-submission`
- `run-read`
- `run-mutation`
- `run-execution-update`
- `image-run-api`

Current route families that are still implemented in `IdentityHttpServer.ts` inline handlers:
- `system-runtime`

## Middleware Composition Rules

For `/api/*` requests, preserve this order:
1. request metadata bootstrap (`resolveRequestCorrelationId`, `setResponseCorrelationHeaders`)
2. observability start and request timing
3. CORS gate (`evaluateApiCorsRequest`)
4. secure transport gate (`enforceApiSecureTransport`)
5. route-family resolution and modular dispatch
6. route-category auth/trust gates (`requireAuthenticatedSession`, `requireAuthenticatedWorkspaceSession`, `requireAuthenticatedNodeTransport`)
7. parse/validate and DTO mapping
8. backend API invocation
9. status translation (`IdentityHttpServerErrorTranslation.ts`)
10. response envelope emission (`writeJson` -> `normalizeSharedApiErrorEnvelope` + correlation injection)

Safety invariants:
- do not parse workspace context before authenticated-session resolution
- do not bypass node trust gates with workspace/session middleware
- do not bypass shared status/error translation in route-family handlers
- after failed gate checks, write response and return immediately

## DTO Mapping Seams

Transport DTO mapping belongs in `src/infrastructure/transport/http-server/identity/dto/*` and should:
- translate transport inputs into backend request DTOs
- keep route-family handlers focused on orchestration and gate sequencing
- avoid embedding business policy in mapper logic

Existing mapper seams:
- `AuditRouteDtoMapper.ts`
- `ExecutionNodeManagementRouteDtoMapper.ts`
- `RunRouteDtoMapper.ts`

## Upgrade Boundary Separation

WebSocket upgrade listener wiring is isolated in:
- `src/infrastructure/transport/http-server/identity/composition/IdentityHttpUpgradeBoundary.ts`

`IdentityHttpServer.ts` retains the authoritative `handleWebSocketUpgrade(...)` protocol/auth/trust flow, while boundary installation is handled by `installIdentityHttpUpgradeBoundary(...)`.

Keep this split:
- boundary module manages listener lifecycle (`on("upgrade")` / `off("upgrade")`)
- server module manages upgrade policy and protocol behavior

## Contributor Workflow: Add or Modify a Route Family

1. Add or update route-family metadata in `authoritative-route-families/*` (stable `routeFamilyId`, canonical prefixes, required backend keys).
2. Wire backend-key availability in `AuthoritativeApiRouteRegistrationCatalog.ts`.
3. Ensure module ownership entry exists in `AuthoritativeIdentityRouteFamilyModules.ts`.
4. Add/extend modular handler in `identity/route-families/*` and register in `defaultRouteFamilyHandlers` when extracting inline route-family handling.
5. Keep middleware order unchanged and use shared auth/trust gates.
6. Add/extend DTO mapper seams in `identity/dto/*`; do not push transport mapping into application/domain.
7. If startup requires this family, update required family coverage in `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`.

## Testing and Verification Expectations

Minimum regression coverage when changing route-family behavior:
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpTransportComposition.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRouteParityRegression.test.ts`
- route-family specific tests in `src/infrastructure/transport/http-server/identity/tests/*`
- `src/hosts/server/tests/AuthoritativeServerStartupHarness.test.ts`

Documentation and maintainability guardrails:
- `dev/tests/HttpTransportModularizationMaintainabilityGuardrails.test.ts`
- `dev/tests/HttpTransportModularizationModuleMapDocumentation.test.ts`

## Boundary Rules

- Keep transport concerns in `src/infrastructure/transport/http-server`.
- Keep business policy in `src/application` and `src/domain`.
- Keep host composition and required-family assertions in `src/hosts/server`.
- Keep shared contracts and schemas in `src/shared/contracts` and `src/shared/schemas`.

When adding transport behavior, keep policy decisions behind backend APIs; transport modules should only parse, enforce transport-level auth/trust gates, invoke backends, and map responses.
