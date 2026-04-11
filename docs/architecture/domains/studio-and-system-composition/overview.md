---
title: Studio and System Composition Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/studio-shell
  - src/application/system-studio
  - src/application/workflow-studio
---
# Studio and System Composition Domain Overview

## Purpose

Own how studio surfaces compose and present shared system/workflow/asset contracts without becoming separate model authorities.

## Boundary

- Defines studio handoff seams, projection/read-model boundaries, and composition responsibilities across studio surfaces.
- Delegates authoritative run/workspace/security policy to the domains that own those contracts.

## Seed Scope Guidance

- Seed references around studio handoff and projection boundaries that multiple UX surfaces reuse.
- Keep this domain focused on composition contracts, not endpoint payload catalogs.
- Route operational UX workflow procedures to docs/contributors or docs/operations as appropriate.

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

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Studio And System Composition](../../../context/packs/studio-and-system-composition.pack.md)
