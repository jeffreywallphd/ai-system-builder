---
title: Execution Control Plane and Scheduling Domain References
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/runs
  - src/domain/scheduling
---
# Execution Control Plane and Scheduling Domain References

## Purpose

Index durable contract-level architecture references for `execution-control-plane-and-scheduling` while keeping domain-boundary narrative in [Domain Overview](../overview.md).

## Reference Scope

- Run lifecycle state authority contracts.
- Scheduling policy evaluation and placement contracts.
- Dispatch readiness and execution handoff contracts.

## Canonical Reference Documents

- [Run Lifecycle State Authority](./run-lifecycle-state-authority.md)
- [Workflow Execution Runtime Handoff](./workflow-execution-runtime-handoff.md)

## Migration Backlog (Not Yet Canonical)

- `scheduling-policy-application-contracts.md`
- `execution-readiness-and-dispatch-gates.md`

## Reference Authoring Guardrails

- Keep one durable contract surface per reference file.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Keep runbooks in `docs/operations/` and workflow guidance in `docs/contributors/`.

## Related Documentation

- [Domain Overview](../overview.md)
- [Architecture Domain Cross-Linking Rules](../../../architecture-domain-cross-linking-rules.md)
