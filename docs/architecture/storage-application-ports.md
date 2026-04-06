# Storage Application Ports and Use-Case Contracts

This note documents the storage application-layer seams and the concrete service implementation that now orchestrates managed storage lifecycle behavior.

## Canonical artifacts

- `src/application/storage/ports/IStorageInstanceRepository.ts`
- `src/application/storage/ports/StorageProvisioningPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/ports/StorageAccessSummaryPort.ts`
- `src/application/storage/ports/StorageCapabilityInspectionPort.ts`
- `src/application/storage/ports/StorageObjectPort.ts`
- `src/application/storage/ports/StorageObjectAccessResolverPort.ts`
- `src/application/storage/ports/StorageObservabilityPorts.ts`
- `src/application/storage/ports/StorageManagementPorts.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/application/storage/use-cases/StorageManagementService.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionService.ts`
- `src/application/storage/use-cases/StorageManagementServiceErrors.ts`
- `src/application/storage/tests/StorageManagementServiceContracts.test.ts`
- `src/application/storage/tests/StorageLogicalAccessResolutionService.test.ts`

## Scope and intent

- Keep storage management orchestration centralized in the application layer.
- Enforce workspace-aware policy checks and lifecycle transitions before any transport/controller code runs.
- Preserve stable, backend-agnostic contracts while enabling backend provisioning and capability inspection.
- Provide backend-agnostic logical object read/write contracts for asset content flows.

## Logical object access contracts (Story 10.1.4)

`StorageObjectPort` defines authoritative managed-storage content-operation seams for:

- logical key generation from storage metadata and logical segments
- object writes accepting buffer or async-stream content
- object existence checks
- object metadata reads
- object read streaming
- safe delete behavior for absent objects
- typed application-safe failures (`StorageObjectAccessError` + stable error codes)

These contracts are backend-neutral and operate on `StorageInstance` metadata plus logical object keys, not caller-supplied filesystem paths.

## Logical access resolution contracts (Story 9.3.3)

`StorageLogicalAccessResolutionService` introduces a centralized server-side seam that resolves logical storage references and operation intents into authorized backend object-operation plans:

- accepts `storage-instance://<id>` references (or explicit storage ids) and operation intents
- validates workspace scope and storage existence through `IStorageInstanceRepository`
- maps logical intents to canonical policy actions and enforces authorization via `IStoragePolicyEvaluationPort`
- resolves backend object adapters through `IStorageObjectAccessResolverPort`
- returns internal logical access plans (`storageInstance` + `objectPort`) without exposing physical storage paths

The intent is to ensure asset/upload/download services consume logical storage contracts rather than filesystem layout details.

## Implemented service layer (Story 9.3.1)

`StorageManagementService` implements the management contracts for:

- create storage instance
- update storage metadata
- activate storage instance
- deactivate storage instance
- list accessible storage instances
- get storage instance details

Core behavior:

- policy checks are enforced through `IStoragePolicyEvaluationPort` for every management action.
- list visibility is constrained through `resolveAccessibleStorageInstanceIds(...)`.
- lifecycle state changes are validated via domain transitions.
- optional backend lifecycle operations route through `IStorageProvisioningPort`.
- returned objects are normalized/frozen and include `accessSummary` data for authoritative UI/API consumption.

## Error handling

Explicit service errors are introduced and mapped into the existing `StorageManagementResult<TValue>` envelope:

- `StoragePolicyViolationError` -> `storage-policy-violation`
- `StorageInstanceNotFoundError` -> `storage-not-found`
- `StorageBackendOperationUnsupportedError` -> `storage-capability-unsupported`
- `StorageInvalidLifecycleTransitionError` -> `storage-invalid-state`

Provisioning rejections that are not unsupported backend capabilities map to `storage-provisioning-failed`.

## Boundary posture

- Service logic depends on domain + application ports only.
- No persistence row model leakage, transport DTO binding, or UI/controller business logic duplication.
- Storage management audit events remain best-effort and non-blocking.

## Test coverage

`StorageManagementServiceContracts.test.ts` verifies:

- successful end-to-end management orchestration through the service layer
- policy violation responses
- workspace-scoped not-found behavior
- invalid lifecycle transition responses
- unsupported backend operation responses
- provisioning rejection failure behavior without unintended persistence
