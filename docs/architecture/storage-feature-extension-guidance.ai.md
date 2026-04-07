# AI Companion: Storage Feature Extension Guidance

## Purpose

Story 9.4.5 baseline for Feature 9 / Epic 9.4: define extension-safe rules and operational standards for managed storage backends and admin flows.

## Canonical files

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/use-cases/StorageManagementService.ts`
- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`
- `src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts`
- `src/infrastructure/api/storage/StorageManagementBackendApi.ts`
- `src/ui/components/storage/StorageInstanceWorkflowPanel.tsx`
- `src/ui/pages/StorageAdministrationPage.tsx`
- `src/hosts/server/IdentityServerHost.ts`
- `docs/architecture/storage-feature-extension-guidance.md`

## Core extension rules

- Extend storage from domain -> ports -> adapters -> transport -> UI; do not reverse the order.
- Register each backend exactly once in `StorageBackendAdapterRegistry`; duplicate registration must fail fast.
- Keep backend operations on typed seams (`IStorageProvisioningPort`, optional `IStorageCapabilityInspectionPort`, optional `IStorageObjectPort`).
- Keep all object operations logical-key based; no caller path binding in management/API/UI contracts.
- Keep API validation and error mapping deterministic via storage schema contracts and stable API error codes.
- Keep admin lifecycle actions gated by authoritative access summaries plus lifecycle transition constraints.

## Current operational assumptions (April 6, 2026)

- Server host composition currently uses an empty storage backend registry (`createStorageBackendAdapterRegistry([])` in `IdentityServerHost`).
- Provisioning/capability routes therefore report backend-unconfigured posture unless a deployment wires backend adapters.
- Sync support is a typed capability/state seam; it is not distributed replication execution in this slice.

## Regression suites to keep green

- `src/domain/storage/tests/StorageDomain.test.ts`
- `src/application/storage/tests/CreateStorageInstanceWithProvisioningUseCase.test.ts`
- `src/application/storage/tests/StorageManagementServiceContracts.test.ts`
- `src/infrastructure/storage/tests/StorageBackendAdapterRegistry.test.ts`
- `src/infrastructure/storage/tests/StorageBackendProvisioningOrchestrator.test.ts`
- `src/infrastructure/api/storage/tests/StorageManagementBackendApi.test.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`
- `src/ui/components/storage/tests/StorageInstanceWorkflowPanel.test.tsx`
- `src/ui/pages/tests/StorageAdministrationPage.test.tsx`
