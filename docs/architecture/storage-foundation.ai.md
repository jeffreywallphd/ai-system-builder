# AI Companion: Storage Foundation

## What this slice does

- Adds the initial managed-storage domain bounded context in `src/domain/storage/StorageDomain.ts`.
- Models `StorageInstance` as a first-class platform resource with ownership, lifecycle, access, policy, replication, and audit attribution.
- Defines canonical storage enums:
  - `StorageBackendType`
  - `StorageAccessMode`
  - `StorageLifecycleState`
  - `StorageReplicationMode`
- Adds domain-safe constructors and mutation APIs for create, policy updates, and lifecycle transitions.
- Enforces explicit invalid-combination and transition failure behavior via domain errors.

## Main files

- `src/domain/storage/StorageDomain.ts`
- `src/domain/storage/tests/StorageDomain.test.ts`
- `docs/architecture/storage-foundation.md`

## Key invariants

- storage id/display-name normalization and validation
- required workspace ownership and owner identity attribution
- required audit correlation id and valid timestamps
- replication mode/config coherence (`none` vs `async-mirror` vs `sync-mirror`)
- lifecycle transition enforcement through explicit transition map
- active read-only storage must be replication-backed
- deleted storage cannot keep active replication mode
- policy numeric and metadata constraints are validated in domain constructors

## Boundaries

- domain layer only, no persistence/API/UI/filesystem coupling
- suitable as the canonical storage foundation for later repository, API, and authorization work
