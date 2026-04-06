# AI Companion: Storage Persistence Contracts

## Purpose

Story 9.2.1 adds the production-ready persistence foundation for managed storage instances under Feature 9 / Epic 9.2.

## Canonical files

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceMigrations.ts`
- `src/infrastructure/persistence/storage/StorageInstancePersistenceMapper.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter.ts`
- `src/infrastructure/persistence/storage/tests/StorageInstancePersistenceMapper.test.ts`
- `src/infrastructure/persistence/storage/tests/SqliteStorageInstancePersistenceAdapter.test.ts`

## What is persisted

- Storage identity, ownership, backend type, and lifecycle state.
- Access mode/scope and replication policy metadata.
- Storage policy metadata with explicit security and lifecycle fields.
- Audit-friendly attribution fields (`createdBy/At`, `lastModifiedBy/At`, `lastCorrelationId`).
- Backend binding/provisioning references as platform-owned metadata.

## Adapter behavior

- Implements `IStorageInstanceRepository` for find/list/create/save operations.
- Applies SQLite schema migrations lazily and enforces a schema version cap.
- Supports idempotent mutation replay keyed by `operationKey`.
- Rejects stale writes when incoming updates are older than persisted records.

## Boundary posture

- Domain mapping is explicit through a dedicated mapper layer.
- Storage business logic does not depend on SQLite row shapes.
- Persistence model is storage-instance-centric and avoids raw client path contracts as primary storage identity.

## Tests in this slice

- Mapper tests for row/domain conversion and replay parsing.
- Repository tests for migration idempotency, CRUD/list behavior, replay semantics, and stale-write conflicts.
