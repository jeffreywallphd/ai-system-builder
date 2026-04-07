# AI Companion: Run Authoritative Creation and Persistence Workflow

## Story scope
Story 16.1.4 adds the authoritative run creation workflow that persists accepted runs as durable platform state with initial orchestration intent and authoritative read support.

## Implemented files
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/GetAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/RunCreationPersistenceMapper.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- Human doc: `docs/architecture/run-authoritative-creation-persistence-workflow.md`

## Core behavior
- Converts validated run submission commands into canonical queued run state (`queued`).
- Persists the run as an authoritative platform record with canonical metadata snapshot.
- Persists durable queue admission for the run in the authoritative queue table.
- Stores actor/workspace scope, target references, validated parameters, references, and visibility posture.
- Records initial orchestration intent (`queue-admission-requested`) through the runs audit stream.
- Provides authoritative read reconstruction for run detail queries.

## Transaction model
- Create flow uses `runInTransactionBoundary(...)`.
- SQLite platform adapter now supports `IPlatformTransactionManager` using `SqliteTransactionCoordinator`.
- Run, queue-admission, and initial orchestration-intent writes can be committed or rolled back atomically in supported persistence.

## Metadata boundary
- Canonical run metadata contains orchestration-safe control-plane state only.
- Filesystem/runtime-adapter internal execution details are explicitly excluded from the canonical persisted run record.

## Test coverage
- `AuthoritativeRunCreationUseCase.test.ts`:
  - durable run metadata persistence
  - initial lifecycle consistency
  - authoritative read retrieval
  - transaction boundary invocation
- `RunCreationPersistenceMapper.test.ts`:
  - canonical/platform mapping round-trip
  - lifecycle/status mapping semantics
- `SqlitePlatformPersistenceAdapter.test.ts`:
  - rollback verification for transactional run + audit writes
