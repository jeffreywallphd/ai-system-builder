# AI Companion: Storage Application Ports and Use-Case Contracts

## Purpose

Story 9.1.2 introduces the application-layer seams for managed storage instance orchestration so later persistence/API/runtime adapters implement stable contracts instead of ad hoc storage wiring.

## Canonical files

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/application/storage/ports/StorageProvisioningPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/ports/StorageCapabilityInspectionPort.ts`
- `src/application/storage/ports/StorageObservabilityPorts.ts`
- `src/application/storage/ports/StorageManagementPorts.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/application/storage/tests/StorageManagementServiceContracts.test.ts`

## Contract summary

- Repository contract for storage instance reads/lists/idempotent mutations.
- Provisioning port with typed operation request/receipt for create/activate/deactivate/sync.
- Policy-evaluation port for per-action decisions and accessible-instance filtering.
- Capability inspection port for backend/instance feature posture.
- Audit sink seam for best-effort operational event emission.

## Use-case surface

- `createStorageInstance(...)`
- `updateStorageMetadata(...)`
- `activateStorageInstance(...)`
- `deactivateStorageInstance(...)`
- `listAccessibleStorageInstances(...)`
- `getStorageInstanceDetails(...)`

All use cases share a typed `StorageManagementResult<T>` envelope with stable error-code taxonomy.

## Boundary posture

- Depends only on domain storage contracts + application ports.
- No transport DTO leakage, persistence rows, or backend implementation types in the use-case contracts.
- Audit delivery is non-blocking (`publishStorageManagementAuditEventBestEffort(...)`).

## Verified by tests

`StorageManagementServiceContracts.test.ts` demonstrates the contracts are practical and compilable through in-memory implementations, including success flows, policy denials, and best-effort audit failure handling.
