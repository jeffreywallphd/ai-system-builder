# AI Companion: Shared Mounted Storage Backend Adapter

## Purpose

Story 9.2.3 adds the managed shared/network-mounted storage backend adapter for `network-share` storage instances.

## Canonical files

- `src/infrastructure/storage/shared/ServerManagedSharedStorageBackendAdapter.ts`
- `src/infrastructure/storage/shared/index.ts`
- `src/infrastructure/storage/shared/tests/ServerManagedSharedStorageBackendAdapter.test.ts`

## What it implements

- `IStorageProvisioningPort` with explicit shared-binding validation for:
  - `create`
  - `activate`
  - `deactivate`
  - `replication-sync`
- `IStorageCapabilityInspectionPort` with:
  - backend-level capability posture for shared targets
  - instance-level target resolution and binding health notes

## Contract posture

- Shared targets are server-known infrastructure config, not caller-provided mount paths.
- Target selection is logical (`policy.labels[targetLabelKey]` or workspace default target mapping).
- Provisioning receipts use stable `shared-*` reason codes for explicit safe failures.
- Capability differences are returned as typed snapshot fields and structured notes.

## Operational assumptions

- Adapter supports only `network-share` backend type.
- Mount/remount orchestration is outside this slice; this adapter validates and binds configured targets.
- Read/write permission and compatibility checks are enforced before accepting binding operations.
- Host paths are not exposed through application-facing storage contracts.

## Verified by tests

`ServerManagedSharedStorageBackendAdapter.test.ts` covers success binding, target-resolution errors, missing path, permission-denied behavior, compatibility mismatch handling, and backend-support capability inspection.
