---
title: Workflow Execution Runtime Handoff
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/workflow-studio
  - src/application/execution
  - src/domain/runs
---
# Workflow Execution Runtime Handoff

## Context and Scope

This reference defines the boundary contract between workflow/system composition and execution control-plane lifecycle authority. Domain boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Workflow/system composition surfaces emit validated execution-intent contracts.
- Control-plane services own acceptance, run identity, lifecycle transitions, and dispatch eligibility.
- Runtime/host adapters execute only after control-plane acceptance and status progression.
- Tool-facing invocation surfaces consume the same handoff contract; they do not introduce a parallel lifecycle model.

## Data and State Invariants

- Handoff payloads preserve workflow/system identity, version context, and workspace scope.
- Accepted runs always receive control-plane-owned run identifiers and lifecycle history.
- Execution status presented to callers is derived from control-plane state, not adapter-local heuristics.

## Failure and Recovery Semantics

- Validation/translation failures block handoff before lifecycle mutation.
- Policy/readiness denial outcomes remain explicit and non-terminally recorded where applicable.
- Retry/relaunch behavior appends lifecycle evidence and cannot overwrite prior run history.

## Extension Guardrails

- Add new handoff fields through versioned control-plane contracts with compatibility checks.
- Keep authoring semantics in studio/system composition references.
- Keep runtime bootstrap and transport details in runtime-host/API domains.

## Canonical Source Documents Migrated into This Reference

- [Workflow Execution and Tools](../../../workflow-execution-and-tools.md)
- [Run Lifecycle State Authority](./run-lifecycle-state-authority.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Workflow and System Composition Contracts](../../studio-and-system-composition/references/workflow-and-system-composition-contracts.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
