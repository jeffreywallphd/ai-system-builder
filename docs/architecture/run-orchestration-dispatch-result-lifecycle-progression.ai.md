# AI Companion: Run Orchestration Dispatch Result Handling and Lifecycle Progression

## Story scope
Story 16.2.5 adds authoritative handling for backend dispatch outcomes so assigned runs progress deterministically into `running` or failed-to-start terminal outcomes with persisted attempt diagnostics.

## Implemented files
- `src/application/runs/use-cases/RunDispatchResultStateTransitions.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/tests/RunDispatchResultStateTransitions.test.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`
- `src/application/runs/tests/DispatchAssignedRunExecutionUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- Human doc: `docs/architecture/run-orchestration-dispatch-result-lifecycle-progression.md`

## Core behavior
- Dispatch success/failure handling is now authoritative and persisted.
- Backend dispatch execution always routes outcome handling through `HandleRunDispatchResultUseCase`.
- Dispatch lifecycle now progresses:
  - `assigned -> dispatching`,
  - `dispatching -> running` on accepted receipts,
  - `dispatching -> failed` on failed-to-start outcomes.

## Attempt metadata persistence
- Dispatch attempts now store optional `dispatchResult` metadata.
- SQLite schema adds `dispatch_result_json` in `platform_run_dispatch_attempts`.
- Stored result statuses:
  - `accepted`
  - `failed-to-start`

## Failure reason posture
- Canonical run execution failures use user-safe fields (`safeCode`, `safeMessage`).
- Dispatch-attempt result metadata stores internal-safe diagnostics (`internalCode`, `internalMessage`, optional details, retryable hint).
- Backend adapter failures are persisted before dispatch errors are rethrown.

## Operational visibility
- Lifecycle transition events are emitted as runs audit records for dispatch-result progression.
- Persisted run projections now include `startedAt`, `completedAt`, and `terminalReason` derived from canonical execution state.

## Tests added/updated
- Transition helper unit coverage for accepted and failed-to-start flows.
- Dispatch-result use-case tests for authoritative progression and result persistence.
- Dispatch use-case tests for failure-path persistence behavior.
- SQLite adapter test coverage for recording and reading dispatch-attempt results.
