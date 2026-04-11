---
title: Workspace Storage and Assets Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/workspaces
  - src/domain/storage
  - src/domain/assets
---
# Workspace Storage and Assets Domain Overview

## Purpose

Define tenancy-centered resource authority for workspaces, managed storage, and asset lifecycle boundaries.

## Domain Summary for Fast Context Selection

- Primary focus: Workspace tenancy authority, managed storage boundaries, and canonical asset lifecycle contracts.
- Boundary line: Owns workspace/resource ownership and asset identity lineage; does not own authentication policy proofing or studio presentation behavior.
- Why it matters: Most protected resources depend on this domain for authoritative ownership and lifecycle truth.
- Context-pack relationship: This overview defines architecture boundaries. Context packs in `docs/context/packs/` assemble task-specific retrieval and should reference this domain instead of duplicating it.

## Scope and System Boundary

In scope:
- Workspace tenancy, membership, and ownership contracts.
- Storage provisioning/access semantics under workspace authority.
- Asset identity, lineage, metadata, and lifecycle boundaries.

Out of scope:
- Authentication/authorization policy proofing.
- Transport endpoint schema details.
- Studio projection and presentation behavior.

## Canonical Responsibilities

- Keep workspace scope and ownership metadata authoritative across protected resources.
- Define managed storage as platform authority, not client-local protected truth.
- Preserve canonical asset lineage independent of UI-specific representation.

## Cross-Cutting Invariants

- Protected resources carry aligned `workspaceId` and ownership metadata.
- Membership and role transitions are explicit and validated.
- Asset lineage/version history remains canonical and auditable.

## Integration and Dependency Boundaries

- `identity-trust-and-security` provides trusted actors and authorization outcomes.
- `deployment-policy-and-audit-governance` consumes workspace-admin events and policy posture dependencies.
- `execution-control-plane-and-scheduling` consumes workspace and asset references for execution lineage.
- `studio-and-system-composition` composes read models without redefining tenancy truth.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Workspace Tenancy and Ownership Contracts](./references/workspace-tenancy-and-ownership-contracts.md)
- [Asset Models and Selection](./references/asset-models-and-selection.md)

## Canonical Source Documents Migrated into This Domain

- [Workspace Foundation](../../workspace-foundation.md)
- [Storage Foundation](../../storage-foundation.md)
- [Shared Asset Contracts](../../shared-asset-contracts.md)
- [Workspace Administration Audit Hooks](../../workspace-administration-audit-hooks.md)

## Related ADRs

- [adr-002-workspace-centered-tenancy-and-resource-ownership.md](../../../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md)
- [adr-003-storage-as-managed-platform-resource.md](../../../adr/records/adr-003-storage-as-managed-platform-resource.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

## Related Contributor and Operations Guidance

- [Workspace Administration Operations](../../../workspace-administration-operations.md)
- [Storage Administration Operations](../../../storage-administration-operations.md)
- [Authorization Sharing Management And Access Review](../../../authorization-sharing-management-and-access-review.md)

## Related Code Paths

- [src/domain/workspaces](../../../../src/domain/workspaces)
- [src/domain/storage](../../../../src/domain/storage)
- [src/domain/assets](../../../../src/domain/assets)
- [src/infrastructure/storage](../../../../src/infrastructure/storage)
