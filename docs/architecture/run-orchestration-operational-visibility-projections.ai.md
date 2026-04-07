# AI Companion: Run Orchestration Operational Visibility Projections

## Story scope
Story 16.3.3 adds authoritative operational read projections for run/queue control surfaces.

## Human doc
- `docs/architecture/run-orchestration-operational-visibility-projections.md`

## Implemented seams
- Projection and query services:
  - `src/application/runs/use-cases/RunOperationalVisibilityProjection.ts`
  - `src/application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase.ts`
- Shared contracts/schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Authoritative API + transport:
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Queue read support in persistence:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`

## Operational visibility additions
- Action eligibility (`cancel`/`retry`/`dequeue`) is derived from authoritative state.
- User-safe failure summary fields are projected for operational surfaces.
- Status timeline entries are projected from authoritative run state and run audit events.
- Authoritative queue read endpoint (`GET /api/v1/runtime/queue`) now supports run/queue control visibility projections.

## Safety posture
- Internal diagnostics remain internal metadata only.
- Operational projections expose safe summaries and control eligibility, not raw internal telemetry.
- Queue/run reads remain workspace-scoped and authorization-filtered.
