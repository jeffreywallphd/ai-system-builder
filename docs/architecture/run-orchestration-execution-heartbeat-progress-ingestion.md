# Run Orchestration Execution Heartbeat and Progress Ingestion

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.6: Implement execution heartbeat/progress ingestion and live run-state updates
- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.2: Application and Infrastructure Hardening for Validation and Recovery
- Story 8.2.3: Implement resilient run-dispatch and execution recovery behavior

## Purpose

Add an authoritative ingestion path for execution heartbeat/progress/lifecycle signals emitted by nodes so in-flight runs can be observed through server-owned state, without delegating run truth to backend-local state.

## Implemented files

- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
- `src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunExecutionUpdateBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunExecutionUpdateApi.test.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/domain/runs/RunDomain.ts`

## Authoritative ingestion flow

1. Node sends `POST /api/v1/runtime/runs/:runId/lifecycle` with canonical lifecycle-update contract fields for heartbeat/progress/execution signals.
2. Transport layer authenticates node identity via node transport gate and requires `senderNodeId` to match authenticated node.
3. Application use case verifies run existence, assigned-node ownership, non-terminal run state, and backend identity consistency.
4. Update is applied through canonical domain transition rules, including lifecycle transition legality and execution coherence.
5. User-safe execution progress and heartbeat are persisted on canonical run state.
6. Internal diagnostics are persisted separately in run metadata (`executionTelemetry.lastInternalUpdate`) and not surfaced in run read contracts.
7. Synchronization logic applies monotonic merge rules so stale or repeated progress/heartbeat/state updates do not regress authoritative run truth.
8. Run lifecycle update audit record is appended with non-sensitive ingestion metadata only when authoritative state changes.

Story 8.2.3 resilience extension:

- duplicate/late terminal lifecycle updates are now treated as safe no-op mutations instead of hard conflicts,
- terminal internal diagnostics can still be persisted (without lifecycle regression) so interrupted monitoring streams can deliver late recovery context.

## Validation and rejection posture

- Rejects malformed ingestion payloads at schema boundary.
- Rejects stale/invalid sender identity (node mismatch).
- Rejects adapter identity drift (`adapterKind`/`adapterRunId` mismatch).
- Defensively treats stale/duplicate execution snapshots as no-op mutations (`changed=false`) so imperfect streams do not churn revisions.
- Defensively ignores stale lifecycle transitions and retains current authoritative lifecycle state.
- Defensively accepts terminal duplicate updates as idempotent no-op responses and accepts terminal diagnostics updates as metadata-only persistence.

## Status visibility additions

- `RunStatusEnvelope` now includes optional execution live fields:
  - `execution.startedAt`
  - `execution.heartbeatAt`
  - `execution.finishedAt`
  - `execution.progress` (`updatedAt`, `percent`, `stage`, `message`)
- Canonical run detail execution state now persists/returns user-safe progress snapshots.

## Route registration and composition

- Added authoritative runtime route family: `run-execution-update`.
- Added backend key: `run-execution-update`.
- Authoritative server required route coverage now includes this family.

## Test coverage highlights

- Domain progress validation (`RunDomain.test.ts`).
- Schema/contract coverage for lifecycle update progress/heartbeat fields.
- Use-case coverage for accepted updates and sender-mismatch rejection.
- Use-case coverage for stale progress no-op behavior and repeated-update idempotency-like behavior.
- Use-case coverage for terminal duplicate-update no-op behavior and terminal diagnostics persistence without state regression.
- Backend API error mapping coverage.
- HTTP route coverage for node-authenticated ingestion and invalid sender rejection.
