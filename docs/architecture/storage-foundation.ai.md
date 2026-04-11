# AI Companion: Storage Foundation

## What this slice does (9.1.1 + 9.1.4)

- Adds the initial managed-storage domain bounded context in `src/domain/storage/StorageDomain.ts`.
- Models `StorageInstance` as a first-class platform resource with ownership, lifecycle, access, policy, replication, and audit attribution.
- Defines canonical storage enums:
  - `StorageBackendType`
  - `StorageAccessMode`
  - `StorageLifecycleState`
  - `StorageReplicationMode`
  - `StorageEncryptionMode`
  - `StorageEncryptionKeyScope`
  - `StorageRetentionExpiryAction`
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
- deterministic storage policy metadata defaults are applied when policy metadata is omitted:
  - `security.encryptionMode = platform-managed`
  - `security.contentEncryptionRequired = true`
  - `security.keyScope = workspace`
  - `security.allowPreviewDecryption = false`
  - `security.allowWorkerDecryption = false`
  - `lifecycle.retentionExpiryAction = none`
- contradictory policy metadata is rejected:
  - no-encryption mode cannot require content/envelope encryption, key refs, or preview/worker decryption
  - customer-managed encryption requires key refs
  - platform-managed encryption cannot include key refs
  - retention-expiry actions require retention-days anchor
  - purge grace is only valid for delete-on-expiry posture

## Boundaries

- domain layer only, no persistence/API/UI/filesystem coupling
- suitable as the canonical storage foundation for later repository, API, and authorization work

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
