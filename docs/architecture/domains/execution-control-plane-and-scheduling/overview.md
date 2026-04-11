---
title: Execution Control Plane and Scheduling Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/runs
  - src/domain/scheduling
---
# Execution Control Plane and Scheduling Domain Overview

## Purpose

Define control-plane authority for run lifecycle, scheduling policy application, and dispatch/readiness gating.

## Scope and System Boundary

In scope:
- Run state-machine and transition authority boundaries.
- Scheduling policy evaluation and placement contracts.
- Dispatch readiness gates and execution handoff constraints.

Out of scope:
- Workflow authoring semantics and studio composition concerns.
- Endpoint payload formats and transport protocol details.
- Runtime host bootstrap/service-supervision mechanics.

## Canonical Responsibilities

- Preserve explicit lifecycle transition authority for run records.
- Apply policy-aware scheduling decisions with deterministic outcomes.
- Enforce readiness gating before dispatch handoff to execution infrastructure.

## Cross-Cutting Invariants

- Lifecycle transitions require valid current state plus guard-validated transition intent.
- Dispatch metadata appears only in dispatch-eligible states.
- Status history remains chronological and consistent with current status.

## Integration and Dependency Boundaries

- `deployment-policy-and-audit-governance` constrains policy posture for scheduling and lifecycle gates.
- `workspace-storage-and-assets` provides authoritative asset/workspace references.
- `api-and-transport-surfaces` exposes commands/queries without redefining policy.
- `runtime-host-surfaces` executes transport/runtime mechanics under control-plane decisions.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Run Lifecycle State Authority](./references/run-lifecycle-state-authority.md)

## Canonical Source Documents Migrated into This Domain

- [Run Orchestration Domain Foundation](../../run-orchestration-domain-foundation.md)
- [Run Orchestration Queue Assignment Dispatch Control Plane](../../run-orchestration-queue-assignment-dispatch-control-plane.md)
- [Run Orchestration Scheduling Policy Framework and Rule Pipeline](../../run-orchestration-scheduling-policy-framework-and-rule-pipeline.md)
- [Run Submission Domain Foundation](../../run-submission-domain-foundation.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)
