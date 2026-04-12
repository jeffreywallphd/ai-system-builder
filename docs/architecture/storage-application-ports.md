# Storage Application Ports and Use-Case Contracts

This note documents the storage application-layer seams and the concrete service implementation that now orchestrates managed storage lifecycle behavior.
It now also documents Story 9.3.5 storage-management audit governance integration.

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
- `src/application/storage/tests/StorageObservabilityPorts.test.ts`
- `src/infrastructure/persistence/storage/SqliteStorageManagementAuditRecorder.ts`
- `src/infrastructure/persistence/storage/tests/SqliteStorageManagementAuditRecorder.test.ts`

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

## Policy-aware storage administration contracts (Story 11.3.1)

Storage administration mutation contracts now expose encryption-policy and lifecycle-policy fields directly so later enforcement stories can consume authoritative policy state without reshaping these use-case interfaces:

- `CreateStorageInstanceCommand.policy` now supports:
  - `security` (`encryptionMode`, `contentEncryptionRequired`, `keyScope`, `allowPreviewDecryption`, `allowWorkerDecryption`)
  - `lifecycle` (`retentionExpiryAction`, optional `purgeGracePeriodDays`)
- `UpdateStorageMetadataCommand` now supports optional `policy` updates for:
  - baseline policy posture (`maxObjectBytes`, `retentionDays`, `immutableWrites`, `allowCrossWorkspaceReads`, labels)
  - encryption posture (`profileId`, `keyReferenceId`, `envelopeRequired`)
  - security/lifecycle policy fragments (same shape as create).
- `StorageManagementService.updateStorageMetadata(...)` now applies these fields through `updateStoragePolicy(...)`, keeping domain validation centralized and rejecting contradictory policy combinations.

## Logical access resolution contracts (Story 9.3.3)

`StorageLogicalAccessResolutionService` introduces a centralized server-side seam that resolves logical storage references and operation intents into authorized backend object-operation plans:

- accepts `storage-instance://<id>` references (or explicit storage ids) and operation intents
- validates workspace scope and storage existence through `IStorageInstanceRepository`
- maps logical intents to canonical policy actions and enforces authorization via `IStoragePolicyEvaluationPort`
- resolves backend object adapters through `IStorageObjectAccessResolverPort`
- returns internal logical access plans (`storageInstance` + `objectPort`) without exposing physical storage paths

The intent is to ensure asset/upload/download services consume logical storage contracts rather than filesystem layout details.

## Storage inspection contracts (Story 9.3.4)

`StorageCapabilityInspectionPort` now exposes typed health metadata in addition to capability flags:

- `health.status`: `healthy | unhealthy | inactive | unsupported`
- `health.reasonCode`: stable machine-readable diagnostic reason
- `health.checkedAt`: backend adapter inspection timestamp
- `health.notes`: safe operational notes for admin diagnostics

`StorageManagementService.inspectStorageInstanceStatus(...)` is the application-layer inspection use case that:

- enforces workspace-aware policy checks (`get-details`) before inspection output
- resolves instance-level capability + health snapshots
- returns lifecycle-aware operational classification (`healthy | unhealthy | inactive | unsupported`)
- returns explicit `lastCheckedAt`, `reasonCode`, and safe `operationalNotes` for API/admin projection

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

## Storage audit governance events (Story 9.3.5)

- Storage management audit event vocabulary now explicitly covers:
  - `storage-created`
  - `storage-metadata-updated`
  - `storage-policy-updated`
  - `storage-activated`
  - `storage-deactivated`
  - existing read/list events (`storage-detail-queried`, `storage-access-listed`)
- Core mutation events include actor identity, workspace context, storage instance identity, and high-value mutation metadata:
  - create: backend/access/policy summary fields only
  - metadata update: changed metadata fields and changed policy-label keys
  - policy update: previous/current policy summaries and changed label keys
  - lifecycle transitions: previous/next lifecycle states and provisioning request/outcome summary
- Sensitive payload data is redacted before sink delivery by `StorageObservabilityPorts` sanitization.
- The durable query seam is `SqliteStorageManagementAuditRecorder` with:
  - `listRecent(limit)`
  - `listByWorkspaceId(workspaceId, limit)`
  - `listByStorageInstanceId(storageInstanceId, limit)`
- Server host composition now wires this recorder into `StorageManagementService` so storage management actions persist authoritative governance events by default.

## Test coverage

`StorageManagementServiceContracts.test.ts` verifies:

- successful end-to-end management orchestration through the service layer
- policy violation responses
- workspace-scoped not-found behavior
- invalid lifecycle transition responses
- unsupported backend operation responses
- provisioning rejection failure behavior without unintended persistence
- storage mutation audit coverage including policy-update event emission and high-value metadata details

## Related ADRs

- `docs/adr/records/adr-003-storage-as-managed-platform-resource.md`
