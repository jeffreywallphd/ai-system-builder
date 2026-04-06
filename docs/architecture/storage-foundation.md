# Storage Foundation

This note documents Story 9.1.1 for Feature 9 / Epic 9.1: the initial managed-storage bounded context in the domain layer.

## Scope

Implemented in this story:

- managed storage domain model in `src/domain/storage/StorageDomain.ts`
- first-class `StorageInstance` entity with workspace ownership, lifecycle, access, replication, policy, and attribution contracts
- storage enums and value contracts:
  - `StorageBackendType`
  - `StorageAccessMode`
  - `StorageLifecycleState`
  - `StorageReplicationMode`
- domain factories and mutation APIs for safe construction and updates:
  - `createStorageInstance(...)`
  - `createStoragePolicy(...)`
  - `createStorageReplicationPolicy(...)`
  - `createStorageAttribution(...)`
  - `transitionStorageLifecycle(...)`
  - `updateStoragePolicy(...)`
- explicit invariant and transition error contracts:
  - `StorageDomainError`
  - `StorageLifecycleTransitionError`
- domain tests for invariant enforcement and invalid combination rejection

Out of scope in this story:

- persistence adapters, repository ports, or migration schemas
- API/transport DTO handlers
- filesystem/path runtime adapters
- UI models

## Canonical files

- `src/domain/storage/StorageDomain.ts`
- `src/domain/storage/tests/StorageDomain.test.ts`

## Domain concepts

### StorageInstance

Managed storage is modeled as a first-class platform resource, not a raw folder path.

Canonical fields include:

- identity: `id`, `displayName`
- backend posture: `backendType`
- lifecycle: `lifecycleState`
- ownership: `ownership.workspaceId`, `ownership.ownerUserIdentityId`
- access contract: `access.mode`, `access.scope`
- replication contract: `replication.mode`, optional replica reference and sync cadence
- policy contract: `policyId`, retention/size constraints, metadata labels, encryption posture reference
- audit attribution: `createdBy`, `createdAt`, `lastModifiedBy`, `lastModifiedAt`, `lastCorrelationId`

### StoragePolicy

Storage policy remains a domain contract and carries:

- retention and max object sizing constraints
- immutability/cross-workspace read posture flags
- normalized label metadata
- encryption posture references (`profileId`, optional key reference, envelope requirement)

### Lifecycle and activity

Lifecycle is explicit:

- `provisioning`
- `active`
- `suspended`
- `degraded`
- `archived`
- `deleting`
- `deleted`
- `failed`

Transition rules are controlled by `StorageLifecycleTransitions` and enforced by `transitionStorageLifecycle(...)`.

`isStorageInstanceActive(...)` and `assertStorageInstanceActive(...)` provide a canonical active-state seam for downstream use cases.

## Invariants enforced in domain code

- storage identity and display names are normalized and validated
- backend/access/lifecycle/replication enums are validated
- ownership requires workspace and owner user identity references
- attribution correlation id is mandatory and format-constrained
- `lastModifiedAt` cannot precede `createdAt`
- replication mode/config coherence is enforced:
  - `none` cannot include replica config
  - `async-mirror` requires replica id and sync interval
  - `sync-mirror` requires replica id and forbids sync interval
- policy numeric constraints require positive integer values when present
- active read-only storage must be replication-backed
- deleted storage cannot retain non-`none` replication mode
- invalid lifecycle transitions raise explicit transition errors

## Boundary posture

This slice is domain-pure:

- no infrastructure implementation details
- no storage-engine or filesystem semantics
- no transport or presentation leakage

The model is intentionally suitable for later persistence and API projection while keeping core semantics in the domain layer.

## Tests

`src/domain/storage/tests/StorageDomain.test.ts` covers:

- valid managed storage creation
- replication policy mismatch rejection
- invalid active-state combination rejection
- lifecycle transition enforcement
- active-state assertions
- attribution and timestamp invariant failures
- safe policy mutation through domain APIs
