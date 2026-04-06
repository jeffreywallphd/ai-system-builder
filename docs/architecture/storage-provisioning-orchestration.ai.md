# AI Companion: Storage Provisioning Orchestration

## Purpose

Story 9.2.5 adds the application and infrastructure seams that create storage instances through centralized backend selection, backend provisioning, and authoritative persistence.

## Canonical files

- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`
- `src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts`
- `src/application/storage/tests/CreateStorageInstanceWithProvisioningUseCase.test.ts`
- `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`

## What was added

- Central backend registry keyed by typed backend ids (`StorageBackendType`).
- Backend provisioning/capability orchestrator that routes through the registry.
- Create-storage use case that:
  - evaluates policy
  - creates storage in `provisioning` state
  - requests backend provisioning
  - persists resulting lifecycle as `active` (accepted) or `failed` (rejected)
  - publishes best-effort audit and performs best-effort backend cleanup if persistence fails after accepted provisioning

## Failure safety posture

- Unsupported/unconfigured backends return deterministic rejected receipts (`storage-backend-not-configured`).
- Adapter exceptions return deterministic rejected receipts (`storage-backend-operation-failed`).
- Rejected backend provisioning persists explicit `failed` lifecycle state and returns `storage-provisioning-failed`.
- No rejected provisioning outcome is persisted as `active`.

## Extensibility posture

- New backend adapters are added by registry registration only; create-flow orchestration does not change.
- Backend-specific reason codes stay within adapters; cross-backend orchestration reason codes are centralized.
