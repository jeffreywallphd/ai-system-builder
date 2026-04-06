# Storage Feature Extension Guidance

This note documents Story 9.4.5 (Feature 9 / Epic 9.4): contributor guidance and operational standards for extending the managed storage platform safely.

## Canonical implementation seams

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/ports/StorageManagementPorts.ts`
- `src/application/storage/ports/StorageProvisioningPort.ts`
- `src/application/storage/ports/StorageCapabilityInspectionPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/ports/StorageObjectPort.ts`
- `src/application/storage/use-cases/StorageManagementService.ts`
- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`
- `src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts`
- `src/infrastructure/storage/local/ServerManagedLocalStorageBackendAdapter.ts`
- `src/infrastructure/storage/shared/ServerManagedSharedStorageBackendAdapter.ts`
- `src/infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter.ts`
- `src/infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter.ts`
- `infrastructure/api/storage/StorageManagementBackendApi.ts`
- `infrastructure/api/storage/sdk/PublicStorageManagementApiContract.ts`
- `ui/shared/storage/StorageAdministrationClient.ts`
- `ui/services/StorageAdministrationService.ts`
- `ui/components/storage/StorageInstanceWorkflowPanel.tsx`
- `ui/pages/StorageAdministrationPage.tsx`
- `ui/web/storage/StorageAdministrationRoutes.ts`
- `hosts/server/IdentityServerHost.ts`

## Extension objective

Treat managed storage as an authoritative platform capability with typed lifecycle, policy, provisioning, and access contracts. New backends and admin workflows must plug into existing storage contracts; they must not introduce path-based shortcuts or transport-specific business rules.

## Domain and policy invariants that extension work must preserve

`StorageDomain` is the authoritative semantic boundary for:

- storage identity, ownership, lifecycle, access mode/scope, and replication mode
- typed policy metadata (`security.*`, `lifecycle.*`, encryption references, retention limits)
- lifecycle transition legality through `StorageLifecycleTransitions`
- contradiction rejection (encryption-mode combinations, retention hook coherence, replication coherence)

Contributor rules:

- Do not re-implement domain validation in adapters or UI.
- Do not add backend-specific lifecycle or policy enum values in transport/UI first.
- Extend domain contracts first, then ports, then transport, then UI.

## Backend adapter contract standards

A new backend is added through infrastructure adapters plus registry composition.

Required behavior:

1. Implement `IStorageProvisioningPort` for backend operations (`create`, `activate`, `deactivate`, optional `replication-sync` handling).
2. Return deterministic `StorageProvisioningReceipt` outcomes with stable `reasonCode` values for operational troubleshooting.
3. Provide capability inspection through `IStorageCapabilityInspectionPort` either:
   - directly on the same adapter, or
   - via an explicit capability adapter registered for that backend type.
4. Keep object content flows on `IStorageObjectPort` with logical `objectKey` contracts, never raw caller-supplied host paths.
5. Map backend faults to typed, non-leaky errors (`storage-object-*` or stable provisioning rejection reason codes).

Registration and dispatch standards:

- Register each backend once in `StorageBackendAdapterRegistry`.
- Duplicate registration must fail fast at composition time.
- Dispatch must remain backend-type keyed; do not branch in use cases on backend internals.

## Provisioning and lifecycle orchestration standards

The create/lifecycle orchestration path is:

1. `StorageManagementService` and `CreateStorageInstanceWithProvisioningUseCase` authorize operation through `IStoragePolicyEvaluationPort`.
2. Domain entities are created/transitioned using `createStorageInstance(...)` and `transitionStorageLifecycle(...)`.
3. `StorageBackendProvisioningOrchestrator` resolves backend adapters from `StorageBackendAdapterRegistry`.
4. Provisioning outcomes are persisted as authoritative lifecycle state (`active`, `failed`, etc.) through `IStorageInstanceRepository`.
5. Mutations emit storage audit events via `StorageManagementAuditSink`.

Extension rules:

- Keep compensation and rejection behavior deterministic (no partial "success" lifecycle state after rejected provisioning).
- Keep backend selection in registry/orchestrator only.
- Keep audit writes best-effort and non-blocking for core mutations.

## API and transport standards

`StorageManagementBackendApi` is the canonical API adapter for storage administration. It must remain thin and contract-driven.

Rules:

- Validate all storage payloads via `StorageTransportSchemaContracts` parse functions.
- Map application management errors through `StorageManagementApiErrorCodes` deterministically.
- Keep detail/list projections on shared DTO mappers and redaction metadata; do not expose raw binding paths or secret/key material.
- Keep mutation endpoint constraints explicit (metadata endpoint allows display name + policy labels only).

Current API surface:

- `POST /api/v1/storage/instances`
- `GET /api/v1/storage/instances`
- `GET /api/v1/storage/instances/:storageInstanceId`
- `PATCH /api/v1/storage/instances/:storageInstanceId/metadata`
- `POST /api/v1/storage/instances/:storageInstanceId/activate`
- `POST /api/v1/storage/instances/:storageInstanceId/deactivate`
- `GET /api/v1/storage/instances/:storageInstanceId/health`

## UI and admin workflow standards

Storage admin UI (`/settings/storage`) consumes authoritative API contracts only.

Rules:

- Keep renderer logic presentational; all lifecycle/policy/health authority stays in backend contracts.
- Keep create/edit/lifecycle forms schema-aligned with shared storage transport validators.
- Keep lifecycle controls gated by both `access.allowedActions` and lifecycle state guardrails.
- Keep capability/sync/readiness messaging derived from `/health` + detail contracts.

## Operational composition assumptions as of April 6, 2026

These behaviors are current implementation, not target-state placeholders:

- `hosts/server/IdentityServerHost.ts` composes `StorageBackendProvisioningOrchestrator` with `createStorageBackendAdapterRegistry([])`.
- In this host composition, backend provisioning/capability inspection requests resolve as unconfigured unless adapters are explicitly wired.
- Admin UI supports provisioning toggles, but default create/lifecycle flows remain valid without backend activation/provisioning requests.
- Synchronization posture remains a typed assessment seam via `ServerManagedStorageSynchronizationAdapter`; it is not a distributed replication engine.

When enabling a backend in a deployment profile, wire adapter registration in host composition and keep API/UI contracts unchanged.

## Explicit boundaries for later features

The current storage platform intentionally does not implement the following behaviors in this slice:

- distributed cross-node replication execution or scheduler orchestration
- cryptographic key retrieval/decryption execution for object payloads
- automatic backend mounting/remounting workflows for network providers
- direct user-provided filesystem-path binding through storage management APIs

Later features should extend existing storage seams rather than replacing them:

- encryption expansion: extend storage policy/security metadata and object access pipeline behavior
- additional backends: add adapter + registry registration + capability tests
- preview/run/share asset flows: continue using logical storage references resolved through `StorageLogicalAccessResolutionService`

## Contributor extension checklist

Before merging storage backend or storage-admin changes:

- domain invariants remain enforced in `StorageDomain` (no transport/UI-only validation divergence)
- backend adapter registration is unique and composition-owned
- provisioning + capability failures map to stable reason codes
- API error and validation mapping remains deterministic and schema-backed
- no path/key/internal backend leakage in transport DTOs or UI
- admin lifecycle controls remain access-summary and lifecycle-state gated
- updated docs include both `.md` and `.ai.md` variants when changed

## Regression baseline and test expectations

Keep these suites green when extending storage backends or admin behavior:

- domain and policy invariants:
  - `src/domain/storage/tests/StorageDomain.test.ts`
- application orchestration and contracts:
  - `src/application/storage/tests/CreateStorageInstanceWithProvisioningUseCase.test.ts`
  - `src/application/storage/tests/StorageManagementServiceContracts.test.ts`
  - `src/application/storage/tests/StorageLogicalAccessResolutionService.test.ts`
- backend orchestration and adapters:
  - `src/infrastructure/storage/tests/StorageBackendAdapterRegistry.test.ts`
  - `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`
  - `src/infrastructure/storage/local/tests/ServerManagedLocalStorageBackendAdapter.test.ts`
  - `src/infrastructure/storage/shared/tests/ServerManagedSharedStorageBackendAdapter.test.ts`
  - `src/infrastructure/storage/sync/tests/ServerManagedStorageSynchronizationAdapter.test.ts`
- persistence and audit:
  - `src/infrastructure/persistence/storage/tests/SqliteStorageInstancePersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/storage/tests/SqliteStorageManagementAuditRecorder.test.ts`
- API/transport/UI contracts:
  - `infrastructure/api/storage/tests/StorageManagementBackendApi.test.ts`
  - `infrastructure/transport/http-server/identity/tests/IdentityHttpServerStorageManagement.test.ts`
  - `src/shared/contracts/storage/tests/StorageTransportContracts.test.ts`
  - `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`
  - `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
  - `ui/services/tests/StorageAdministrationService.test.ts`
  - `ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
  - `ui/pages/tests/StorageAdministrationPage.test.tsx`
  - `ui/pages/tests/StorageAdministrationPage.presentation.test.ts`
  - `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`

## Related architecture notes

- `docs/architecture/storage-foundation.md`
- `docs/architecture/storage-policy-metadata-model.md`
- `docs/architecture/storage-application-ports.md`
- `docs/architecture/storage-provisioning-orchestration.md`
- `docs/architecture/storage-local-backend-adapter.md`
- `docs/architecture/storage-shared-backend-adapter.md`
- `docs/architecture/storage-sync-backend-adapter.md`
- `docs/architecture/storage-transport-contracts.md`
- `docs/architecture/storage-access-semantics.md`
- `docs/architecture/storage-server-api.md`
- `docs/storage-administration-operations.md`
