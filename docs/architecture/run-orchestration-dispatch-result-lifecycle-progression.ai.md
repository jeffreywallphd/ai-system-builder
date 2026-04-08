# AI Companion: Run Orchestration Dispatch Result Handling and Lifecycle Progression

## Story scope
Story 16.2.5 adds authoritative handling for backend dispatch outcomes so assigned runs progress deterministically into `running` or failed-to-start terminal outcomes with persisted attempt diagnostics.
Story 8.2.3 extends this seam with resilient dispatch failure normalization, explicit automatic-retry gating, and stale-node dispatch freshness handling.

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
- Human doc: `docs/architecture/run-orchestration-dispatch-result-lifecycle-progression.md`

## Core behavior
- Dispatch success/failure handling is now authoritative, persisted, and queue-settlement aware.
- Backend dispatch execution always routes outcome handling through `HandleRunDispatchResultUseCase`.
- Dispatch lifecycle now progresses:
  - `assigned -> dispatching`,
  - `dispatching -> running` on accepted receipts with reservation release,
  - `dispatching -> queued` (via retry-pending progression) for retryable failed-to-start requeue,
  - `dispatching -> failed` on non-requeue failed-to-start outcomes.
- Story 8.2.3 refinement:
  - failed-start requeue is now gated by explicit recovery policy (`details.recovery.retry.retryMode=automatic` + retry eligible/safe),
  - terminal fallback is explicit when recovery policy is manual/non-retryable/absent,
  - dispatch failure normalization carries durable recovery metadata into attempt results.

## Attempt metadata persistence
- Dispatch attempts now store optional `dispatchResult` metadata.
- SQLite schema adds `dispatch_result_json` in `platform_run_dispatch_attempts`.
- Stored result statuses:
  - `accepted`
  - `failed-to-start`
- `failed-to-start` details may now include Feature 8.1 retry/recovery guidance for durable retry decision traceability.

## Failure reason posture
- Canonical run execution failures use user-safe fields (`safeCode`, `safeMessage`).
- Dispatch-attempt result metadata stores internal-safe diagnostics (`internalCode`, `internalMessage`, optional details, retryable hint).
- Backend adapter failures are persisted before dispatch errors are rethrown.
- Remote and local dispatch adapters now normalize timeout/connectivity/capacity failures into explicit retryable dispatch adapter errors before rethrow.

## Operational visibility
- Lifecycle transition events are emitted as runs audit records for dispatch-result progression.
- Persisted run projections now include `startedAt`, `completedAt`, and `terminalReason` derived from canonical execution state.

## Tests added/updated
- Transition helper unit coverage for accepted and failed-to-start flows.
- Dispatch-result use-case tests for authoritative progression and result persistence.
- Dispatch use-case tests for failure-path persistence behavior.
- SQLite adapter test coverage for recording and reading dispatch-attempt results.
- Added dispatch adapter contract coverage for retryable timeout normalization.
- Added integration coverage for stale-node freshness no-selection outcomes in queued dispatch processing.

## Story 4.3.5 integration coverage extension
- Added adapter-backed orchestration integration regression coverage:
  - `src/application/runs/tests/RunOrchestrationAdapterBackedExecution.integration.test.ts`
- Coverage now exercises:
  - validated image submission through queue/assignment/dispatch/progress/completion using the ComfyUI dispatch adapter seam,
  - dispatch start failure and authoritative failed finalization with safe failure history,
  - duplicate-dispatch guard (`dispatchAttemptAlreadyFinalized`) after attempt finalization,
  - cancellation request + backend signaling + terminal cancelled ingestion/finalization.
- Assertions target authoritative run records, queue rows, and durable run status history so orchestration state remains the source of truth over backend-local state.
