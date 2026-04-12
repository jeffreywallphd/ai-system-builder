# Run Orchestration Terminal Finalization and Authoritative Result Registration

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.7: Implement completion/failure finalization and authoritative result registration

## Purpose

Finalize terminal `completed`, `failed`, and `cancelled` runs through an authoritative workflow that durably stores user-facing result metadata, preserves internal diagnostics separately, and releases queue/assignment orchestration state under server control.

## Implemented files

- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`

## Authoritative finalization flow

1. Execution updates, dispatch-result handling, or authoritative cancellation transitions runs into `completed`/`failed`/`cancelled` terminal lifecycle states.
2. `FinalizeRunExecutionOutcomeUseCase` enforces terminal finalization behavior:
   - releases active assignment state (`assigned -> released`) while preserving assignment history,
   - ensures queue history is explicitly dequeued in canonical run state,
   - registers user-facing terminal result metadata (including output-availability and terminal-quality hints) and links it to the run metadata envelope,
   - stores internal-only finalization diagnostics under `metadata.executionTelemetry`.
3. Queue persistence finalizes queue entries for terminal runs and clears active claim tokens/leases.
4. Updated canonical run + finalization metadata are persisted as authoritative run state.

## User-facing vs internal outcome split

User-facing outcome fields are exposed in canonical read surfaces:

- `RunDetail.finalization`
- `RunStatusEnvelope.finalization`

These include safe terminal summary, output references, optional external result id, and metrics.

Internal-only diagnostics remain separated in metadata telemetry:

- `metadata.executionTelemetry.lastInternalUpdate`
- `metadata.executionTelemetry.finalizationInternal`

This keeps run status/detail safe for standard consumers while retaining deeper operational context for governance and troubleshooting.

## Result registration and linking

Finalization metadata is persisted inside authoritative run metadata at:

- `metadata.orchestration.finalization`

This durable record is linked to `runId` and includes:

- terminal outcome (`completed`, `failed`, or `cancelled`)
- finalization timestamp
- safe summary
- output references (asset/storage/url/inline descriptors)
- optional external result id and metrics
- optional output-availability hint (`none`/`partial`/`available`/`degraded`)
- optional terminal-quality hint (`standard`/`partial`/`degraded`)

Result metadata therefore remains platform-owned state and no longer depends on scraping backend-local adapter artifacts.

## Queue and assignment release behavior

Queue finalization now updates queue rows to terminal lifecycle state and clears claim lease fields.

Assignment release for terminal completion/failure/cancellation is represented in canonical run state with explicit release timestamp/reason, preserving assignment lineage while removing active assignment ownership.

## Result persistence handoff seam

Terminal finalization records remain orchestration-owned and intentionally stop at normalized metadata registration. Downstream result persistence/lineage work must integrate through the explicit finalization registration seam (`IRunFinalizationResultRegistrationPort`) rather than embedding persistence logic in transport handlers, cancellation handlers, or adapter-specific execution code.

## Coverage highlights

- `IngestRunExecutionUpdateUseCase` tests now cover terminal completion and cancellation finalization with result-linking and hint projection.
- `HandleRunDispatchResultUseCase` tests now cover failed terminal finalization with assignment release and queue claim release.
- `RequestAuthoritativeRunCancellationUseCase` tests cover immediate cancelled-state finalization metadata projection.
- SQLite adapter tests now verify terminal queue finalization persistence.
- Transport schema tests now cover terminal result payload parsing and finalization envelope parsing.
