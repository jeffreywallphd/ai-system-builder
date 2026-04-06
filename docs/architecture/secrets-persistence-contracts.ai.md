# AI Companion: Secrets Persistence Contracts

## Purpose

Baseline for Story 8.1.2 plus Story 11.2.3: SQLite persistence plus protected repository wrapping for strongly protected secret metadata fields.

## Canonical files

- `src/application/security/ports/SecretServicePorts.ts`
- `src/domain/security/SecretDomain.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceMigrations.ts`
- `src/infrastructure/persistence/security/SecretRecordPersistenceMapper.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceAdapter.ts`
- `src/infrastructure/persistence/security/ProtectedSecretRecordPersistenceRepository.ts`
- `src/infrastructure/persistence/security/tests/SqliteSecretRecordPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/security/tests/ProtectedSecretRecordPersistenceRepository.test.ts`

## Core persistence boundaries

- secret metadata persistence (`secret_records`)
- secret version lineage persistence (`secret_versions`)
- encrypted value material persistence (`secret_version_material`)
- idempotent mutation replay persistence (`secret_record_mutation_replays`)
- protected metadata wrapping boundary (`ProtectedSecretRecordPersistenceRepository`)

## Schema posture

- migration table: `secret_record_repository_migrations`
- key lookup/index posture:
  - unique scope/key: `(scope_type, scope_id, machine_key_name)`
  - scope + status listing index
  - machine key + status listing index
  - active-version lookup index

## Security/data-handling posture

- Metadata and encrypted payload material are intentionally separated.
- Record rows store ownership, naming, lifecycle, and policy metadata.
- Version rows store lineage/state.
- Material rows store encrypted payload references/digests/byte-length + key-encryption-context JSON.
- No plaintext secret value storage is introduced by this slice.
- Story 11.2.3 additionally encrypts selected metadata fields (currently `metadata_description`) before they are persisted.

## Adapter semantics

- migrations applied lazily on first adapter use
- schema forward-version guardrail
- `operationKey` mutation replay semantics for create/save/delete
- create/fetch/list/update flows aligned to `ISecretRecordPersistenceRepository`
- `deleteSecret` is implemented as soft-delete status mutation, not hard row deletion
- protected wrapper decrypts on read to keep domain/application contracts unchanged

## Tests in this slice

- migration and table creation validation
- create + idempotent replay behavior
- fetch by id and by key/scope behavior
- list filtering and include-flag behavior
- version activation persistence (rotated record save)
- disable and soft-delete persistence behavior
- protected metadata field persistence + transparent read rehydration
