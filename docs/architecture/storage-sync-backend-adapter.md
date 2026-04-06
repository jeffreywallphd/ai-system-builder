# Synchronized Storage Backend Abstraction Seam

This note documents Story 9.2.4 (Feature 9 / Epic 9.2): the synchronized-storage backend abstraction seam for managed storage.

## Canonical artifacts

- `src/infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter.ts`
- `src/infrastructure/storage/sync/StorageSynchronizationTransportMapper.ts`
- `src/infrastructure/storage/sync/index.ts`
- `src/infrastructure/storage/sync/tests/ServerManagedStorageSynchronizationAdapter.test.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`

## Scope and intent

- Establish synchronized storage as an explicit managed backend seam now, even before full remote replication execution is deployed everywhere.
- Provide typed eligibility and state reporting so application/API layers can distinguish:
  - sync-capable instances,
  - sync-inactive deployment profiles,
  - unsupported local/shared posture combinations.
- Keep the seam production-safe by returning explicit, deterministic state instead of mock or placeholder behavior.

## Sync seam behavior

`ServerManagedStorageSynchronizationAdapter` provides two authoritative assessments:

- `assessSynchronizationEligibility(...)`
  - reports whether an instance is sync-capable in the current deployment profile.
- `inspectSynchronizationState(...)`
  - reports operational sync posture (`pending`, `healthy`, `degraded`, `disabled`) with explicit reason codes.

The adapter supports deployment-profile posture through typed availability:

- `active`
- `configured-inactive`
- `unavailable`

This allows runtime composition to represent "configured but inactive" and "not available in this deployment profile" without fake backends.

## Metadata and API projection model

Storage transport contracts now carry typed synchronization metadata under replication status:

- `StorageReplicationStatusDto.synchronization`
  - `syncCapable`
  - `supportsReplicationSyncOperation`
  - `deploymentAvailability`
  - optional `reasonCode`
  - optional `evaluatedAt`

Schema validation enforces safe coherence for this metadata, including:

- `deploymentAvailability='unavailable'` cannot report `syncCapable=true`
- `supportsReplicationSyncOperation=true` requires `syncCapable=true`

## Current constraints

- This story does not add a cross-node replication engine.
- The seam is intentionally bounded to typed capability/state assessment and API-safe reporting.
- Concrete adapters can now plug in real replication/sync execution later without changing storage domain contracts or transport shape.

## Test coverage

- `ServerManagedStorageSynchronizationAdapter.test.ts` validates:
  - configured-inactive deployment reporting for sync-capable storage
  - unavailable deployment reporting
  - sync-capable vs local non-capable backend distinction
  - degradation reporting when requested replication mode is unsupported by backend capabilities
- storage transport contract/DTO/schema tests validate synchronization metadata serialization and validation behavior.
