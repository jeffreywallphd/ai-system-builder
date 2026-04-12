# AI Companion: Execution-Node Management and Readiness Authoritative APIs

## Scope

- Feature 5 / Epic 5.4 / Story 5.4.1
- Story 5.4.3 audit integration for execution-node management and assignment-readiness actions.
- Authoritative control-plane HTTP endpoints for execution-node management/readiness.

## What was added

- New authoritative backend API contract for execution-node management:
  - `src/infrastructure/api/nodes/sdk/PublicExecutionNodeManagementApiContract.ts`
- New backend API adapter that delegates to application use cases:
  - `src/infrastructure/api/nodes/ExecutionNodeManagementBackendApi.ts`
- Identity HTTP transport routes for:
  - list/get nodes
  - availability override mutation
  - readiness/eligibility checks
  - backend availability summaries
- New route family + registration key:
  - `execution-node-management`
- New execution-node management audit event contract and best-effort publisher:
  - `src/application/nodes/ports/ExecutionNodeManagementAuditPorts.ts`
- New authoritative audit adapter for execution-node management and selection-governance events:
  - `src/infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink.ts`
- Host composition now wires execution-node management + selection services to authoritative audit recording:
  - `src/hosts/server/IdentityServerHost.ts`

## Endpoint contracts (authoritative)

- `GET /api/v1/execution-nodes`
- `GET /api/v1/execution-nodes/:nodeId`
- `POST /api/v1/execution-nodes/:nodeId/availability`
- `GET /api/v1/execution-nodes/readiness`
- `GET /api/v1/execution-nodes/eligibility`
- `GET /api/v1/execution-nodes/backends/availability`

## Boundary rules enforced

- Controllers/handlers remain thin (auth + parsing + status translation only).
- All management/readiness logic routes through use-case services in backend API.
- Session principal identity is authoritative; payload actor/node spoof fields are ignored.
- Responses are normalized DTOs; no raw adapter internals are exposed.
- Audit emission happens in application/use-case services (node registration/activation, availability override, backend-state refresh, node-selection evaluation), not in UI transport handlers.
- Sensitive connection/configuration details are redacted before audit sink publication.

## Composition integration

- `IdentityServerHost` now wires execution-node repository use cases into `ExecutionNodeManagementBackendApi`.
- `IdentityHttpServer` receives `executionNodeManagementBackendApi` and advertises backend availability for route registration.
- Authoritative route composition now requires `execution-node-management` family coverage.

## Tests added/updated

- `src/infrastructure/api/nodes/tests/ExecutionNodeManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerExecutionNodeManagement.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementAuditPorts.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementUseCases.test.ts`
- `src/application/nodes/tests/SetExecutionNodeAvailabilityOverrideUseCase.test.ts`
- `src/application/nodes/tests/RefreshExecutionNodeBackendStateUseCase.test.ts`
- `src/application/nodes/tests/ImageRunExecutionNodeSelectionService.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
