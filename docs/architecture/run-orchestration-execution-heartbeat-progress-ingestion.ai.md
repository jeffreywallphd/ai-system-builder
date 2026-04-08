# AI Companion: Run Orchestration Execution Heartbeat and Progress Ingestion

## Story scope
Story 16.2.6 adds an authoritative node-ingested execution update pathway so heartbeat/progress signals advance durable run state and status visibility.
Story 8.2.3 extends this seam to tolerate duplicate terminal updates and preserve late terminal diagnostics without lifecycle regression.

## Implemented files
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
- `src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunExecutionUpdateBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunExecutionUpdateApi.test.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/domain/runs/RunDomain.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Core behavior
- Adds `POST /api/v1/runtime/runs/:runId/lifecycle` ingestion handling for node-authenticated execution updates.
- Requires sender/run legitimacy:
  - node transport authentication,
  - `senderNodeId` match to authenticated node transport identity,
  - run assignment ownership checks,
  - backend identity consistency checks (`adapterKind` / `adapterRunId`).
- Applies lifecycle + execution updates through canonical domain transition rules.
- Synchronizes normalized execution fields into authoritative run records with monotonic merge rules:
  - progress/heartbeat snapshots only move forward by timestamp,
  - stale or repeated snapshots become no-op lifecycle mutations (`changed=false`),
  - stale lifecycle transitions are ignored to avoid regressing durable run state.
- Story 8.2.3 terminal-stream hardening:
  - duplicate late terminal updates now return safe no-op mutations (instead of conflict rejection),
  - newer internal diagnostics on terminal runs are persisted as metadata-only updates while terminal lifecycle remains unchanged.

## Safe visibility split
- User-safe fields:
  - heartbeat timestamps,
  - execution progress (`percent`, `stage`, `message`, `updatedAt`),
  - canonical status/detail projections.
- Internal-only diagnostics:
  - persisted under `metadata.executionTelemetry.lastInternalUpdate`,
  - not surfaced in canonical run read/status contracts.

## Operational traceability
- Emits authoritative run audit event `run.execution-update.ingested` with bounded non-sensitive detail flags for state-changing ingestions.
- Keeps idempotent mutation keys for ingestion persistence flow.

## Route composition updates
- Added backend key: `run-execution-update`.
- Added route family: `run-execution-update`.
- Authoritative server required route-family coverage now includes run execution updates.

## Test coverage
- Domain tests for progress validation constraints.
- Schema/contract tests for lifecycle update progress/heartbeat fields.
- Use-case tests for accepted update ingestion and stale sender rejection.
- Use-case tests for stale progress synchronization behavior and repeated-update no-op behavior.
- Use-case tests for duplicate terminal no-op behavior and terminal diagnostics metadata persistence behavior.
- Backend API tests for success and shared error mapping.
- HTTP identity-server tests for node-authenticated execution update endpoint behavior.
