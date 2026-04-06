# Logical Asset Persistence Contracts

This note documents Story 10.1.2 (Feature 10 / Epic 10.1): storage-aware persistence schema and repository adapters for logical assets.

## Canonical artifacts

- `src/application/assets/ports/IAssetRepository.ts`
- `src/application/assets/ports/index.ts`
- `src/infrastructure/persistence/assets/SqliteAssetPersistenceMigrations.ts`
- `src/infrastructure/persistence/assets/AssetPersistenceMapper.ts`
- `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- `src/infrastructure/persistence/assets/tests/AssetPersistenceMapper.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`

## Scope and intent

- Persist authoritative logical asset metadata independent from physical filesystem paths.
- Bind assets and versions to managed storage instances through logical references (`storage-instance://...` + object keys).
- Keep repository contracts in `src/application/assets/ports` separated from SQLite row/schema details.
- Support create/read/update/list persistence primitives for downstream protected asset use cases.
- Support lineage-oriented retrieval for generated/derived outputs.

## Persistence model summary

Schema includes:

- migration history in `asset_repository_migrations`
- canonical asset metadata in `asset_records`
- immutable version metadata in `asset_versions`
- lightweight lineage links in `asset_lineage_links`

`asset_records` captures:

- identity and ownership scope (`asset_id`, `workspace_id`, optional `owner_user_id`)
- managed storage binding (`storage_instance_id`, `storage_uri`)
- asset classification and policy posture (`kind`, `visibility`, sharing-policy refs)
- lifecycle posture (`active`/`archived`/`deleted` + archive/delete attribution)
- canonical version pointer (`current_version_id`)
- audit metadata (`created_*`, `last_modified_*`)

`asset_versions` captures:

- version identity and revision sequence
- storage object references (`object_key`, optional `object_version_id`, `storage_area`)
- content descriptors (`mime_type`, `size_bytes`, checksum fields, optional original filename)
- version attribution timestamps/actors

`asset_lineage_links` captures:

- derived/generated/preview/transformation relationships between assets
- optional source version specificity for output lineage queries

## Migration and schema posture

- Schema is versioned by `asset_repository_migrations` and currently pinned at version `1`.
- Migration SQL is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Check constraints enforce visibility-sharing coherence, lifecycle marker coherence, and non-negative revision/content sizes.
- Workspace and user retrieval paths are indexed (`workspace_id`, `owner_user_id`, `kind`, `visibility`, lifecycle, storage, lineage).

## Repository behavior

`SqliteAssetPersistenceAdapter` implements `IAssetRepository` with:

- lazy migration initialization with schema-version guardrails
- lookup by asset id (`findAssetById`)
- list semantics scoped by workspace/owner/storage/kind/visibility/lifecycle and lineage filters (`listAssets`)
- create and save mutation flows (`createAsset`, `saveAsset`)
- lineage replacement for derived/output relationships (`replaceAssetLineage`)
- stale-write conflict rejection when incoming `lastModifiedAt` is older than persisted state

## Domain mapping posture

`AssetPersistenceMapper` isolates persistence/domain conversion:

- table rows -> domain rehydration (`mapAssetRowsToDomain`)
- domain -> ordered row values for asset/version writes
- normalization/assertion helpers for lookup and lineage-relation values

This keeps persistence structures decoupled from domain/application contracts and prevents raw path leakage from database APIs.

## Test coverage

- `AssetPersistenceMapper.test.ts` validates row/domain conversions and row-value projection behavior.
- `SqliteAssetPersistenceAdapter.test.ts` validates:
  - migration application and idempotent reopen behavior,
  - create/read/save/list repository semantics,
  - workspace-owner and lineage retrieval,
  - stale-update conflict handling,
  - schema posture that avoids raw filesystem-path persistence columns.
