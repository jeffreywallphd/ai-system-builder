# AI Companion: Local Server-Managed Storage Backend Adapter

## Purpose

Story 9.2.2 introduces the first concrete managed storage backend adapter for local server-managed storage, aligned to the storage provisioning and capability inspection ports.
Story 10.1.4 extends this slice with logical object read/write operations for managed asset content.

## Canonical files

- `src/infrastructure/storage/local/ServerManagedLocalStorageBackendAdapter.ts`
- `src/infrastructure/storage/local/ServerManagedLocalStorageObjectAdapter.ts`
- `src/infrastructure/storage/local/index.ts`
- `src/infrastructure/storage/local/tests/ServerManagedLocalStorageBackendAdapter.test.ts`
- `src/infrastructure/storage/local/tests/ServerManagedLocalStorageObjectAdapter.test.ts`

## What it implements

- `IStorageProvisioningPort` with explicit operation receipts for:
  - `create`
  - `activate`
  - `deactivate`
  - `replication-sync` (explicitly rejected for local backend)
- `IStorageCapabilityInspectionPort` with:
  - backend capability snapshots
  - typed backend/instance health metadata (`status`, `reasonCode`, `checkedAt`)
  - instance-level health notes for binding presence/path conflicts
- `IStorageObjectPort` with:
  - logical key generation
  - buffer/stream writes
  - existence + metadata reads
  - read stream retrieval
  - safe delete behavior
  - application-safe adapter error mapping

## Contract posture

- Provisioning outcomes use stable reason codes (`local-*`) rather than implicit exceptions.
- Backend config is typed and server-owned (`LocalStorageBackendConfiguration`), not caller-supplied path payloads.
- Local filesystem placement is deterministic and derived from storage identity.
- No raw filesystem path fields are introduced into storage transport/application contracts.

## Operational assumptions

- Adapter supports only `managed-filesystem` storage backend type.
- Local backend does not provide replication-sync operations in this slice.
- Deactivation does not delete provisioned directories; lifecycle transitions remain application-driven.
- Capability notes expose health/metadata posture while avoiding direct host-path leakage.
- Object operations are keyed by storage instance metadata and logical object keys, never caller-supplied host paths.

## Verified by tests

`ServerManagedLocalStorageBackendAdapter.test.ts` covers success, idempotency, unsupported backend rejection, filesystem failure mapping, and binding-health capability inspection.
`ServerManagedLocalStorageObjectAdapter.test.ts` covers logical key normalization/partitioning, write/read/stream/delete behavior, and stable application-safe error mapping.
