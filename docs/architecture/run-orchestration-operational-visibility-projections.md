# Run Orchestration Operational Visibility Projections

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.3: Implement Operational Control, Recovery Behavior, and Cross-Surface Orchestration Visibility
- Story 16.3.3: Implement operational visibility endpoints and projections for queue/run control surfaces

## Purpose

Provide purpose-built authoritative read projections for operational surfaces so queue/run control UIs can consume queue position, assignment state, run status history, user-safe failure summaries, and action eligibility without reconstructing orchestration state from low-level persistence records.

## Canonical implementation map

- Shared contracts and schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Application projection/query services:
  - `src/application/runs/use-cases/RunOperationalVisibilityProjection.ts`
  - `src/application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase.ts`
- Authoritative read API:
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Queue persistence read support:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`

## Operational projection shape

The authoritative run projections now include:

- `actionAvailability`:
  - `cancel`
  - `retry`
  - `dequeue`
  - each action includes `allowed` + optional `reason`.
- `failureSummary`:
  - user-safe failure code/message + retryable flag.
- `statusTimeline`:
  - lifecycle timeline entries (`occurredAt`, `state`, `source`, optional `message`).

Queue visibility projections (`GET /api/v1/runtime/queue`) now return queue-focused run rows with:

- authoritative queue position
- queue timing metadata
- run state + assignment/execution summaries
- action availability + failure summary

## User-safe vs internal diagnostics posture

- User-facing operational reads expose only safe run/failure fields and action eligibility.
- Internal diagnostics remain in internal run metadata telemetry and are not surfaced through run list/detail/status/queue projections.
- Status timelines are built from authoritative run state plus audit events, without exposing raw internal diagnostic payloads.

## Endpoint posture

- `GET /api/v1/runtime/runs`
  - canonical list visibility with operational action/failure summaries.
- `GET /api/v1/runtime/runs/:runId`
  - canonical detail + operational status timeline.
- `GET /api/v1/runtime/runs/:runId/status`
  - canonical status envelope + operational status timeline.
- `GET /api/v1/runtime/queue`
  - queue visibility projection purpose-built for operational queue surfaces.

## Invariants

- Action eligibility must be derived from authoritative lifecycle/queue state only.
- Queue position must be derived from authoritative queue ordering, not client-side reconstruction.
- Internal diagnostics must not leak into user-facing operational projection fields.
- Run/queue reads remain workspace-scoped and policy-evaluated through existing authorization seams.

## Validation and regression coverage

- `src/application/runs/tests/ListAuthoritativeRunQueueStatusUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunReadApi.test.ts`
- `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
