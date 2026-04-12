# Execution-Node Management and Readiness Authoritative APIs

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.4: API, Operational UX, Audit, and Feature-Readiness Verification
- Story 5.4.1: Implement authoritative API endpoints for execution-node management and readiness
- Story 5.4.3: Integrate audit events for execution-node management and assignment actions

## Purpose

Expose authoritative HTTP endpoints for execution-node inventory, availability control, readiness, eligibility, and backend-availability visibility so desktop surfaces and future thin-client/admin surfaces rely on control-plane APIs instead of direct backend probing.

## Implemented files

- `src/infrastructure/api/nodes/sdk/PublicExecutionNodeManagementApiContract.ts`
- `src/infrastructure/api/nodes/ExecutionNodeManagementBackendApi.ts`
- `src/infrastructure/api/nodes/tests/ExecutionNodeManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerExecutionNodeManagement.test.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/ExecutionNodeManagementAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuditPorts.ts`
- `src/infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink.ts`

## Authoritative endpoint surface

- `GET /api/v1/execution-nodes`: list execution nodes with normalized inventory filters
- `GET /api/v1/execution-nodes/:nodeId`: retrieve execution-node detail
- `POST /api/v1/execution-nodes/:nodeId/availability`: set administrative availability override (`enable|disable|suppress`)
- `GET /api/v1/execution-nodes/readiness`: compute readiness summary for execution requirements
- `GET /api/v1/execution-nodes/eligibility`: evaluate candidate eligibility for execution requirements
- `GET /api/v1/execution-nodes/backends/availability`: aggregate backend-family availability posture from node capabilities/readiness

## Boundary and behavior notes

- HTTP handlers remain thin and only perform authentication, request parsing, and response/status mapping.
- Business behavior delegates to application-layer use cases and eligibility services through `ExecutionNodeManagementBackendApi`.
- Responses use stable DTO projections from shared contracts and avoid leaking adapter internals or protected references.
- Actor identity is always sourced from authenticated session context at the transport boundary (payload spoofing is ignored).
- Execution-node management and run-node-selection services now emit best-effort audit events at application boundaries.
- Audit detail redaction removes sensitive connection/configuration fields (endpoint/config/URL/URI/token/credential style keys) before sink publication.
- Audited management/readiness actions include node registration, node activation, availability override updates, backend-state refresh, and node-selection evaluation outcomes.

## Route-family and host integration

- Added authoritative route family id: `execution-node-management`.
- Added backend availability key: `execution-node-management`.
- Authoritative server route-composition coverage now requires this family.
- Server host composition wires execution-node repository-backed use cases and exposes the backend API to `IdentityHttpServer`.

## Test coverage added

- Backend API tests for list/get, availability override, readiness/eligibility, backend availability, and validation error mapping.
- HTTP integration tests for authentication guards, query/body parsing, normalized request delegation, mutation behavior, and not-found mapping.
- Route-registration catalog tests for execution-node-management route-family availability.
- Node management audit port tests for redaction and best-effort behavior.
- Use-case tests validating audit emission for registration/activation, availability override, backend refresh, and selection decisions.
- Authoritative audit adapter integration tests validating canonical action mapping and redacted execution-node details.
