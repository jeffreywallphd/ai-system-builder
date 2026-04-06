# AI Companion: Storage Application Ports and Use-Case Contracts

## Purpose

Story 9.1.2 established the storage application seams and typed contracts.
Story 9.3.1 now implements the authoritative storage management service layer that executes those contracts with centralized lifecycle orchestration, policy enforcement, and backend operation handling.
Story 9.3.5 adds authoritative storage-management audit governance events with payload redaction and durable persistence seams.

## Canonical files

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
- `src/application/storage/tests/StorageObservabilityPorts.test.ts`
- `src/infrastructure/persistence/storage/SqliteStorageManagementAuditRecorder.ts`
- `src/infrastructure/persistence/storage/tests/SqliteStorageManagementAuditRecorder.test.ts`

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

## Story 9.3.5 extension: authoritative storage audit governance events

- Storage management audit vocabulary now includes:
  - `storage-created`
  - `storage-metadata-updated`
  - `storage-policy-updated`
  - `storage-activated`
  - `storage-deactivated`
  - existing read/list query events (`storage-detail-queried`, `storage-access-listed`)
- Core mutation flows emit actor/workspace/storage scoped audit envelopes with high-value mutation metadata:
  - create: backend/access/policy summary metadata (without raw connection or key-reference values)
  - metadata update: changed metadata fields and changed policy-label keys
  - policy update: previous/current policy summaries and changed label keys
  - lifecycle transitions: previous/next lifecycle states and backend provisioning request/outcome summary
- `StorageObservabilityPorts` now sanitizes/redacts sensitive detail keys before sink dispatch (for example key references, backend bindings, connection/path/URI-like fields).
- Dispatch remains best-effort by design so authoritative storage mutations are not blocked by downstream audit sink failures.
- Durable/queryable persistence seam is provided by `SqliteStorageManagementAuditRecorder` (`listRecent`, `listByWorkspaceId`, `listByStorageInstanceId`), and host composition now wires this recorder as the default `StorageManagementService` audit sink.

## Story 10.1.4 extension: logical object operations

`StorageObjectPort` now defines backend-agnostic managed storage content contracts for:

- logical key generation using storage metadata and logical segments
- write operations from buffer or async stream content
- existence checks and metadata reads
- read-stream retrieval
- safe delete behavior for absent objects
- adapter-safe failure mapping through `StorageObjectAccessError` and stable `StorageObjectErrorCodes`

This preserves authoritative server-managed storage access without exposing host paths to application/UI layers.

## Story 9.3.3 extension: logical storage access resolution

`StorageLogicalAccessResolutionService` adds a reusable resolution seam for asset/object access flows:

- validates logical storage identity (`storage-instance://...` or id)
- enforces workspace-scoped existence and policy checks
- maps intents to canonical policy actions (`view`, `use-for-assets`)
- resolves backend object adapters through `IStorageObjectAccessResolverPort`
- returns internal access plans without leaking physical path details

## Story 9.3.4 extension: storage inspection use case

Storage inspection is now explicit at the application layer:

- `StorageCapabilityInspectionPort` includes typed backend health metadata (`status`, `reasonCode`, `checkedAt`, safe `notes`) in capability snapshots.
- `StorageManagementService.inspectStorageInstanceStatus(...)` provides authoritative workspace-scoped inspection output with:
  - storage lifecycle state
  - capability flags
  - typed operational status (`healthy | unhealthy | inactive | unsupported`)
  - `lastCheckedAt` and stable `reasonCode`
  - safe operational notes for admin diagnostics

Classification is lifecycle-aware so unhealthy posture is distinguishable from inactive lifecycle posture and unsupported backend posture.

## Verified by tests

`StorageManagementServiceContracts.test.ts` covers:

- successful end-to-end management flow through the service layer
- policy violation handling
- workspace-scoped not-found behavior
- invalid lifecycle transition handling
- unsupported backend operation handling
- rejected provisioning failure handling without persisting unintended transitions
- storage mutation audit event coverage, including policy-update event emission and high-value mutation metadata details
