# AI Companion: Run Orchestration Authoritative Node Claim and Dispatch Preparation

## Story scope
Story 16.2.3 adds authoritative queued-run node claim handling and dispatch-preparation persistence, with conflict-safe semantics under concurrent orchestrator claims.

## Implemented files
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/tests/ClaimRunForNodeDispatchPreparationUseCase.test.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- Human doc: `docs/architecture/run-orchestration-node-claim-dispatch-preparation.md`

## Core delivery
- Adds an authoritative application use case (`ClaimRunForNodeDispatchPreparationUseCase`) to claim one queued run for one node.
- Persists canonical assignment transition (`assigned`) with assignment timestamps and queue dequeue timestamp.
- Adds durable dispatch-attempt persistence and query support in platform SQLite.
- Adds controlled conflict outcomes for duplicate or stale claims.

## Persistence additions
- Queue row now stores authoritative assignment/dispatch preparation fields:
  - `assignment_node_id`
  - `assignment_claimed_at`
  - `dispatch_prepared_at`
  - `last_dispatch_attempt_id`
- New table `platform_run_dispatch_attempts` stores durable dispatch-preparation attempt records.

## Conflict posture
- Controlled conflict reasons:
  - `not-found`
  - `already-assigned`
  - `queue-state-conflict`
  - `reservation-conflict`
- Node claim update uses conditional preconditions (claim token, owner, unexpired reservation, no prior assignment) to prevent duplicate assignment under concurrent attempts.

## Transport decoupling
- The workflow prepares and persists dispatch metadata only.
- No runtime/backend transport dispatch occurs in this story.
- Execution adapter invocation remains a separate orchestration layer concern.

## Coverage added
- Application tests for successful claim + duplicate-claim conflict behavior.
- SQLite tests for schema version update, durable dispatch-attempt records, and conflict-safe duplicate-claim prevention.
