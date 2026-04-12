---
title: Studio Handoff and Boundary Contracts
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/studio-shell
  - src/application/system-studio
  - src/application/workflow-studio
---
# Studio Handoff and Boundary Contracts

## Context and Scope

This reference defines cross-studio handoff contracts and composition boundary responsibilities. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Handoff contract payloads include origin, target, correlation, intent, and optional selection context.
- Canonical outcomes are `created`, `cancelled`, `no-selection`, and `abandoned`.
- Studio orchestration services own contract validation before state restoration or handoff application.

## Data and State Invariants

- Handoff contexts preserve canonical IDs and correlation metadata across surfaces.
- Mismatched or stale handoff context cannot directly mutate draft or session state.
- Projection layers may reshape handoff display details but cannot alter canonical handoff authority.

## Failure and Recovery Semantics

- Invalid handoff payloads resolve to safe non-mutating outcomes with explicit failure reasons.
- Target studio unavailability returns handoff-failed outcomes rather than silent fallback behavior.
- Recovery paths preserve originating context and allow explicit resume/retry.

## Extension Guardrails

- Add new studio surfaces by extending canonical handoff contracts, not by introducing parallel handoff protocols.
- Keep lifecycle policy and persistence authority in owning domains.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Studio Handoff Contract](../../../studio-handoff-contract.md)
- [Presentation and State](../../../presentation-and-state.md)
- [Workflow Execution and Tools](../../../workflow-execution-and-tools.md)

## Related ADRs

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Studio And System Composition](../../../../context/packs/studio-and-system-composition.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
