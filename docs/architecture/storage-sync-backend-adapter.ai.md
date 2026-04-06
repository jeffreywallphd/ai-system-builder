# AI Companion: Synchronized Storage Backend Abstraction Seam

## Purpose

Story 9.2.4 adds a production-safe synchronization seam so managed storage can represent sync/replication posture now, including deployment profiles where sync is configured but inactive or unavailable.

## Canonical files

- `src/infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter.ts`
- `src/infrastructure/storage/sync/StorageSynchronizationTransportMapper.ts`
- `src/infrastructure/storage/sync/index.ts`
- `src/infrastructure/storage/sync/tests/ServerManagedStorageSynchronizationAdapter.test.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`

## What it implements

- Typed synchronization eligibility + state assessment:
  - `assessSynchronizationEligibility(...)`
  - `inspectSynchronizationState(...)`
- Explicit deployment availability modeling:
  - `active`
  - `configured-inactive`
  - `unavailable`
- Deterministic reason-code reporting for sync posture outcomes.

## Contract posture

- Sync capability is not inferred ad hoc by callers; it is represented through typed contracts.
- API-facing storage replication payloads can now report synchronization metadata explicitly (`replication.synchronization`).
- Validation rules prevent contradictory metadata (for example unavailable deployment cannot report sync-capable=true).

## Operational assumptions

- This seam is an assessment/reporting foundation, not a full replication engine.
- Local managed filesystem instances are treated as non-sync-capable by default.
- Shared/object backends can be represented as sync-capable while still reporting deployment-inactive or unavailable posture.

## Verified by tests

- Sync adapter tests cover deployment-profile behavior, backend sync-capability distinction, and unsupported replication-mode degradation reporting.
- Shared storage transport DTO/contract/schema tests cover synchronization metadata projection and schema validation invariants.
