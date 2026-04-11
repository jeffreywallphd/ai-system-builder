# Storage Provisioning Service and Backend Selection Orchestration

This note documents Story 9.2.5 (Feature 9 / Epic 9.2): orchestration that provisions managed storage instances through centrally selected backend adapters and persists authoritative lifecycle metadata.

## Canonical artifacts

- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`
- `src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts`
- `src/application/storage/tests/CreateStorageInstanceWithProvisioningUseCase.test.ts`
- `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`

## Scope and intent

- Centralize backend adapter selection by typed `StorageBackendType` identifiers.
- Provide an application use-case orchestration for storage create + backend provisioning + persistence.
- Ensure provisioning failures do not surface as healthy/active storage instances.
- Keep extension seams explicit for future backend additions without changing create-flow orchestration logic.

## Provisioning orchestration design

### Backend selection registry

`StorageBackendAdapterRegistry` is the single backend selection table for storage provisioning and capability inspection.

- keyed by `StorageBackendType`
- rejects duplicate backend registrations at startup
- supports independent provisioning/capability port registrations per backend

This removes ad hoc adapter selection from application flows.

### Backend provisioning orchestrator

`StorageBackendProvisioningOrchestrator` implements:

- `IStorageProvisioningPort`
- `IStorageCapabilityInspectionPort`

Behavior:

- resolves backend adapters through the registry
- returns stable rejected receipts when backend adapters are unconfigured
- maps backend adapter exceptions to deterministic rejected provisioning receipts
- supports instance/backend capability inspection through the same backend registry path

This gives create-flow and capability inspection a single composition seam.

## Create storage use-case orchestration

`CreateStorageInstanceWithProvisioningUseCase` orchestrates:

1. policy authorization for `StoragePolicyActions.create`
2. domain instance construction in `provisioning` lifecycle when backend provisioning is requested
3. backend provisioning request (`create` operation)
4. lifecycle transition before persistence:
   - `provisioning -> active` when provisioning is accepted
   - `provisioning -> failed` when provisioning is rejected
5. persistence of resulting authoritative storage metadata
6. best-effort compensation via backend `deactivate` when backend create succeeded but persistence fails
7. best-effort storage-created audit emission with outcome metadata

Failure posture:

- policy denial returns `storage-access-denied` and persists nothing
- backend provisioning rejection returns `storage-provisioning-failed` and persists explicit `failed` state
- persistence conflict/internal errors return stable management error codes and trigger best-effort cleanup where applicable

## End-to-end behavior validated

`CreateStorageInstanceWithProvisioningUseCase.test.ts` covers:

- successful create-provision-persist flows for supported local (`managed-filesystem`) and shared (`network-share`) backends
- rejected provisioning flow that persists `failed` lifecycle state
- policy-denied create flow with no persistence side effects

`StorageBackendProvisioningOrchestrator.test.ts` covers:

- centralized backend routing behavior
- deterministic rejected receipts for unconfigured backend ids
- deterministic rejected receipts for adapter-thrown provisioning failures

## Extension points

- Add new backend by registering `StorageBackendType -> provisioning/capability adapter` in `StorageBackendAdapterRegistry`.
- Keep create orchestration unchanged; new backends participate automatically through registry-driven selection.
- Backend-specific reason codes remain adapter-owned, while orchestrator reason codes cover selection/dispatch failures.

## Related ADRs

- `docs/adr/records/adr-003-storage-as-managed-platform-resource.md`
