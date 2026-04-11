---
title: Run Lifecycle State Authority
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/runs
  - src/domain/scheduling
---
# Run Lifecycle State Authority

## Context and Scope

This reference defines canonical run lifecycle authority and state-transition contracts for the execution control plane. Boundary context remains in [Domain Overview](../overview.md).

## Contracts and Interfaces

- Run state-machine transitions must be explicit and validated against current state.
- Lifecycle commands are actor-attributed and persisted with ordered history evidence.
- Dispatch and completion semantics are defined by control-plane contracts, not adapter-local logic.

## Data and State Invariants

- Current status always matches the terminal recorded status-history entry.
- Dispatch metadata cannot appear before dispatch-eligible states.
- Run identity, workspace scope, and ownership lineage remain stable across transitions.

## Failure and Recovery Semantics

- Invalid transition requests are rejected without partial state mutation.
- Readiness/policy failures preserve queued/planned state with explicit denial reasons.
- Recovery/retry paths append new lifecycle evidence without erasing prior failures.

## Extension Guardrails

- Add new states only with explicit transition matrices and compatibility review.
- Keep scheduler and transport concerns outside lifecycle authority definitions.
- Keep extensions linked to [Domain Overview](../overview.md) and this contract.

## Canonical Source Documents Migrated into This Reference

- [Run Orchestration Domain Foundation](../../../run-orchestration-domain-foundation.md)
- [Run Orchestration Queue Assignment Dispatch Control Plane](../../../run-orchestration-queue-assignment-dispatch-control-plane.md)
- [Run Submission Domain Foundation](../../../run-submission-domain-foundation.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../../context/packs/repository-overview.pack.md)

## References

- [Domain Overview](../overview.md)
- [Domain References Index](./README.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
