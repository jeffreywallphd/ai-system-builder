# Storage Access Semantics

This note documents Story 9.1.5 (Feature 9 / Epic 9.1): managed storage permission surface and access summaries.

## Canonical artifacts

- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/ports/StorageAccessSummaryPort.ts`
- `src/application/storage/ports/StoragePolicyEvaluationPort.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- `src/shared/dto/storage/tests/StorageTransportDtos.test.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`

## Scope and intent

- Formalize storage-facing access summaries as authoritative contracts for API and admin responses.
- Represent ownership, workspace scope, effective action permissions, allowed actions, and policy-restricted capabilities.
- Keep authorization decisions behind application policy evaluation seams; no UI-specific authorization booleans are authoritative.

## Canonical storage actions

The storage domain now defines stable action identifiers for permission summaries:

- `view`
- `update-metadata`
- `provision`
- `activate`
- `deactivate`
- `use-for-assets`

These actions are represented in domain constants (`StorageManagedActions`), application access summary contracts, and shared transport schemas.

## Access summary contract posture

`StorageInstanceAccessSummary` (application) and `StorageAccessSummaryDto` (shared transport) carry:

- ownership/workspace context: `workspaceId`, `ownerUserIdentityId`, optional `actorUserIdentityId`, `isOwner`
- access policy context: `mode`, `scope`
- permission provenance: `source` (`authorization-policy`, `ownership-default`, `mixed`, `unknown`)
- per-action effective permissions (`allowed`/`denied`/`restricted`/`unknown`) with optional reason metadata
- `allowedActions` for direct action gating in clients/API consumers
- policy-restricted capability summaries (for example preview decryption, worker decryption, cross-workspace reads, mutable writes)

## Mapping and validation posture

- DTO projection maps domain storage + optional authorization outputs into access summaries.
- Policy-restricted capability defaults are computed from storage policy metadata when explicit policy outputs are absent.
- Schema contracts validate access summary structure and invariants:
  - `allowedActions` must be backed by `effectivePermissions` entries marked `allowed`
  - detail access context must match storage ownership/workspace identity fields
  - read-only mode cannot advertise `update-metadata` as allowed

## Boundary posture

- Access summaries are representation contracts, not enforcement engines.
- Authorization remains delegated to `IStoragePolicyEvaluationPort` and future authorization adapters.
- Transport contracts are suitable for authoritative API/admin responses without exposing internal authorization implementation details.

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.md`
