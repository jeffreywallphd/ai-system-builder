# Storage Persistence Contracts

This note documents Story 9.2.1 (Feature 9 / Epic 9.2): durable persistence schema and repository implementation for managed storage instances.

## Canonical artifacts

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/domain/storage/StorageDomain.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceMigrations.ts`
- `src/infrastructure/persistence/storage/StorageInstancePersistenceMapper.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter.ts`
- `src/infrastructure/persistence/storage/tests/StorageInstancePersistenceMapper.test.ts`
- `src/infrastructure/persistence/storage/tests/SqliteStorageInstancePersistenceAdapter.test.ts`

## Scope and intent

- Persist authoritative storage-instance metadata as a first-class platform model.
- Keep storage repository behavior aligned to `IStorageInstanceRepository` without leaking table shape into business logic.
- Persist lifecycle, access, replication, policy metadata, ownership, and audit attribution fields.
- Preserve idempotent mutation replay semantics for repository create/save operations.

## Persistence model summary

Schema tracks:

- migration history in `storage_instance_repository_migrations`
- canonical managed storage records in `storage_instances`
- idempotent mutation replay envelopes in `storage_instance_mutation_replays`

`storage_instances` keeps normalized platform metadata for:

- identity and ownership (`storage_instance_id`, `workspace_id`, `owner_user_identity_id`)
- backend and lifecycle posture (`backend_type`, `lifecycle_state`)
- access contract (`access_mode`, `access_scope`)
- replication contract (`replication_mode`, `replica_storage_instance_id`, `sync_interval_seconds`)
- policy metadata (retention/size/security/lifecycle + encryption posture columns)
- explicit audit attribution (`created_*`, `last_modified_*`, `last_correlation_id`)
- backend/platform references (`backend_binding_reference_id`, `provisioning_reference_id`)

The persistence model intentionally does not use raw client filesystem paths as the primary storage contract.

## Migration and schema posture

- Schema is versioned through `storage_instance_repository_migrations` and currently pinned at version `1`.
- Migration SQL is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and safe for re-open/replay initialization.
- Check constraints enforce replication and policy-shape coherence at the database boundary.

## Repository behavior

`SqliteStorageInstancePersistenceAdapter` implements `IStorageInstanceRepository` with:

- lazy migration initialization with schema-version guardrails
- `findStorageInstanceById(...)` lookup by canonical storage id
- `listStorageInstances(...)` filterable query semantics (workspace/owner/id/backend/lifecycle/access + paging)
- `createStorageInstance(...)` and `saveStorageInstance(...)` with mutation replay idempotency by `operationKey`
- stale-write rejection when incoming `lastModifiedAt` is older than persisted state

## Domain mapping posture

`StorageInstancePersistenceMapper` provides explicit row/domain conversion:

- row -> domain via `createStorageInstance(...)` and enum assertion guards
- domain -> row-value projection with normalized booleans/JSON policy labels
- replay snapshot parsing that rehydrates back into canonical domain shape

This keeps persistence shape and domain shape intentionally separate while enforcing storage invariants at rehydration time.

## Test coverage

- `StorageInstancePersistenceMapper.test.ts` validates mapper conversions, replay parsing, and lookup normalization.
- `SqliteStorageInstancePersistenceAdapter.test.ts` validates:
  - migration application and idempotent re-initialization,
  - storage create/read/list/save behavior,
  - mutation replay semantics,
  - stale-update conflict handling,
  - and schema posture that avoids raw client-path primary modeling.
