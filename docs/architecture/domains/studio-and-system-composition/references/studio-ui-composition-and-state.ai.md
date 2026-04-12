---
title: Studio UI Composition and State
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/composition
  - src/ui/services
  - src/ui/state
  - src/ui/presenters
---
# Studio UI Composition and State

## Context and Scope

This reference defines studio-facing presentation composition and page-state contracts. Domain boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- UI composition roots provide renderer dependencies without becoming runtime or domain policy authorities.
- UI services expose presentation-facing adapter contracts over application ports.
- Stores manage page/session state and async orchestration for surfaces; they do not own domain truth.
- Presenters/projectors shape UI read models and status summaries for reusable components.

## Data and State Invariants

- Presenter/store state must preserve canonical IDs and correlation metadata from backend/application contracts.
- UI state transitions remain explicit (`idle`, `loading`, `loaded`, `error`) and recoverable.
- UI-side state may cache and project, but cannot redefine lifecycle/policy outcomes.

## Failure and Recovery Semantics

- Missing/invalid contract payloads surface explicit failure states; no silent fall-through to synthetic truth.
- Startup/bootstrap failures remain bounded to presentation-state surfaces with recoverable retry paths.
- Cross-surface session/draft restore failures preserve prior state and require explicit user action.

## Extension Guardrails

- Add new surfaces through shared composition and presenter seams before introducing page-local orchestration.
- Keep runtime policy, tenancy policy, and execution lifecycle authority in their owning domains.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Presentation and State](../../../presentation-and-state.md)
- [Multi-Surface UI Composition Foundation](../../../multi-surface-ui-composition-foundation.md)

## Related ADRs

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Studio And System Composition](../../../../context/packs/studio-and-system-composition.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
