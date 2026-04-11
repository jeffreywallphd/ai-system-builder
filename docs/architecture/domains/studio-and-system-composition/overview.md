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

Define the architecture boundary for studio-and-system-composition and route domain-scoped architecture knowledge into predictable overview and reference documents.

## Boundary

- Owns architecture contracts scoped to the studio-and-system-composition taxonomy boundary.
- Links to adjacent domains for cross-boundary behavior instead of duplicating authority.

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in `./references/`.

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

