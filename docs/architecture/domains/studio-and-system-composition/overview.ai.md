---
title: "AI Companion: Studio and System Composition Domain Overview"
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

# AI Companion: Studio and System Composition Domain Overview

## Purpose

Define the architecture boundary for studio-and-system-composition and route future migration of flat architecture references into this domain.

## Boundary

- Owns architecture contracts scoped to the studio-and-system-composition domain taxonomy boundary.
- Should reference adjacent domains for cross-boundary behavior instead of duplicating authority.

## Migration Scope

- Promote domain-summary contracts into this overview when migration stories converge documents.
- Move detailed contracts into ./references/ and keep one canonical source per topic.
- Leave existing flat architecture docs in place until migration stories explicitly move them.

## Related ADRs

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

