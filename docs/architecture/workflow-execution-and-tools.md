---
title: Workflow Execution and Tools (Legacy Link Stub)
doc_type: architecture-reference
status: superseded
authoritativeness: historical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
superseded_by: docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md
related_code_paths:
  - docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md
  - docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md
---

# Workflow Execution and Tools

## Supersession Notice

This document is a `migrated-link-stub` and no longer defines canonical architecture behavior.

## Split Routing for Previously Mixed Content

The prior version of this document mixed workflow composition, execution policy, runtime-host mechanics, and API concerns. Canonical authority is now split as follows:

- Workflow and studio composition contracts:
  - `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
- Workflow-to-control-plane execution handoff:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`
- Run lifecycle and control-plane state authority:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/run-lifecycle-state-authority.md`
- Runtime host composition and startup:
  - `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- API and transport boundaries:
  - `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md`

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md`
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md`
