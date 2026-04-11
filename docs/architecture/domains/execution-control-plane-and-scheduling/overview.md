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

## Domain Summary for Fast Context Selection

- Primary focus: Authoritative run lifecycle transitions, scheduling policy decisions, and dispatch-readiness gating.
- Boundary line: Owns control-plane lifecycle and scheduling authority; does not own studio authoring semantics or transport protocol details.
- Why it matters: This domain determines whether and when workloads execute, so boundary errors can cause incorrect or unsafe execution behavior.
- Context-pack relationship: This overview defines architecture boundaries. Context packs in `docs/context/packs/` assemble task-specific retrieval and should reference this domain instead of duplicating it.

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

## Domain Boundary Notes for Common Confusion

- `execution-control-plane-and-scheduling` vs `runtime-host-surfaces`: this domain decides lifecycle transitions, scheduling posture, and dispatch eligibility; runtime hosts execute those approved decisions without becoming lifecycle authority.
- `execution-control-plane-and-scheduling` vs `studio-and-system-composition`: this domain owns submission-to-dispatch state authority; studios own authoring and handoff UX contracts before authoritative run control begins.
- `execution-control-plane-and-scheduling` vs operations docs: this overview defines architecture authority boundaries; procedure and troubleshooting guidance belongs in `docs/operations/` and contributor guides.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Run Lifecycle State Authority](./references/run-lifecycle-state-authority.md)
- [Workflow Execution Runtime Handoff](./references/workflow-execution-runtime-handoff.md)

## Canonical Source Documents Migrated into This Domain

- [Run Orchestration Domain Foundation](../../run-orchestration-domain-foundation.md)
- [Run Orchestration Queue Assignment Dispatch Control Plane](../../run-orchestration-queue-assignment-dispatch-control-plane.md)
- [Run Orchestration Scheduling Policy Framework and Rule Pipeline](../../run-orchestration-scheduling-policy-framework-and-rule-pipeline.md)
- [Run Submission Validation Policy Eligibility](../../run-submission-validation-policy-eligibility.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

## Related Contributor and Operations Guidance

- [Run Orchestration Contributor Guide](../../../run-orchestration-contributor-guide.md)
- [Run Submission Contributor Guide](../../../run-submission-contributor-guide.md)
- [Governance Audit Review Workflows](../../../governance-audit-review-workflows.md)

## Related Code Paths

- [src/domain/runs](../../../../src/domain/runs)
- [src/domain/scheduling](../../../../src/domain/scheduling)
- [src/application/runs](../../../../src/application/runs)
- [src/application/scheduling](../../../../src/application/scheduling)
