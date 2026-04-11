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

## Seed Scope Guidance

- Seed references around run lifecycle state transitions and scheduling decision contracts.
- Capture where policy-aware scheduling consumes governance constraints from deployment-policy-and-audit-governance.
- Keep payload-level transport contracts outside this domain and link to api-and-transport-surfaces.

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

- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)
