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
