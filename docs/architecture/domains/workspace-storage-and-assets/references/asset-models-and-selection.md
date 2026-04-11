---
title: Asset Models and Selection
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/assets
  - src/application/contracts
  - src/application/assets
---
# Asset Models and Selection

## Context and Scope

This reference defines asset model, selection, and lineage contracts under workspace/storage authority. Domain boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Asset contracts define identity, taxonomy, usage interface, and version linkage.
- Selection interfaces resolve assets by canonical IDs, roles, and bounded query semantics.
- Projection interfaces may add display metadata but must preserve canonical identity/lineage fields.

## Data and State Invariants

- Every asset record remains workspace-scoped and lineage-addressable.
- Version chains are append-only and identity-stable.
- Selection results must remain deterministic for the same filter/scope input.

## Failure and Recovery Semantics

- Invalid asset references fail with explicit not-found/scope-mismatch outcomes.
- Incompatible contract projections fail closed; no implicit fallback contract is fabricated.
- Recovery paths use canonical version/lineage reads rather than reconstructing from presentation state.

## Extension Guardrails

- Extend asset roles via shared taxonomy and contract seams; do not fork per-surface contract models.
- Keep endpoint payload details in API/transport domain docs.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Shared Asset Contracts](../../../shared-asset-contracts.md)
- [Asset Selector Framework](../../../asset-selector-framework.md)
- [Generated Result Asset Domain Foundation](../../../generated-result-asset-domain-foundation.md)

## Related ADRs

- [adr-002-workspace-centered-tenancy-and-resource-ownership.md](../../../../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md)
- [adr-003-storage-as-managed-platform-resource.md](../../../../adr/records/adr-003-storage-as-managed-platform-resource.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Unified API Surface Contracts](../../api-and-transport-surfaces/references/unified-api-surface-contracts.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
