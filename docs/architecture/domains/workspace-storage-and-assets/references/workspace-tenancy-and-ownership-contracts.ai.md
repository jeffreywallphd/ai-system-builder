---
title: Workspace Tenancy and Ownership Contracts
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/workspaces
  - src/domain/storage
  - src/domain/assets
---
# Workspace Tenancy and Ownership Contracts

## Context and Scope

This reference defines tenancy and ownership boundaries used by workspace-scoped protected resources. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Workspace lifecycle interfaces define creation, membership management, role transitions, and deactivation.
- Ownership contracts require actor attribution for every protected mutation.
- Shared tenancy metadata contracts define required fields reused by storage and asset resources.

## Data and State Invariants

- Protected resources carry aligned `workspaceId` and ownership metadata.
- Ownership continuity rules prevent ownerless or orphaned workspace states.
- Role transitions preserve admin-capable continuity constraints.

## Failure and Recovery Semantics

- Invalid membership/ownership mutations are rejected before persistence.
- Cross-workspace mutation attempts fail with explicit scope errors.
- Recovery workflows require explicit authoritative actor reassignment, never silent mutation.

## Extension Guardrails

- Add resource types by reusing tenancy metadata contracts, not by creating parallel scope fields.
- Keep policy proofing in identity/security boundaries; this contract defines tenancy authority only.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Workspace Foundation](../../../workspace-foundation.md)
- [Shared Asset Contracts](../../../shared-asset-contracts.md)
- [Workspace Administration Audit Hooks](../../../workspace-administration-audit-hooks.md)

## Related ADRs

- [adr-002-workspace-centered-tenancy-and-resource-ownership.md](../../../../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md)
- [adr-003-storage-as-managed-platform-resource.md](../../../../adr/records/adr-003-storage-as-managed-platform-resource.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
