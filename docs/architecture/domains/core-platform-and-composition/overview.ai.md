---
title: "AI Companion: Core Platform and Composition Domain Overview"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
---
# AI Companion: Core Platform and Composition Domain Overview

## Purpose

Own the inner system model and composition contracts that define platform behavior independently of runtime host adapters.

## Boundary

- Defines domain and application layering invariants, shared model semantics, and composition seams.
- Delegates host startup mechanics to runtime-host-surfaces and transport wire contracts to api-and-transport-surfaces.

## Foundational Concepts

- Domain entities are the durable source of product meaning; application use cases orchestrate those entities through explicit intent-based operations.
- Domain logic owns workflow, graph, compatibility, and validation policy; UI and transport surfaces consume outcomes but do not redefine rules.
- Application ports define required external capabilities (repositories, runtime executors, model/tool registries, context stores), so infrastructure can vary without changing business rules.
- Context assembly is an application concern: it merges packages, recipes, and dynamic context sources into execution-ready envelopes.
- Composition roots wire concrete adapters around stable inner contracts rather than pushing infrastructure concerns inward.

## Domain-Wide Invariants

- Business-policy validation lives in `src/domain` and `src/application`; it is not UI-derived.
- Use cases orchestrate and sequence operations, while infrastructure performs I/O and runtime transport.
- Projection and translation services can reshape data for specific surfaces but cannot mutate domain truth.
- Cross-feature expansion should preserve the same inner-layer shape: domain model plus application orchestration plus outer adapters.

## Cross-Domain Dependency Rules

- `runtime-host-surfaces` may compose and initialize inner services but must not redefine inner business policy.
- `studio-and-system-composition` may project/compose workflow and asset models but must not become a parallel model authority.
- `execution-control-plane-and-scheduling` consumes workflow/context contracts but owns run lifecycle and dispatch policy.
- `api-and-transport-surfaces` exposes authoritative operations and must keep DTO/schema contracts aligned to inner-layer semantics.

## Seed Scope Guidance

- Start migration with layer boundary and composition root contracts that multiple domains depend on.
- Keep this overview as the single boundary authority and route detail into focused reference docs.
- Avoid duplicating runtime bootstrap, route payload, or runbook details here.

## Canonical Source Documents Migrated into This Overview

- [Domain and Application Core](../../domain-and-application-core.md)
- [Layers and Boundaries](../../layers-and-boundaries.md)
- [Persistent Platform Domain Boundaries](../../persistent-platform-domain-boundaries.md)

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
- [adr-004-studios-as-views-over-shared-system-and-asset-model.md](../../../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Context System Foundations](../../../context/packs/context-system-foundations.pack.md)

