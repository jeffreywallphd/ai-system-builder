# Secrets Persistence Contracts

This note documents Story 8.1.2 (Feature 8 / Epic 8.1) and Story 11.2.3 (Feature 11 / Epic 11.2): durable secret persistence with protected metadata handling.

## Canonical artifacts

- `src/application/security/ports/SecretServicePorts.ts`
- `src/domain/security/SecretDomain.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceMigrations.ts`
- `src/infrastructure/persistence/security/SecretRecordPersistenceMapper.ts`
- `src/infrastructure/persistence/security/SqliteSecretRecordPersistenceAdapter.ts`
- `src/infrastructure/persistence/security/ProtectedSecretRecordPersistenceRepository.ts`
- `src/infrastructure/persistence/security/tests/SqliteSecretRecordPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/security/tests/ProtectedSecretRecordPersistenceRepository.test.ts`

## Scope and intent

- Persist canonical secret metadata with explicit scope ownership and lifecycle state.
- Persist version lineage metadata separately from encrypted payload material details.
- Provide repository behavior for create, fetch, list, metadata updates, version activation updates, and soft-delete semantics.
- Add query/index coverage for scope, machine-safe key lookup, and active/status-oriented listing.

## Persistence model summary

Schema tracks:

- migration history in `secret_record_repository_migrations`
- secret metadata in `secret_records`
- secret version lineage in `secret_versions`
- encrypted value material references/details in `secret_version_material`
- idempotent mutation replay envelopes in `secret_record_mutation_replays`

`secret_records` keeps ownership and metadata fields such as:

- `secret_id`
- `scope_type`, `scope_id`, `workspace_id`, `user_identity_id`
- `display_name`, `machine_key_name`
- `secret_kind`
- `created_by`, `last_modified_by`
- `created_at`, `updated_at`
- `status`, `active_version_id`
- lifecycle actor/timestamp columns (`disabled_*`, `revoked_*`, `deleted_*`)
- sensitivity marker projection (`sensitivity_markers_json`)

## Separation of metadata vs encrypted material

- `secret_records` stores metadata and policy envelope only.
- `secret_versions` stores version lineage/state metadata.
- `secret_version_material` stores encrypted payload locator + digest + byte-length + key-encryption-context JSON.
- Repository mapping reconstructs full `SecretRecord` domain objects from these related tables without flattening encrypted material into the metadata row.

Story 11.2.3 adds a protected repository boundary:

- `ProtectedSecretRecordPersistenceRepository` wraps `SqliteSecretRecordPersistenceAdapter`
- secret metadata description is encrypted before persistence and decrypted on reads/lists
- underlying SQLite schema and repository contracts remain unchanged

## Field-level protection rationale

- encrypted field: `metadata_description` (freeform secret metadata content)
- plaintext-by-design fields: `machine_key_name`, tags, labels, state/scope ownership columns for queryability and existing list/filter semantics

## Repository behavior

`SqliteSecretRecordPersistenceAdapter` implements `ISecretRecordPersistenceRepository` with:

- lazy migration initialization and schema-version guardrail
- create and save operations with mutation replay idempotency (`operationKey`)
- fetch by id
- fetch by normalized key name + scope owner
- list with scope/state/kind/tag filtering and paging
- soft-delete mutation (`deleteSecret`) that marks records deleted instead of hard deleting rows

`ProtectedSecretRecordPersistenceRepository` preserves the same application repository contract while enforcing metadata-at-rest protection on designated fields.

## Test coverage

`SqliteSecretRecordPersistenceAdapter.test.ts` validates:

- migration/table creation success
- create + replay semantics
- fetch by id and by key/scope
- list filtering behavior (tags, disabled/deleted visibility switches)
- version activation behavior via save of rotated records
- soft-delete semantics and replay behavior
