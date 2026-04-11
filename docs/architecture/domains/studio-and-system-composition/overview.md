---
title: Studio and System Composition Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/ui/studio-shell
  - src/application/system-studio
  - src/application/workflow-studio
---
# Studio and System Composition Domain Overview

## Purpose

Define studio composition boundaries for projecting shared system/workflow/asset models without becoming model authority.

## Scope and System Boundary

In scope:
- Studio handoff contracts across create/select/return/resume flows.
- Projection/read-model composition seams used by studio surfaces.
- Shared composition seams needed for cross-studio interoperability.

Out of scope:
- Authoritative lifecycle policy for run execution.
- Workspace/resource ownership semantics.
- Transport API schema and protocol ownership.

## Canonical Responsibilities

- Keep studio handoff behavior contract-validated and correlation-safe.
- Maintain projection boundaries so composition logic does not mutate canonical truth.
- Preserve reusable seams that keep studio-specific flows aligned with shared contracts.

## Cross-Cutting Invariants

- Projection services transform representation but do not redefine model truth.
- Handoff outcomes are explicit (`created`, `cancelled`, `no-selection`, `abandoned`).
- Restore/apply flows validate incoming contracts before session/draft mutation.

## Integration and Dependency Boundaries

- `core-platform-and-composition` owns shared model semantics consumed by studios.
- `workspace-storage-and-assets` owns asset/workspace authority consumed by selectors.
- `execution-control-plane-and-scheduling` owns run lifecycle once work is submitted.
- `api-and-transport-surfaces` owns authoritative route/event contracts consumed by studio clients.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Studio Handoff and Boundary Contracts](./references/studio-handoff-and-boundary-contracts.md)
- [Studio UI Composition and State](./references/studio-ui-composition-and-state.md)
- [Workflow and System Composition Contracts](./references/workflow-and-system-composition-contracts.md)

## Canonical Source Documents Migrated into This Domain

- [Studio Handoff Contract](../../studio-handoff-contract.md)
- [Presentation and State](../../presentation-and-state.md)
- [Image System Domain Foundation](../../image-system-domain-foundation.md)
- [Workflow Execution and Tools](../../workflow-execution-and-tools.md)

## Related ADRs

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Studio And System Composition](../../../context/packs/studio-and-system-composition.pack.md)

## Related Contributor and Operations Guidance

- [Image Manipulation Loading Status Conventions](../../../image-manipulation-loading-status-conventions.md)
- [Tuning Dataset Studio](../../../tuning-dataset-studio.md)
- [Workspace Administration Operations](../../../workspace-administration-operations.md)

## Related Code Paths

- [src/ui/studio-shell](../../../../src/ui/studio-shell)
- [src/application/system-studio](../../../../src/application/system-studio)
- [src/application/workflow-studio](../../../../src/application/workflow-studio)
- [src/ui/features](../../../../src/ui/features)
