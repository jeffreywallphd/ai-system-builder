# AI Companion: Run Persistence for Image Runs and Status History

## Story scope
Story 4.2.5 adds concrete authoritative persistence for image-manipulation run lifecycle state and durable status history so run state is queryable and audit-ready.

## Implemented files
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/PlatformPersistenceMapper.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
- Human doc: `docs/architecture/run-orchestration-image-run-persistence-and-status-history.md`

## Core behavior
- Run create/save operations continue to persist authoritative run records in `platform_run_records`.
- Adapter now records lifecycle transition history in `platform_run_status_history`.
- History rows include lifecycle + normalized status + revision + actor/time + safe failure/linkage metadata + snapshot JSON.
- History write behavior is replay-safe and aligned to authoritative run revision semantics.

## Migration posture
- Platform schema version is now `7`.
- Migration v7 creates `platform_run_status_history` with query-ready indexes and `(run_id, run_revision)` uniqueness.
- Existing persisted runs remain compatible; history recording begins for post-migration mutations.

## Boundary posture
- Domain and transport models remain persistence-agnostic.
- Mapping from storage rows to repository records remains in persistence mapper code.
- Persistence-specific schema details stay in infrastructure adapters and migrations.

## Test coverage
- Migration/table assertions updated for schema version `7` and new status-history table.
- Integration test verifies durable history append across run lifecycle transitions.
- Integration test verifies history query filters and ordering behavior.
