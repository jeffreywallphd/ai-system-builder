---
title: "AI Companion: Execution Control Plane and Scheduling Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/runs
  - src/domain/scheduling
---
# AI Companion: Execution Control Plane and Scheduling Domain Overview

## Purpose

Own control-plane authority for run lifecycle transitions, scheduling policy application, and execution readiness gating.

## Boundary

- Defines run submission and orchestration authority, queueing/dispatch constraints, and scheduler decision boundaries.
- Delegates workflow modeling to studio-and-system-composition and shared domain model policy to core-platform-and-composition.

## Foundational Concepts

- Run records are authoritative lifecycle entities with explicit state transitions, timestamps, status history, and actor attribution.
- Queue assignment and dispatch are control-plane concerns; adapters and execution nodes receive commands but do not redefine lifecycle truth.
- Scheduling decisions are policy-aware and consume governance constraints while remaining separate from transport mechanics.
- Image-run and generic-run models share one orchestration posture: explicit ownership scope, logical asset references, and deterministic transition guards.
- Failure, degraded, and partial outcomes are first-class lifecycle states with required failure summary semantics.

## Domain-Wide Invariants

- Run lifecycle transitions are explicit and must pass transition guards before persistence.
- Dispatch/linkage metadata cannot appear before the lifecycle reaches appropriate states.
- Status history is chronological and must terminate at the current status.
- Scheduling and orchestration policy belongs in domain/application seams, not in UI or adapter-local branches.

## Cross-Domain Dependency Rules

- `deployment-policy-and-audit-governance` constrains scheduling and execution posture through policy families and governance hooks.
- `studio-and-system-composition` and `workspace-storage-and-assets` provide workflow/asset/resource references consumed during submission and execution.
- `api-and-transport-surfaces` exposes command/query endpoints and events without redefining lifecycle policy.
- `runtime-host-surfaces` and adapter infrastructure execute transport/runtime mechanics under control-plane authority.

## Seed Scope Guidance

- Seed references around run lifecycle state transitions and scheduling decision contracts.
- Capture where policy-aware scheduling consumes governance constraints from deployment-policy-and-audit-governance.
- Keep payload-level transport contracts outside this domain and link to api-and-transport-surfaces.

## Canonical Source Documents Migrated into This Overview

- [Run Orchestration Domain Foundation](../../run-orchestration-domain-foundation.md)
- [Run Orchestration Queue Assignment Dispatch Control Plane](../../run-orchestration-queue-assignment-dispatch-control-plane.md)
- [Run Orchestration Scheduling Policy Framework and Rule Pipeline](../../run-orchestration-scheduling-policy-framework-and-rule-pipeline.md)
- [Run Submission Domain Foundation](../../run-submission-domain-foundation.md)

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in ./references/.

## What Does Not Belong in the Overview

- Endpoint-level schemas, API payload matrices, and low-level interface catalogs.
- Step-by-step operational runbooks and troubleshooting procedures.
- Contributor process checklists, implementation task plans, or release notes.

## Related Domain References

- [Domain References Index](./references/README.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

