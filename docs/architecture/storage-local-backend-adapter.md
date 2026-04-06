# Local Server-Managed Storage Backend Adapter

This note documents Story 9.2.2 (Feature 9 / Epic 9.2): the first concrete managed-storage backend adapter for local server-managed storage.

## Canonical artifacts

- `src/infrastructure/storage/local/ServerManagedLocalStorageBackendAdapter.ts`
- `src/infrastructure/storage/local/ServerManagedLocalStorageObjectAdapter.ts`
- `src/infrastructure/storage/local/index.ts`
- `src/infrastructure/storage/local/tests/ServerManagedLocalStorageBackendAdapter.test.ts`
- `src/infrastructure/storage/local/tests/ServerManagedLocalStorageObjectAdapter.test.ts`

## Scope and intent

- Implement a production-default backend adapter for managed local filesystem storage.
- Satisfy `IStorageProvisioningPort` and `IStorageCapabilityInspectionPort` with explicit, typed outcomes.
- Keep storage provisioning server-mediated and deterministic.
- Preserve backend abstraction seams for additional backend adapters.
- Implement logical object read/write/delete operations through managed storage contracts.

## Adapter behavior

`ServerManagedLocalStorageBackendAdapter` implements:

- `requestStorageProvisioning(...)`
  - supports `create`, `activate`, `deactivate`, and rejects `replication-sync` for local backend semantics.
  - emits explicit provisioning receipts with stable status + reason codes:
    - `local-backend-unsupported`
    - `local-binding-provisioned`
    - `local-binding-already-provisioned`
    - `local-binding-missing`
    - `local-binding-path-conflict`
    - `local-replication-unsupported`
    - `local-filesystem-failure`
- `inspectStorageBackendCapabilities(...)`
  - reports capability posture and typed backend health metadata (`status`, `reasonCode`, `checkedAt`) for the local managed backend.
- `inspectStorageInstanceCapabilities(...)`
  - reports instance binding-health posture (`healthy`, `missing`, `path-conflict`) plus binding reference metadata and typed health metadata for admin-safe diagnostics.

`ServerManagedLocalStorageObjectAdapter` implements:

- `createObjectKey(...)`
  - normalizes namespace/path segments + filenames and applies digest/time partition segments for deterministic logical keys.
- `writeObject(...)`
  - accepts buffer or async stream content, enforces storage policy size limits, and writes via server-managed directories only.
- `objectExists(...)`, `readObjectMetadata(...)`, `openObjectReadStream(...)`
  - provides logical key-based existence checks, metadata inspection, and stream reads.
- `deleteObject(...)`
  - safe delete semantics where missing objects return `deleted=false`.
- adapter-safe failure mapping
  - maps backend failures into `StorageObjectAccessError` with stable `storage-object-*` codes.

## Server-managed configuration model

The adapter is configured through typed infrastructure config (`LocalStorageBackendConfiguration`) instead of request-time arbitrary paths:

- required server-owned root (`managedStorageRootPath`)
- optional binding reference prefix
- optional managed subdirectory initialization policy
- optional capability/limit hints (`maxObjectBytesLimit`, cross-workspace/read-only flags)

Client-facing transport contracts continue to exclude raw filesystem path fields.

## Physical storage mediation

- Physical location is derived by the server from storage identity (`workspaceId`, `storageInstanceId`) into deterministic safe path segments.
- Storage provisioning always creates/checks directories relative to server-owned root.
- Managed subdirectories are initialized by infrastructure policy (default: `input`, `output`, `intermediate`).
- Filesystem access is abstracted behind `LocalStorageFilesystem` for deterministic failure-path testing and adapter portability.

## Operational assumptions

- Local adapter is authoritative only for `managed-filesystem` backend type.
- Replication sync is intentionally unsupported in this backend slice.
- Deactivation is lifecycle-only and does not delete local binding directories.
- Capability notes are metadata-oriented and avoid surfacing raw host filesystem paths through application contracts.
- Object operations are keyed by `StorageInstance` metadata + logical `objectKey`; callers never provide absolute/relative host paths.

## Test coverage

`ServerManagedLocalStorageBackendAdapter.test.ts` validates:

- managed local create provisioning success and directory initialization
- idempotent re-provision behavior (`already-applied`)
- unsupported backend rejection
- explicit filesystem failure mapping
- capability health inspection for missing vs provisioned bindings

`ServerManagedLocalStorageObjectAdapter.test.ts` validates:

- logical key generation with filename normalization and partitioning
- write/read flows for buffer and async stream content
- metadata and existence checks
- safe delete behavior
- application-safe error mapping for invalid keys, not-found reads, and unsupported backends
