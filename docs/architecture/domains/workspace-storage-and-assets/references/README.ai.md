---
title: Workspace Storage and Assets Domain References
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
# Workspace Storage and Assets Domain References

## Purpose

Index durable contract-level architecture references for `workspace-storage-and-assets` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Workspace tenancy and ownership contracts.
- Storage provisioning and access semantics contracts.
- Asset lifecycle and metadata authority contracts.

## Canonical Reference Documents

- [Workspace Tenancy and Ownership Contracts](./workspace-tenancy-and-ownership-contracts.md)

## Migration Backlog (Not Yet Canonical)

- `storage-provisioning-and-access-semantics.md`
- `asset-lifecycle-and-metadata-boundaries.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
