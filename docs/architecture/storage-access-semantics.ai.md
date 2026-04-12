# AI Companion: Storage Access Semantics

## Purpose

Story 9.1.5 adds storage-specific permission/access summary contracts so managed storage listing/detail and actions can expose authorization-aware posture without embedding authorization logic in UI booleans.

## Canonical files

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/ports/StorageAccessSummaryPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`

## What is represented

- Canonical storage actions:
  - `view`
  - `update-metadata`
  - `provision`
  - `activate`
  - `deactivate`
  - `use-for-assets`
- Access summary context:
  - workspace + owner + optional actor identity
  - access mode/scope
  - ownership indicator (`isOwner`)
  - permission source/provenance
- Effective permissions per action:
  - `allowed`, `denied`, `restricted`, `unknown`
  - optional reason metadata
- Policy-restricted capability summaries:
  - mutable writes
  - cross-workspace reads
  - preview decryption
  - worker decryption

## Enforcement boundary

- These contracts do not authorize by themselves.
- They carry the storage-facing output of policy decisions from `IStoragePolicyEvaluationPort`.
- Shared schema validation enforces shape and consistency invariants (for example `allowedActions` must align to `effectivePermissions`).

## Why this matters

- Provides an authoritative access representation that API/admin screens can trust.
- Gives later stories a stable seam for integrating full authorization engines and policy explainability.

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
