# Run Orchestration Dispatch Result Handling and Lifecycle Progression

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.5: Implement dispatch result handling and authoritative execution-state progression
- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.2: Application and Infrastructure Hardening for Validation and Recovery
- Story 8.2.3: Implement resilient run-dispatch and execution recovery behavior

## Purpose

Define the authoritative application workflow that handles backend dispatch outcomes and advances canonical run lifecycle state to running or failed-to-start outcomes without leaving ambiguous orchestration state.

## Implemented files

- `src/application/runs/use-cases/RunDispatchResultStateTransitions.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/tests/RunDispatchResultStateTransitions.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/application/runs/tests/DispatchAssignedRunExecutionUseCase.test.ts`
- `src/application/runs/tests/ProcessQueuedRunDispatchUseCase.integration.test.ts`
- `src/infrastructure/execution/runs/RunExecutionDispatchFailure.ts`
- `src/infrastructure/execution/runs/RemoteRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/runs/LocalWorkerRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/tests/RunExecutionDispatchAdapters.contract.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Authoritative dispatch result flow

1. Build canonical execution command for an assigned run.
1. Invoke backend dispatch adapter.
1. Always handle dispatch outcome through `HandleRunDispatchResultUseCase`:
   - ensure assigned runs are first transitioned to `dispatching`,
   - persist dispatch attempt result metadata,
   - apply dispatch-outcome queue-settlement policy:
     - accepted dispatch transitions to `running` and releases reservation claim ownership,
     - retryable failed-to-start outcomes may be requeued for scheduler re-evaluation when retry budget remains,
     - remaining failed-to-start outcomes finalize to terminal `failed`.
1. Emit lifecycle audit events for each authoritative state transition.

Dispatch errors are persisted before being rethrown so orchestration visibility remains authoritative.

Story 8.2.3 extends this flow with explicit resilience policy:

- dispatch failure normalization now preserves structured recovery guidance (`details.recovery`) when available,
- automatic failed-start requeue is only allowed when recovery guidance explicitly indicates automatic retry (`retryMode=automatic`, retry eligible, retry safe),
- retryable hints without automatic-mode recovery fall back to terminal finalization, preventing hidden retry heuristics.

## Failure posture and redaction

Failed starts persist both:

- user-safe failure fields (`safeCode`, `safeMessage`) for canonical execution state
- internal-safe failure diagnostics (`internalCode`, `internalMessage`, optional details) on dispatch-attempt result metadata

For Story 8.2.3, dispatch-attempt details also preserve recovery metadata derived from Feature 8.1 retry/recovery contracts whenever available, making retry vs non-retry decisions durable and inspectable after interruption/restart.

This keeps user-visible run state safe while preserving operator diagnostics for troubleshooting and retry policy evolution.

## Persistence additions

Dispatch attempts now include optional authoritative result metadata (`dispatch_result_json`) persisted in `platform_run_dispatch_attempts`.

Recorded attempt result statuses:

- `accepted`
- `failed-to-start`

Accepted results persist receipt metadata (dispatch id, backend run id, accepted timestamp). Failed starts persist safe and internal failure context.

## Lifecycle progression rules

- `assigned -> dispatching` when dispatch processing begins.
- `dispatching -> running` for accepted backend dispatch, with queue reservation settlement.
- `dispatching -> queued` (via retry-pending progression) for retryable failed-to-start outcomes when guarded requeue conditions are met.
- `dispatching -> failed` for backend failed-to-start outcomes that are not requeue-eligible.

Failed starts are therefore distinguishable between scheduler-requeueable and terminal-failed outcomes, while accepted dispatch still progresses deterministically to in-progress (`running`) state.

## Resilient node freshness guard (Story 8.2.3)

`ProcessQueuedRunDispatchUseCase` now applies explicit node freshness constraints through run-node selection requirements (`maxLastSeenAgeMs`), so stale node heartbeat/state snapshots are treated as transient availability blockers instead of being silently dispatched.

Default behavior uses a bounded freshness window and allows explicit override per dispatch request.

## Test coverage highlights

- state-transition helper tests for accepted and failed-to-start outcomes
- use-case tests for authoritative progression, attempt-result persistence, and lifecycle audit event emission
- dispatch use-case tests that verify failed backend dispatches are recorded before error propagation
- SQLite persistence test coverage for dispatch-attempt result recording and retrieval

## Adapter-backed integration regression coverage (Feature 4 / Epic 4.3 / Story 4.3.5)

Authoritative image-run orchestration now includes integration coverage that exercises the orchestration path through the ComfyUI execution-adapter boundary instead of direct studio-to-backend coupling:

- `src/application/runs/tests/RunOrchestrationAdapterBackedExecution.integration.test.ts`

Covered scenarios:

- validated image submission -> authoritative queue admission -> assignment claim -> adapter-routed dispatch -> progress ingestion -> completed finalization
- adapter dispatch start failure (`failed-to-start`) with authoritative terminal failure persistence and safe failure summary/history capture
- duplicate-dispatch guard behavior (`dispatchAttemptAlreadyFinalized`) after dispatch-attempt finalization
- running/cancelling cancellation workflow with backend cancellation signaling and terminal `cancelled` ingestion/finalization

These integration tests assert authoritative run records, queue entries, and durable status-history records as the source of truth rather than backend-local adapter state.
