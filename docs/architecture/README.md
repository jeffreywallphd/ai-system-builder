---
title: Architecture Documentation Router
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - src/composition
---

# Architecture Documentation Router

## Audience
- Engineers defining or reviewing system design contracts.
- Contributors mapping feature work to architectural boundaries.

## Purpose
- Canonical architecture baselines and design contracts for AI Loom Studio.

## Belongs Here
- Layer boundaries, domain/application/infrastructure contracts, and host composition rules.
- Feature architecture baselines that define durable implementation direction.
- Cross-cutting architecture references used by contributors and operators.

## Does Not Belong Here
- Step-by-step operational runbooks.
- Contributor workflow checklists and coding process guides.
- Historical snapshots that exist only for migration traceability.

## ADR Linking Expectations
- Architecture docs and ADRs are bi-directional companions, not separate archives.
- When a domain/reference doc is shaped by a decision record, include a `## Related ADRs` section with direct links to `docs/adr/records/adr-<NNN>-<decision-slug>.md`.
- When authoring new decisions, ensure the matching ADR `## Related Documentation` links back to the impacted architecture docs.

## Start Here
- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Architecture Domain Folders](./domains/README.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)
- [Domain Document Pattern](./domains/README.md#standard-domain-document-pattern)
- [Domain And Application Core](./domain-and-application-core.md)
- [Layers And Boundaries](./layers-and-boundaries.md)
- [Workflow Execution And Tools](./workflow-execution-and-tools.md)
- [Desktop Runtime And Hosts](./desktop-runtime-and-hosts.md)
- [Contributors Router](../contributors/README.md)
- [Operations Router](../operations/README.md)
