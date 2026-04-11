---
title: "AI Companion: Architecture Documentation Router"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - src/composition
---

# AI Companion: Architecture Documentation Router

## Audience
- AI assistants answering architecture questions.
- Engineers validating where architecture authority lives.

## Purpose
- Fast routing to canonical architecture contracts in `docs/architecture/`.

## Belongs Here
- Architecture baselines for domain, application, infrastructure, UI composition, and host runtime boundaries.
- Feature architecture contracts that define durable behavior and extension constraints.
- Cross-cutting architecture references reused by contributor and operations docs.

## Does Not Belong Here
- Operational runbooks and troubleshooting procedures.
- Contributor workflow playbooks or implementation checklists.
- Historical baseline snapshots kept for migration history only.

## ADR Linking Expectations
- Architecture docs and ADRs are connected decision memory.
- If an architecture doc is constrained by a decision, add `## Related ADRs` with direct links to `docs/adr/records/adr-<NNN>-<decision-slug>.ai.md`.
- Keep reverse links in ADR `## Related Documentation` so architecture contracts and decision rationale stay paired.

## Start Here
- [Domain And Application Core](./domain-and-application-core.md)
- [Layers And Boundaries](./layers-and-boundaries.md)
- [Workflow Execution And Tools](./workflow-execution-and-tools.md)
- [Desktop Runtime And Hosts](./desktop-runtime-and-hosts.md)
- [Contributors Router](../contributors/README.ai.md)
- [Operations Router](../operations/README.ai.md)
