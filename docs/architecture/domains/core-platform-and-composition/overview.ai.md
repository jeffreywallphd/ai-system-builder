---
title: Core Platform and Composition Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
---
# Core Platform and Composition Domain Overview

## Purpose

Define the stable inner-system model and composition boundaries that all other architecture domains consume.

## Scope and System Boundary

In scope:
- Domain and application layering contracts.
- Composition-root ownership of port wiring and adapter assembly.
- Shared model invariants reused by feature domains.

Out of scope:
- Runtime startup mechanics and host lifecycle sequencing.
- Transport protocol and endpoint payload contracts.
- Operations runbooks and contributor workflow process.

## Canonical Responsibilities

- Preserve dependency direction and layer ownership across `src/domain` and `src/application`.
- Keep business semantics independent from host/transport adapters.
- Provide composition contracts that allow runtime-specific wiring without policy drift.

## Cross-Cutting Invariants

- Business-policy validation lives in inner layers, not UI or transport handlers.
- Use cases orchestrate intent; infrastructure executes I/O.
- Projection helpers can reshape representation but cannot mutate canonical truth.

## Integration and Dependency Boundaries

- `runtime-host-surfaces` composes inner services but does not redefine policy.
- `studio-and-system-composition` consumes shared model contracts as view composition seams.
- `execution-control-plane-and-scheduling` owns run lifecycle authority.
- `api-and-transport-surfaces` exposes inner semantics through transport-safe contracts.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Layer Direction and Dependency Rules](./references/layer-direction-and-dependency-rules.md)

## Canonical Source Documents Migrated into This Domain

- [Domain and Application Core](../../domain-and-application-core.md)
- [Layers and Boundaries](../../layers-and-boundaries.md)
- [Persistent Platform Domain Boundaries](../../persistent-platform-domain-boundaries.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Context System Foundations](../../../context/packs/context-system-foundations.pack.md)

## Related Contributor and Operations Guidance

- [ADR-Informed Implementation and Review Examples](../../../contributors/adr-informed-implementation-and-review-examples.md)
- [Documentation Placement Guide](../../../contributors/docs-placement-guide.md)
- [Operations Router](../../../operations/README.md)

## Related Code Paths

- [src/domain](../../../../src/domain)
- [src/application](../../../../src/application)
- [src/infrastructure/composition](../../../../src/infrastructure/composition)
