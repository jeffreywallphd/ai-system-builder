---
title: Runtime Host Surfaces Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - electron/main
---

# Runtime Host Surfaces Domain Overview

## Purpose

Define the architecture boundary for runtime-host-surfaces and route future migration of flat architecture references into this domain.

## Boundary

- Owns architecture contracts scoped to the runtime-host-surfaces domain taxonomy boundary.
- Should reference adjacent domains for cross-boundary behavior instead of duplicating authority.

## Migration Scope

- Promote domain-summary contracts into this overview when migration stories converge documents.
- Move detailed contracts into ./references/ and keep one canonical source per topic.
- Leave existing flat architecture docs in place until migration stories explicitly move them.

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)

