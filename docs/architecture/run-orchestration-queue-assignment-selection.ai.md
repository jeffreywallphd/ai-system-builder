# AI Companion: Run Orchestration Queue and Assignment-Ready Selection

## Story scope
Story 16.2.1 introduces durable queue persistence and authoritative assignment-ready claim selection for accepted runs.

## Implemented files
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- Human doc: `docs/architecture/run-orchestration-queue-assignment-selection.md`

## Core delivery
- Adds a persistent orchestration queue table in authoritative SQLite persistence.
- Adds queue ordering, eligibility marker, and reservation/claim fields required for dispatch-ready selection.
- Updates run creation so accepted runs enter durable `queued` state and queue persistence atomically in one transaction boundary.
- Adds an application use case (`SelectAssignmentReadyRunsUseCase`) that claims assignment-ready work in deterministic order and returns canonical run details with claim metadata.

## Queue selection invariants
- Assignment-ready reads only consider queue rows that are:
  - `eligibility_marker = ready`
  - `eligible_at <= asOf`
  - not dequeued
  - not currently claimed (or claim expired)
- Claims are reservation-backed (`claim_token`, owner, claim timestamp, expiry) to prevent duplicate pickup by concurrent orchestrators.

## Boundary posture
- Queue persistence remains policy-neutral; it does not encode node-specific assignment logic.
- Node-scoring and scheduling policy evolution can be layered on top without schema rework.

## Coverage added
- Application tests assert:
  - accepted runs are queued durably in creation flow
  - assignment-ready selection honors ordering and eligibility markers
- SQLite tests assert:
  - queue table migration and durability
  - deterministic ready ordering
  - claim and release semantics
