# Run Orchestration Dispatch Result Handling and Lifecycle Progression

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.5: Implement dispatch result handling and authoritative execution-state progression

## Purpose

Define the authoritative application workflow that handles backend dispatch outcomes and advances canonical run lifecycle state to running or failed-to-start outcomes without leaving ambiguous orchestration state.

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

## Authoritative dispatch result flow

1. Build canonical execution command for an assigned run.
1. Invoke backend dispatch adapter.
1. Always handle dispatch outcome through `HandleRunDispatchResultUseCase`:
   - ensure assigned runs are first transitioned to `dispatching`,
   - persist dispatch attempt result metadata,
   - transition to `running` for accepted dispatch or to `failed` for failed-to-start dispatch.
1. Emit lifecycle audit events for each authoritative state transition.

Dispatch errors are persisted before being rethrown so orchestration visibility remains authoritative.

## Failure posture and redaction

Failed starts persist both:

- user-safe failure fields (`safeCode`, `safeMessage`) for canonical execution state
- internal-safe failure diagnostics (`internalCode`, `internalMessage`, optional details) on dispatch-attempt result metadata

This keeps user-visible run state safe while preserving operator diagnostics for troubleshooting and retry policy evolution.

## Persistence additions

Dispatch attempts now include optional authoritative result metadata (`dispatch_result_json`) persisted in `platform_run_dispatch_attempts`.

Recorded attempt result statuses:

- `accepted`
- `failed-to-start`

Accepted results persist receipt metadata (dispatch id, backend run id, accepted timestamp). Failed starts persist safe and internal failure context.

## Lifecycle progression rules

- `assigned -> dispatching` when dispatch processing begins.
- `dispatching -> running` for accepted backend dispatch.
- `dispatching -> failed` for backend failed-to-start outcomes.

Failed starts are therefore distinguishable from in-progress (`running`) and terminal-success (`completed`) runs.

## Test coverage highlights

- state-transition helper tests for accepted and failed-to-start outcomes
- use-case tests for authoritative progression, attempt-result persistence, and lifecycle audit event emission
- dispatch use-case tests that verify failed backend dispatches are recorded before error propagation
- SQLite persistence test coverage for dispatch-attempt result recording and retrieval
