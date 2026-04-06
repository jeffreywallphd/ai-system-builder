# AI Companion: Logical Asset Persistence Contracts

## Purpose

Story 10.1.2 adds the storage-aware SQLite persistence foundation for logical assets in Feature 10 / Epic 10.1.

## Canonical files

- `src/application/assets/ports/IAssetRepository.ts`
- `src/application/assets/ports/index.ts`
- `src/infrastructure/persistence/assets/SqliteAssetPersistenceMigrations.ts`
- `src/infrastructure/persistence/assets/AssetPersistenceMapper.ts`
- `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- `src/infrastructure/persistence/assets/tests/AssetPersistenceMapper.test.ts`
- `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`

## What is persisted

- Logical asset identity, workspace ownership scope, optional user-private ownership.
- Storage-instance binding and logical object references for each version.
- Asset kind, visibility, sharing-policy references, and lifecycle markers.
- Content descriptors (mime/size/checksum/original filename) per revision.
- Lightweight lineage links for derived/generated output lookup.

## Adapter behavior

- Implements `IAssetRepository` with:
  - `findAssetById`
  - `listAssets`
  - `createAsset`
  - `saveAsset`
  - `replaceAssetLineage`
- Applies lazy SQLite migrations and guards unsupported schema versions.
- Rejects stale saves when persisted records have newer `lastModifiedAt` metadata.
- Supports lineage-aware listing via `sourceAssetId` and optional `sourceAssetVersionId` filters.

## Boundary posture

- Domain shape remains authoritative in `AssetDomain`; SQLite row shape is adapter-local.
- Mapper functions isolate row/domain conversions and normalize lookup values.
- Persistence contracts expose logical storage references and object keys only, not raw filesystem paths.

## Tests in this slice

- Mapper tests validate row-to-domain and domain-to-row conversion behavior.
- Adapter tests validate migration idempotency, create/read/save/list, lineage filtering, stale-write rejection, and path-safe schema posture.
