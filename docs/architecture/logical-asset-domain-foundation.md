# Logical Asset Domain Foundation

This note documents Story 10.1.1 for Feature 10 / Epic 10.1: the foundational logical asset domain model for protected asset access.

## Scope

Implemented in this story:

- logical asset domain model in `src/domain/assets/AssetDomain.ts`
- domain-safe value objects and entities for:
  - `Asset`
  - `AssetId`
  - `AssetKind`
  - `AssetVersion`
  - `AssetLocationRef`
  - `StorageInstanceRef`
  - `ContentDescriptor`
  - `AssetOwnershipMetadata`
  - `AssetVisibility`
  - sharing policy references and lifecycle posture
- immutable construction and mutation APIs:
  - `createAssetId(...)`
  - `createStorageInstanceRef(...)`
  - `createAssetLocationRef(...)`
  - `createContentDescriptor(...)`
  - `createAssetOwnershipMetadata(...)`
  - `createAssetVersion(...)`
  - `createAsset(...)`
  - `rehydrateAsset(...)`
  - `addAssetVersion(...)`
  - `updateAssetVisibility(...)`
  - `transitionAssetLifecycle(...)`
- DTO projection/rehydration mirror in `src/shared/dto/assets/AssetDtos.ts`
- focused domain and DTO tests:
  - `src/domain/assets/tests/AssetDomain.test.ts`
  - `src/shared/dto/assets/tests/AssetDtos.test.ts`

Out of scope in this story:

- storage repository persistence adapters
- asset API/transport routes and schema adapters
- upload/download stream handlers
- direct authorization evaluator integration

## Canonical files

- `src/domain/assets/AssetDomain.ts`
- `src/domain/assets/tests/AssetDomain.test.ts`
- `src/shared/dto/assets/AssetDtos.ts`
- `src/shared/dto/assets/tests/AssetDtos.test.ts`

## Domain concepts

### Asset

`Asset` is a logical, storage-backed platform resource.

Canonical fields include:

- identity: `id`, `kind`
- ownership + attribution: `ownership.workspaceId`, optional `ownership.ownerUserId`, `createdBy`, `lastModifiedBy`, timestamps
- visibility + sharing posture: `visibility`, optional `sharingPolicyRef`
- storage binding: `storageBinding` as `storage-instance://` reference
- version chain: immutable `versions[]`, `currentVersionId`
- lifecycle posture: `active` | `archived` | `deleted` with timestamp/actor invariants

### StorageInstanceRef and AssetLocationRef

Asset location metadata is logical and storage-backed:

- `StorageInstanceRef` enforces `storage-instance://<id>` URI form
- `AssetLocationRef` stores logical object key and storage area metadata (`input`, `output`, `preview`, `reference`, `temporary`)
- no public raw filesystem path fields are exposed

### ContentDescriptor

Asset content metadata carries:

- `mimeType`
- `sizeBytes`
- `checksum.algorithm` + `checksum.digest`
- optional `originalFileName`

### Ownership and visibility model

Assets are always workspace-scoped and can be:

- user-private/workspace-scoped: `workspaceId` + `ownerUserId`
- workspace-owned: `workspaceId` + no `ownerUserId`

Visibility is explicit:

- `private`
- `workspace`
- `shared`
- `published`

Sharing policy references are externalized through `sharingPolicyRef`.

## Invariants enforced in domain code

- all required IDs/timestamps are normalized and validated
- `storageBinding` must be a canonical `storage-instance://` reference
- `AssetLocationRef.objectKey` rejects filesystem-style absolute/drive-prefixed/path-traversal values
- private visibility requires `ownerUserId`
- workspace-owned assets cannot be private
- `shared` and `published` visibility require `sharingPolicyRef`
- `private` and `workspace` visibility cannot carry `sharingPolicyRef`
- version chain invariants:
  - at least one version
  - unique version IDs
  - contiguous integer revisions starting at 1
  - `currentVersionId` must resolve to the latest revision
  - every version location must match the asset storage binding
- lifecycle invariants:
  - active assets cannot include archive/delete markers
  - archived assets require archive markers and cannot include delete markers
  - deleted assets require both archived and deleted markers
  - deleted timestamp cannot precede archived timestamp
- lifecycle transition map rejects invalid state transitions

## Boundary posture

This slice is domain-first and path-safe:

- domain model includes no filesystem, Electron, Express, transport, or adapter logic
- shared DTO mirror remains outside domain under `src/shared/dto/assets`
- higher layers consume logical asset IDs/references and storage-instance bindings, not local paths

This provides the canonical ownership/visibility/versioning foundation for future protected upload/download/preview/output operations.
