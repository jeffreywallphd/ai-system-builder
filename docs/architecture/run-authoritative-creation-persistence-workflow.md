# Run Authoritative Creation and Persistence Workflow

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.4: Build the authoritative run creation and persistence workflow

## Purpose

Establish a production-oriented application workflow that converts an accepted run submission command into durable authoritative platform state, records initial orchestration intent, and supports authoritative reads for API/UI consumers.

## Canonical implementation files

- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/GetAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/RunCreationPersistenceMapper.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Application workflow

`CreateAuthoritativeRunUseCase` accepts a validated `CanonicalRunSubmissionCommand` and:

1. Creates the initial canonical run record and transitions it to canonical `queued` state.
2. Assigns initial orchestration intent (`queue-admission-requested`) with queue routing context.
3. Maps canonical run + submission snapshot into authoritative persisted metadata.
4. Persists the run record durably via `IPlatformRunRecordRepository`.
5. Persists queue admission durably via `IRunOrchestrationQueuePersistenceRepository`.
6. Records the initial orchestration intent via `IPlatformAuditEventRepository`.
7. Performs authoritative read-after-write and returns canonical run detail for consumers.

`GetAuthoritativeRunUseCase` provides authoritative reads by run id (with optional workspace scoping).

## Persisted metadata posture

The durable run record includes production-relevant metadata:

- actor context (user/service identity and submission context)
- workspace scope and tenancy
- target references (`systemId`, `versionId`, optional workflow/template references)
- validated parameter snapshot
- storage/resource/security reference snapshot
- visibility/sharing posture (workspace scoped)
- initial orchestration state and queue intent
- canonical run snapshot for authoritative reconstruction

Execution-backend mechanics (filesystem locations, adapter-specific runtime internals) remain outside the canonical run record.

## Transaction safety

Run creation and initial orchestration-intent persistence execute under `runInTransactionBoundary`.
`SqlitePlatformPersistenceAdapter` now implements `IPlatformTransactionManager` using `SqliteTransactionCoordinator`, enabling atomic run + queue-admission + audit-intent writes in the supported SQLite layer.

## Validation coverage

- Run creation use-case tests verify:
  - durable canonical metadata persistence
  - consistent initial lifecycle state
  - authoritative read retrieval
  - transaction boundary invocation
- Mapper tests verify canonical/platform mapping and lifecycle/status mapping semantics.
- SQLite adapter test verifies transaction rollback behavior for run + audit persistence.
