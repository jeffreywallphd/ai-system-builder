---
title: Layer Direction and Dependency Rules
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
---
# Layer Direction and Dependency Rules

## Context and Scope

This reference defines dependency direction and boundary contracts for the inner model owned by `core-platform-and-composition`. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Allowed dependency flow is `domain <- application <- infrastructure`.
- Domain contracts define policy and invariants; infrastructure adapters implement ports.
- Translation/anti-corruption adapters are required when external contracts diverge from canonical inner models.

## Data and State Invariants

- Domain model code remains infrastructure-agnostic.
- Application orchestration may compose domain operations but cannot bypass domain guards.
- Adapter-specific DTOs do not leak into domain-level contracts.

## Failure and Recovery Semantics

- Dependency-direction violations are contract failures and must be corrected before merge.
- Layer-bypass shortcuts are treated as architecture regressions, not local optimizations.
- Recovery requires reintroducing the proper port/adapter boundary instead of widening inner-layer dependencies.

## Extension Guardrails

- Add new integrations by introducing ports in inner layers and adapters in outer layers.
- Do not embed transport/runtime/global state concerns into domain entities.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract instead of duplicating boundary summaries.

## Canonical Source Documents Migrated into This Reference

- [Domain and Application Core](../../../domain-and-application-core.md)
- [Layers and Boundaries](../../../layers-and-boundaries.md)
- [Persistent Platform Domain Boundaries](../../../persistent-platform-domain-boundaries.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Context System Foundations](../../../../context/packs/context-system-foundations.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
