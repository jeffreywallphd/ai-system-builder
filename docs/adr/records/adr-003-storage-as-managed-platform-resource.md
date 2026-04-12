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

AI Loom Studio treats storage as a managed platform capability, not ad hoc per-feature filesystem path configuration. Storage allocation, lifecycle, access semantics, policy posture, and logical object resolution must flow through storage domain/application contracts and managed storage instances. Features that need durable files, assets, workflow artifacts, or runtime outputs must integrate through managed storage abstractions rather than introducing direct path ownership in feature code.

## Context and Problem Statement

Storage behavior now spans systems, workflows, assets, administration, and runtime execution. Without a durable decision of record, implementation tends to drift into path-string shortcuts, feature-local directory conventions, and backend-specific assumptions that are hard to secure, audit, migrate, and operate consistently.

The repository needs one explicit architecture decision that sets storage as a first-class managed platform resource so contributors and AI-assisted implementation do not repeatedly rediscover why storage must remain contract-driven.

## Decision Drivers

- Keep storage semantics consistent across systems, workflows, assets, and runtime services.
- Avoid security, policy, and lifecycle drift caused by feature-local path handling.
- Preserve workspace ownership and policy enforcement posture for all durable storage use.
- Improve operability by centralizing provisioning, lifecycle transitions, capability checks, and auditability.
- Reduce repeated debate over directory conventions and user-facing storage behavior.

## Considered Options

1. Managed storage as a platform resource with typed instances and lifecycle contracts (accepted): centralizes provisioning, policy, access, and lifecycle semantics behind storage domain/application seams.
2. Feature-local path configuration and direct directory writes (rejected): simpler short term, but causes inconsistent policy enforcement, fragile migrations, duplicated conventions, and weak decision durability.
3. Hybrid model with managed storage optional per feature (rejected): permits gradual adoption but preserves architectural ambiguity and creates long-term split behavior between managed and unmanaged storage flows.
4. Per-backend feature adapters with no common storage management layer (rejected): keeps backend flexibility but duplicates lifecycle and access logic across features and weakens user-facing consistency.

## Chosen Approach

Storage instances are provisioned and managed through storage domain entities, application use cases, and backend adapter orchestration. Storage lifecycle (`provisioning`, `active`, `failed`, and related transitions), access summaries, policy metadata, and capability health are authoritative contracts that features consume.

Directory conventions are treated as managed backend details and logical key policies resolved through storage services, not as free-form feature path contracts. User-facing storage interactions (create, activate/deactivate, health/status, and policy-constrained usage) must be represented through stable administration and transport abstractions rather than raw path inputs.

## Consequences

- Provisioned storage instances become the durable unit of storage ownership, lifecycle, and operational status; provisioning outcomes must be reflected in authoritative instance state.
- Directory conventions are standardized through managed backend adapters and logical object key resolution, reducing per-feature directory sprawl and path-coupled behavior.
- User-facing storage abstractions become consistent across API and UI surfaces, with storage actions and access posture exposed through shared contracts instead of hidden path assumptions.
- Storage policy, tenancy, and audit hooks remain enforceable in one place, improving governance for assets, workflow outputs, and runtime artifacts.
- Tradeoff: teams must integrate through storage contracts and orchestration seams, which adds upfront design discipline compared to writing directly to local paths.
- Risk: migration of legacy path-first features requires deliberate refactoring and may expose previously implicit directory assumptions.

## Related Documentation

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/architecture/storage-foundation.md`
- `docs/architecture/storage-provisioning-orchestration.md`
- `docs/architecture/storage-application-ports.md`
- `docs/architecture/storage-logical-access-resolution.md`
- `docs/architecture/storage-access-semantics.md`
- `docs/architecture/storage-feature-extension-guidance.md`
- `docs/storage-administration-operations.md`
- `docs/context/packs/architecture-core.pack.md`
- `docs/context/context-map.md`

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

- Use this ADR as a review gate for proposals that add new direct filesystem path contracts in feature code.
- Keep storage architecture docs and extension guidance linked to this ADR under `## Related ADRs`.
- Track migration of path-first behavior to managed storage logical references where legacy seams still exist.
