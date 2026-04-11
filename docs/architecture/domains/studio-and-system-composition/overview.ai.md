---
title: "AI Companion: Studio and System Composition Domain Overview"
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
# AI Companion: Studio and System Composition Domain Overview

## Purpose

Own how studio surfaces compose and present shared system/workflow/asset contracts without becoming separate model authorities.

## Boundary

- Defines studio handoff seams, projection/read-model boundaries, and composition responsibilities across studio surfaces.
- Delegates authoritative run/workspace/security policy to the domains that own those contracts.

## Foundational Concepts

- Studios are views over shared platform models; studio-specific workflows cannot fork authoritative resource semantics.
- Cross-studio handoff contracts are canonical for create/select/return/resume flows, with explicit origin, target, and outcome metadata.
- Workflow Studio, Data Studio, and system runtime windows compose shared contracts through typed adapters and restoration services.
- Selector and handoff lifecycle states are explicit (`created`, `cancelled`, `no-selection`, `abandoned`) and correlation-safe for multi-session behavior.
- Runtime and asset-authoring projections are composition seams; authoritative persistence and lifecycle policy remain in owning domains.

## Domain-Wide Invariants

- Studio state restoration and handoff application must be contract-validated before mutating draft/session state.
- Projection services may transform views but cannot redefine workflow, run, workspace, or identity truth.
- Cross-studio launch/return paths must remain resilient to stale or mismatched handoff context.
- UI composition behavior must stay layered: presentation concerns in studio surfaces, policy in shared application/domain seams.

## Cross-Domain Dependency Rules

- `core-platform-and-composition` owns canonical workflow/system semantics consumed by studio composition.
- `workspace-storage-and-assets` owns asset identity/version/workspace ownership semantics used in selectors and authoring.
- `execution-control-plane-and-scheduling` owns run execution lifecycle once studio flows submit executable work.
- `api-and-transport-surfaces` owns authoritative route/event contracts used by studio clients.

## Seed Scope Guidance

- Seed references around studio handoff and projection boundaries that multiple UX surfaces reuse.
- Keep this domain focused on composition contracts, not endpoint payload catalogs.
- Route operational UX workflow procedures to docs/contributors or docs/operations as appropriate.

## Canonical Source Documents Migrated into This Overview

- [Studio Handoff Contract](../../studio-handoff-contract.md)
- [Presentation and State](../../presentation-and-state.md)
- [Image System Domain Foundation](../../image-system-domain-foundation.md)
- [Workflow Execution and Tools](../../workflow-execution-and-tools.md)

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

- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Studio And System Composition](../../../context/packs/studio-and-system-composition.pack.md)

