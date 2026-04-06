# Storage Application Ports and Use-Case Contracts

This note documents Story 9.1.2 (Feature 9 / Epic 9.1): application-layer contracts for managed storage instance orchestration.
Story 9.1.5 extends this surface with storage access-summary contracts used by listing/detail/action flows.

## Canonical artifacts

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/application/storage/ports/StorageProvisioningPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/ports/StorageAccessSummaryPort.ts`
- `src/application/storage/ports/StorageCapabilityInspectionPort.ts`
- `src/application/storage/ports/StorageObservabilityPorts.ts`
- `src/application/storage/ports/StorageManagementPorts.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/application/storage/tests/StorageManagementServiceContracts.test.ts`

## Scope and intent

- Establish stable, explicit storage-application seams before persistence and backend adapters exist.
- Keep managed-storage use cases backend-agnostic while preserving production-oriented contracts.
- Ensure storage lifecycle and access orchestration remains application-owned and policy-driven.

## Port responsibilities

- `IStorageInstanceRepository`
  - canonical persistence/query seam for `StorageInstance` records with explicit list filters and idempotent mutation context.
- `IStorageProvisioningPort`
  - backend-facing lifecycle/provisioning operation seam (`create`, `activate`, `deactivate`, `replication-sync`) with structured operation receipts.
- `IStoragePolicyEvaluationPort`
  - policy authorization seam for storage actions and access-filtered storage list resolution.
- `StorageInstanceAccessSummary` (via `StorageAccessSummaryPort.ts`)
  - storage-facing representation seam for effective action permissions, ownership/workspace context, and policy-restricted capabilities.
- `IStorageCapabilityInspectionPort`
  - backend capability introspection seam for storage backend/instance compatibility checks.
- `StorageManagementAuditSink` (via `StorageObservabilityPorts.ts`)
  - best-effort audit seam for storage creation, metadata updates, lifecycle operations, and read/query usage.

## Use-case contracts

`StorageManagementServiceContracts.ts` defines explicit command/query DTOs and result envelopes for:

- create storage instance
- update storage metadata
- activate storage instance
- deactivate storage instance
- list accessible storage instances
- get storage instance details

Each operation returns a typed `StorageManagementResult<TValue>` with stable error codes:

- `storage-invalid-request`
- `storage-access-denied`
- `storage-not-found`
- `storage-conflict`
- `storage-invalid-state`
- `storage-policy-violation`
- `storage-capability-unsupported`
- `storage-provisioning-failed`
- `storage-internal`

Story 9.1.5 updates result contracts so storage management flows can optionally return `accessSummary` alongside storage data. This allows API/admin consumers to rely on authoritative storage access posture while keeping enforcement in policy ports.

## Boundary posture

- Application contracts depend on domain storage contracts and application ports only.
- No persistence row models, API transport DTOs, runtime filesystem paths, or backend SDK types are exposed.
- Audit/event emission remains best-effort and non-blocking for business outcomes.

## Test coverage

`StorageManagementServiceContracts.test.ts` validates contract-level behavior with in-memory adapters:

- end-to-end create/update/activate/deactivate/list/detail orchestration using the new request/response contracts
- policy-denied failure behavior mapping
- best-effort audit sink failure handling
- stability of error and provisioning constants

## Follow-on implementation seam

These contracts are ready for later stories to implement:

- SQLite or other repository adapters for `IStorageInstanceRepository`
- concrete managed-storage backend adapters for `IStorageProvisioningPort`
- policy adapters bound to authorization systems for `IStoragePolicyEvaluationPort`
- runtime/backend capability probes for `IStorageCapabilityInspectionPort`
