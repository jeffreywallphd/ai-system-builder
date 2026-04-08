# Run Authoritative Read API

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.6: Implement authoritative run reads for summaries, details, and lifecycle visibility

## Purpose

Provide production-grade authoritative run read paths for list/detail/status visibility so operational UI clients can observe run lifecycle state through canonical logical resources without exposing runtime adapter internals.

## Canonical implementation files

- `src/application/runs/use-cases/ListAuthoritativeRunsUseCase.ts`
- `src/application/runs/use-cases/GetAuthoritativeRunUseCase.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`

## Endpoints and contracts

Authoritative run read routes:

- `GET /api/v1/runtime/runs`
  - Workspace-scoped list reads with shared query conventions (`workspaceId`, `limit`, `offset`, `search`, `sortBy`, `sortDirection`)
  - Repeated filter keys:
    - `state=<run-lifecycle-state>` (repeatable)
    - `source=<run-submission-source>` (repeatable)
- `GET /api/v1/runtime/runs/:runId`
  - Canonical run detail read.
- `GET /api/v1/runtime/runs/:runId/status`
  - Canonical lifecycle/status envelope read.
- `GET /api/v1/runtime/queue`
  - Canonical operational queue visibility read projection for run-control surfaces.
- Image-monitoring aliases backed by the same authoritative query use cases:
  - `GET /api/v1/image-runs`
  - `GET /api/v1/image-runs/:runId`

Shared run transport contracts now include:

- `RunListReadRequest`
- `RunListReadResponse`
- `RunOrchestrationTransportRoutes.listRuns`

## Authorization and visibility posture

`AuthoritativeRunQueryBackendApi` enforces read visibility at the application layer:

1. Workspace boundary is required and enforced for list/detail/status reads.
2. Per-run policy evaluation uses canonical run resource tuple:
   - `resourceFamily`: `run`
   - `resourceType`: `authoritative-run`
   - `resourceId`: `<runId>`
3. List reads return only authorized runs.
4. Detail/status reads are non-leaky:
   - unauthorized reads return canonical `not-found`.

This supports ownership/sharing/workspace-visibility/role-based policy decisions through the existing authorization evaluator.

## Projection and redaction posture

Authoritative reads project canonical run resources only:

- list: `RunSummary`
- detail: `RunDetail`
- status: `RunStatusEnvelope`
- queue: `RunQueueStatusReadResponse`

Raw persistence metadata and runtime adapter internals are not returned.

## Route registration posture

Added backend key and route family coverage for authoritative run reads:

- backend key: `run-read`
- route family: `run-read`
- route prefix: `/api/v1/runtime/runs`

Authoritative server required route-family coverage now includes `run-read`.

## Validation and test coverage

- Application/use-case:
  - `src/application/runs/tests/ListAuthoritativeRunsUseCase.test.ts`
- Run query backend:
  - `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- HTTP transport:
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunReadApi.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerImageRunAuthoritativeApi.test.ts`
- Shared contracts/schemas:
  - `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
  - `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- Route registration:
  - `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
  - `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`

