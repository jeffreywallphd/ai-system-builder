---
title: "AI Companion: Workspace Storage and Assets Domain Overview"
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
# AI Companion: Workspace Storage and Assets Domain Overview

## Purpose

Own workspace tenancy, storage provisioning, and asset lifecycle boundaries as shared platform resource contracts.

## Boundary

- Defines tenancy/ownership scope, storage access semantics, and asset metadata lifecycle boundaries.
- Delegates security policy proofing to identity-trust-and-security and API wire schemas to api-and-transport-surfaces.

## Foundational Concepts

- Workspace is the tenancy anchor for protected resources, with explicit lifecycle, membership, role, and invitation models.
- Shared workspace ownership metadata is reused across resources so workspace scope, ownership, visibility, and mutation attribution stay consistent.
- Storage is a managed platform resource: provisioning, access semantics, and persistence contracts are explicit and policy-aware.
- Asset lifecycle contracts preserve canonical logical identity/version lineage independent of UI-specific representations.
- Workspace administration flows are application-orchestrated and audit-hooked, with transport and UI consuming those stable seams.

## Domain-Wide Invariants

- Protected resources must carry workspace scope and ownership metadata with consistent `workspaceId` alignment.
- Workspace lifecycle and membership/role transitions are explicit and guard-validated.
- Role governance must preserve required admin/owner continuity; invalid ownership states are rejected.
- Storage and asset contracts remain authoritative in this domain; client-local persistence cannot become protected truth.

## Cross-Domain Dependency Rules

- `identity-trust-and-security` provides authenticated actors and authorization decisions for workspace-admin actions.
- `deployment-policy-and-audit-governance` provides governance policy posture and consumes administration audit events.
- `studio-and-system-composition` may compose asset/workspace data for authoring experiences but must not redefine tenancy invariants.
- `execution-control-plane-and-scheduling` consumes workspace and asset references for run execution lineage.

## Seed Scope Guidance

- Start with workspace tenancy and storage access contract references used by multiple feature surfaces.
- Keep this domain focused on durable resource authority rather than UI-level behavior.
- Route operational backup/provisioning procedures to docs/operations instead of duplicating them.

## Canonical Source Documents Migrated into This Overview

- [Workspace Foundation](../../workspace-foundation.md)
- [Storage Foundation](../../storage-foundation.md)
- [Shared Asset Contracts](../../shared-asset-contracts.md)
- [Workspace Administration Audit Hooks](../../workspace-administration-audit-hooks.md)

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in ./references/.

## What Does Not Belong in the Overview

- Endpoint-level schemas, API payload matrices, and low-level interface catalogs.
- Step-by-step operational runbooks and troubleshooting procedures.
- Contributor process checklists, implementation task plans, or release notes.

## Related Domain References

- [Domain References Index](./references/README.md)

## Related ADRs

- [adr-002-workspace-centered-tenancy-and-resource-ownership.md](../../../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md)
- [adr-003-storage-as-managed-platform-resource.md](../../../adr/records/adr-003-storage-as-managed-platform-resource.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

