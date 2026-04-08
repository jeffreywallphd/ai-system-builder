# Run Persistence: Image Runs and Status History

## Story alignment

- Feature 4: Run Orchestration Integration for Image Systems
- Epic 4.2: Run Submission, Validation, and Queue Lifecycle Use Cases
- Story 4.2.5: Implement concrete persistence for image runs and status history

## Purpose

Provide durable, queryable authoritative persistence for image-manipulation runs and lifecycle/status history so orchestration state is audit-ready and can support future monitoring, node-assignment analysis, and result integration without storage redesign.

## Canonical implementation files

- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/PlatformPersistenceMapper.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Persistence structure

### Authoritative run records

`platform_run_records` remains the source-of-truth run aggregate table and continues to store:

- normalized platform status (`pending`, `running`, `completed`, `failed`, `cancelled`, `blocked`)
- tenancy scope (`workspace_id`, `user_identity_id`)
- source aggregate linkage
- metadata snapshot that includes canonical run orchestration state
- optimistic revision (`revision`) for concurrency safety

### Lifecycle/status history

`platform_run_status_history` is added to persist lifecycle transition history as first-class durable data.

Stored fields include:

- run identity and tenancy (`run_id`, `workspace_id`)
- canonical lifecycle state (`lifecycle_state`) and normalized platform status (`platform_status`)
- authoritative run revision linkage (`run_revision`) for deterministic ordering
- transition actor/time (`changed_by_actor_id`, `changed_at`)
- safe failure summary fields (`safe_failure_code`, `safe_failure_message`)
- execution linkage hints (`dispatch_attempt_id`, `dispatch_id`, `backend_kind`, `backend_run_id`)
- snapshot metadata (`snapshot_json`) for read-model and audit expansion seams

Indexes and constraints:

- `UNIQUE (run_id, run_revision)` to prevent duplicate history rows for a single authoritative revision
- history ordering indexes by run and time (`run_id`, `changed_at DESC`)
- workspace and lifecycle indexes for future history and operational querying
- foreign key to `platform_run_records(run_id)` with cascade delete

## Recording behavior

Status history recording is implemented in `SqlitePlatformPersistenceAdapter` as part of authoritative run create/save mutation handling:

1. Run write persists to `platform_run_records`.
2. Lifecycle transition detection compares prior vs next canonical lifecycle state (or status fallback).
3. On transition, adapter appends a history row in the same persistence pathway.
4. Mutation replay semantics still prevent duplicate writes for the same operation key.

This keeps persistence mapping and storage concerns inside infrastructure adapters and preserves clean boundaries with domain/application contracts.

## Migration impact

- Platform persistence schema version increases from `6` to `7`.
- Migration `v7` creates `platform_run_status_history` and related indexes.
- Existing run records remain valid; history collection starts from post-migration writes.

## Test coverage

`SqlitePlatformPersistenceAdapter.test.ts` covers:

- migration version and table creation for status history schema
- authoritative run lifecycle transitions recording durable history entries
- query filtering (`lifecycleStates`, `changedBefore`) and deterministic ordering
- persisted failure/linkage metadata capture in status-history rows
