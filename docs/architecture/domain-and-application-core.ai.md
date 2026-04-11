---
title: Domain and Application Core
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
  - docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md
---

# AI Companion: Domain and Application Core

## Core fact

`src/domain` and `src/application` remain the canonical inner layers; outer hosts and adapters must not redefine their policy semantics.

## Active authority scope

Use this doc for current boundaries only:
- domain aggregate/invariant ownership;
- application orchestration and port boundaries;
- dependency direction constraints.

Historical chronology moved to:
- `docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md`

## Domain authority constraints

- Domain entities/services own business semantics and validation rules.
- Compatibility and workflow validity remain domain-owned concerns.
- Domain contracts stay independent of host/runtime/transport details.

## Application authority constraints

- Use cases orchestrate policy-ordered operations over domain models.
- Ports define external capability contracts; adapters implement them.
- Projection/read-model shaping is allowed, but canonical truth mutation is not.

## Required dependency direction

- `src/domain` does not depend on outer layers.
- `src/application` depends on domain and application contracts.
- Infrastructure/UI/host surfaces consume inner contracts through ports and composition roots.

## Canonical links

- `docs/architecture/domains/core-platform-and-composition/overview.md`
- `docs/architecture/domains/core-platform-and-composition/references/layer-direction-and-dependency-rules.md`
- `docs/architecture/desktop-runtime-and-hosts.ai.md`

## Historical material

Full implementation chronology is preserved in:
- `docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md`
