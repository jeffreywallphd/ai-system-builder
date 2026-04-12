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
  - docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.md
---

# Domain and Application Core

## Purpose

Define the current authoritative contracts for inner-layer behavior in `src/domain` and `src/application`.

## Active Authority Scope

This document is authoritative for:
- domain aggregate and policy ownership boundaries;
- application use-case orchestration responsibilities;
- dependency direction between inner layers and outer adapters.

This document is not a change log. Historical chronology was moved to:
- `docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.md`

## Domain Core Authority

### Aggregate and invariant ownership
- Domain aggregates own canonical business meaning and invariant enforcement.
- Workflow graph validity, node compatibility, and model compatibility remain domain policy concerns.
- Domain contracts remain host- and transport-agnostic.

### Validation boundary
- Business validation belongs in domain services and entities, not in UI handlers or transport adapters.
- Validation results must stay deterministic and reusable across hosts.

## Application Core Authority

### Use-case orchestration boundary
- Application services orchestrate intent-driven operations over domain models.
- Use cases own policy sequencing, dependency checks, and preparation flows.
- Infrastructure adapters execute I/O but do not redefine business semantics.

### Port and adapter boundary
- Application ports define required external capabilities.
- Concrete repositories, runtimes, and external clients are supplied by composition roots.
- Application read models may project representations but must not mutate canonical truth.

## Layering and Dependency Direction

Required direction:
- `src/domain` has no dependency on `src/application`, `src/infrastructure`, `src/ui`, or host code.
- `src/application` depends on `src/domain` and application contracts only.
- `src/infrastructure`, `src/hosts`, and `src/ui` consume inner-layer contracts through ports and composition.

## Canonical Cross-References

- Domain boundary overview:
  `docs/architecture/domains/core-platform-and-composition/overview.md`
- Layer direction rules:
  `docs/architecture/domains/core-platform-and-composition/references/layer-direction-and-dependency-rules.md`
- Runtime host boundary companion:
  `docs/architecture/desktop-runtime-and-hosts.md`

## Historical Material

Historical direction-by-direction implementation chronology is preserved in:
- `docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.md`
