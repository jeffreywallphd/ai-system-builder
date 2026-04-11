# Workflow Execution and Tools

## Purpose

Define workflow-to-execution handoff boundaries so workflow authoring contracts, execution control-plane authority, and tool/runtime transport concerns stay explicitly separated.

## Scope Boundaries

In scope:
- Workflow definition and authored execution-intent boundaries.
- Tool projection boundaries for workflow-derived capabilities.
- Handoff contracts from workflow composition into execution control-plane authority.

Out of scope:
- Detailed run state-machine and scheduling policy contracts.
- Runtime host bootstrap and preload bridge behavior.
- Workspace/storage tenancy authority and asset-governance policy.

## Canonical Workflow Handoff Contract

- Workflow authoring remains studio/system composition authority.
- Execution start/read/status authority remains in the execution control plane.
- Tool projection is a representation contract and does not become a separate execution authority.
- Runtime adapters consume execution-control-plane outcomes; they do not redefine lifecycle truth.

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

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md`
