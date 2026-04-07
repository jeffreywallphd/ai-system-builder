# Run Orchestration Queue and Assignment-Ready Selection

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.1: Implement the persistent orchestration queue and assignment-ready run selection flow

## Purpose

Move accepted runs into durable queue state and expose an authoritative selection flow that returns reservation-claimed assignment-ready work items for dispatch orchestration.

## Implemented files

- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Durable queue model

The authoritative SQLite layer now includes `platform_run_orchestration_queue` with:

- queue identity and ordering metadata (`queue_id`, `entered_at`, `order_key`)
- eligibility markers and earliest eligibility time (`eligibility_marker`, `eligible_at`)
- reservation/claim state (`claim_token`, `claimed_by`, `claimed_at`, `claim_expires_at`)
- lifecycle coordination fields (`lifecycle_state`, `dequeued_at`, `updated_at`, `revision`)

Queue entries reference authoritative runs by `run_id` and are persisted independently from transient in-memory scheduling loops.

## Queue admission behavior

Authoritative run creation now:

1. creates the canonical run
2. transitions run lifecycle to `queued` with canonical queue state
3. persists the run record
4. persists queue admission in `platform_run_orchestration_queue`
5. appends orchestration intent audit

These writes occur inside one transaction boundary when the transaction manager is available.

## Assignment-ready selection behavior

`SelectAssignmentReadyRunsUseCase` performs authoritative selection through queue reservation claims:

- eligible rows are ordered by `eligible_at`, `order_key`, `entered_at`, `run_id`
- only rows marked `ready`, not dequeued, and not actively claimed are considered
- selected rows are atomically claimed with a generated `claim_token` and TTL-backed expiration
- selected queue items are joined to authoritative run records and returned as canonical run details

This gives orchestration services stable, repeatable assignment-ready work retrieval and conflict-safe claim semantics.

## Scope boundaries

- No node scoring or assignment policy sophistication is embedded in queue persistence.
- Queue persistence stores generic readiness/claim data only.
- Node-specific dispatch policy remains a higher-layer orchestration concern.
