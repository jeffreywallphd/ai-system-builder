# AI Companion: Run Authoritative Read API

## Story scope
Story 16.1.6 adds authoritative run read pathways for list/detail/status visibility with workspace and policy enforcement.

## Implemented files
- `src/application/runs/use-cases/ListAuthoritativeRunsUseCase.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Human doc: `docs/architecture/run-authoritative-read-api.md`

## Core behavior
- Adds canonical list endpoint contract: `GET /api/v1/runtime/runs`.
- Adds authoritative detail endpoint handling: `GET /api/v1/runtime/runs/:runId`.
- Adds authoritative lifecycle visibility handling: `GET /api/v1/runtime/runs/:runId/status`.
- Adds authoritative queue visibility handling: `GET /api/v1/runtime/queue`.
- Uses shared query conventions (`workspaceId`, `limit`, `offset`, `search`, `sortBy`, `sortDirection`) plus repeated `state` and `source` filters.

## Authorization posture
- Application-layer policy enforcement in `AuthoritativeRunQueryBackendApi`.
- Per-item list filtering and non-leaky detail/status reads.
- Resource tuple:
  - `resourceFamily`: `run`
  - `resourceType`: `authoritative-run`
  - `resourceId`: `<runId>`

## Response-shape posture
- List reads return canonical `RunSummary` projection only.
- Detail reads return canonical `RunDetail`.
- Status reads return canonical `RunStatusEnvelope`.
- Queue reads return canonical `RunQueueStatusReadResponse`.
- Internal persistence metadata/runtime internals are excluded.

## Route registration posture
- New authoritative backend key: `run-read`.
- New route family: `run-read`.
- Required authoritative server route-family coverage now includes `run-read`.

## Tests added/updated
- `src/application/runs/tests/ListAuthoritativeRunsUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunReadApi.test.ts`
- `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`

