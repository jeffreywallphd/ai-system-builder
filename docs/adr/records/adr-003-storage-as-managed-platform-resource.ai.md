---
title: ADR-003 Storage as Managed Platform Resource
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 003
decision_status: accepted
decision_date: 2026-04-11
review_tier: routine
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/storage/StorageDomain.ts
  - src/application/storage/use-cases/StorageManagementService.ts
  - src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts
  - src/infrastructure/storage/StorageBackendAdapterRegistry.ts
  - src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts
  - src/application/storage/use-cases/StorageLogicalAccessResolutionService.ts
  - src/ui/services/StorageAdministrationService.ts
---

# ADR-003: Storage as Managed Platform Resource

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio treats storage as a managed platform capability, not ad hoc per-feature filesystem path configuration. Storage allocation, lifecycle, access semantics, policy posture, and logical object resolution must flow through storage domain/application contracts and managed storage instances. Features requiring durable files, assets, workflow artifacts, or runtime outputs must integrate through managed storage abstractions rather than owning raw path behavior.

## Context and Problem Statement

Storage behavior spans systems, workflows, assets, admin operations, and runtime execution. Without one durable decision record, implementation drifts toward path-string shortcuts, feature-local directory conventions, and backend-specific assumptions that are hard to secure, audit, migrate, and operate consistently.

This ADR establishes storage as first-class platform memory so human and AI contributors do not repeatedly rediscover why storage must remain contract-driven.

## Decision Drivers

- Keep storage semantics consistent across systems, workflows, assets, and runtime services.
- Prevent policy, lifecycle, and security drift caused by feature-local path handling.
- Preserve workspace-scoped ownership and policy posture for durable storage use.
- Improve operability via centralized provisioning, lifecycle transitions, capability checks, and audit hooks.
- Reduce repeated debate over directory conventions and user-facing storage semantics.

## Considered Options

1. Managed storage as a platform resource with typed instances and lifecycle contracts (accepted): keeps provisioning, policy, access, and lifecycle behavior centralized in storage seams.
2. Feature-local path configuration and direct directory writes (rejected): faster initially but creates policy inconsistency, migration fragility, duplicated conventions, and weak decision durability.
3. Hybrid model with managed storage optional per feature (rejected): enables incremental adoption but preserves architecture ambiguity and split behavior between managed and unmanaged storage paths.
4. Per-backend feature adapters without common storage management layer (rejected): preserves backend flexibility but duplicates lifecycle/access logic across features and reduces user-facing consistency.

## Chosen Approach

Storage instances are provisioned and managed through domain entities, application use cases, and backend adapter orchestration. Storage lifecycle (`provisioning`, `active`, `failed`, and related transitions), access summaries, policy metadata, and capability health remain authoritative contracts that feature slices consume.

Directory conventions are managed backend details and logical key policies resolved through storage services, not free-form feature path contracts. User-facing storage behavior (create, activate/deactivate, status/health, policy-constrained usage) must stay on stable API/UI abstractions instead of raw path input.

## Consequences

- Provisioned storage instances are the durable unit of ownership, lifecycle, and operational status; provisioning outcomes must persist as authoritative instance state.
- Directory conventions are standardized through managed backend adapters and logical object key resolution, reducing per-feature path sprawl.
- User-facing storage abstractions stay consistent across API/UI surfaces, with explicit actions and access posture instead of hidden path assumptions.
- Storage policy, tenancy, and audit controls remain enforceable from one place for assets, workflow outputs, and runtime artifacts.
- Tradeoff: feature work must integrate through storage contracts, which adds upfront design rigor versus direct local path writes.
- Risk: path-first legacy flows require targeted migration and can expose implicit directory assumptions.

## Related Documentation

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/architecture/storage-foundation.ai.md`
- `docs/architecture/storage-provisioning-orchestration.ai.md`
- `docs/architecture/storage-application-ports.ai.md`
- `docs/architecture/storage-logical-access-resolution.ai.md`
- `docs/architecture/storage-access-semantics.ai.md`
- `docs/architecture/storage-feature-extension-guidance.ai.md`
- `docs/storage-administration-operations.ai.md`
- `docs/context/packs/architecture-core.pack.ai.md`
- `docs/context/context-map.ai.md`

## Related Code Paths

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/use-cases/StorageManagementService.ts`
- `src/application/storage/use-cases/CreateStorageInstanceWithProvisioningUseCase.ts`
- `src/application/storage/use-cases/StorageLogicalAccessResolutionService.ts`
- `src/infrastructure/storage/StorageBackendAdapterRegistry.ts`
- `src/infrastructure/storage/StorageBackendProvisioningOrchestrator.ts`
- `src/infrastructure/api/storage/StorageManagementBackendApi.ts`
- `src/ui/services/StorageAdministrationService.ts`

## Follow-Up Actions

- Use this ADR as a review gate for proposals that reintroduce direct filesystem path contracts in feature slices.
- Keep storage architecture docs and extension guidance linked back to this ADR under `## Related ADRs`.
- Track migration from legacy path-first behavior to managed logical storage references where needed.
