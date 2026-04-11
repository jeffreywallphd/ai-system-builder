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

Own workspace tenancy, storage provisioning, and asset lifecycle boundaries as shared platform resource contracts.

## Boundary

- Defines tenancy/ownership scope, storage access semantics, and asset metadata lifecycle boundaries.
- Delegates security policy proofing to identity-trust-and-security and API wire schemas to api-and-transport-surfaces.

## Seed Scope Guidance

- Start with workspace tenancy and storage access contract references used by multiple feature surfaces.
- Keep this domain focused on durable resource authority rather than UI-level behavior.
- Route operational backup/provisioning procedures to docs/operations instead of duplicating them.

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
