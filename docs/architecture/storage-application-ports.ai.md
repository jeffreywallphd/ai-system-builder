# AI Companion: Storage Application Ports and Use-Case Contracts

## Purpose

Story 9.1.2 established the storage application seams and typed contracts.
Story 9.3.1 now implements the authoritative storage management service layer that executes those contracts with centralized lifecycle orchestration, policy enforcement, and backend operation handling.

## Canonical files

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/application/storage/ports/StorageProvisioningPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/ports/StorageAccessSummaryPort.ts`
- `src/application/storage/ports/StorageCapabilityInspectionPort.ts`
- `src/application/storage/ports/StorageObservabilityPorts.ts`
- `src/application/storage/ports/StorageManagementPorts.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/application/storage/use-cases/StorageManagementService.ts`
- `src/application/storage/use-cases/StorageManagementServiceErrors.ts`
- `src/application/storage/tests/StorageManagementServiceContracts.test.ts`

## Service behavior (Story 9.3.1)

- `StorageManagementService` is the application-layer orchestrator for:
  - create
  - metadata update
  - activate
  - deactivate
  - list accessible instances
  - get details
- Workspace-aware access checks are always applied through `IStoragePolicyEvaluationPort` and list filtering is constrained via `resolveAccessibleStorageInstanceIds(...)`.
- Lifecycle transitions are validated via domain transition rules before persistence commits.
- Backend activation/deactivation requests are optional and routed through `IStorageProvisioningPort` when requested.
- Operation outputs are normalized/frozen and include storage access summaries that are safe for API/UI projection.

## Error model

`StorageManagementServiceErrors.ts` introduces explicit service errors that map to the stable result envelope taxonomy:

- `StoragePolicyViolationError` -> `storage-policy-violation`
- `StorageInstanceNotFoundError` -> `storage-not-found`
- `StorageBackendOperationUnsupportedError` -> `storage-capability-unsupported`
- `StorageInvalidLifecycleTransitionError` -> `storage-invalid-state`

Rejected provisioning that is not an unsupported backend operation maps to `storage-provisioning-failed`.

## Boundary posture

- The service depends only on domain storage + storage application ports.
- No transport DTOs, controller logic, or UI state logic is embedded.
- Audit emission remains best-effort and non-blocking.

## Verified by tests

`StorageManagementServiceContracts.test.ts` covers:

- successful end-to-end management flow through the service layer
- policy violation handling
- workspace-scoped not-found behavior
- invalid lifecycle transition handling
- unsupported backend operation handling
- rejected provisioning failure handling without persisting unintended transitions
