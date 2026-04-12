---
title: "AI Companion: Architecture Document Scope Boundaries"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/README.ai.md
  - docs/architecture/domains/README.ai.md
  - docs/contributors/docs-placement-guide.ai.md
  - docs/operations/README.ai.md
  - docs/baselines/README.ai.md
  - docs/adr/records/README.ai.md
  - docs/context/packs/README.ai.md
  - dev/tests/ArchitectureDocumentScopeBoundariesGuardrails.test.ts
---

# AI Companion: Architecture Document Scope Boundaries

## Purpose

Define strict architecture-doc scope so domainized docs do not regress into broad catch-all narrative files.

## Why This Guardrail Exists

Observed repository regressions include:

- overloaded README files mixing routing, contracts, history, and runbook behavior
- mixed historical and active guidance in the same architecture narrative
- repeated design rationale copied across architecture docs instead of ADR linkage
- implementation-specific sprawl (ticket procedures, temporary patch details, troubleshooting steps) inside architecture references

## Architecture Scope Rules

Architecture docs in `docs/architecture/` should contain:

- boundary contracts, ownership seams, and layer direction
- domain invariants and durable extension seams
- stable host/transport/composition contract guidance
- links to ADR constraints and context packs when relevant

Architecture docs should not contain:

- contributor implementation workflow/checklists
- operational runbook or troubleshooting procedures
- historical baseline snapshots presented as active authority
- duplicated decision rationale that belongs in ADRs
- ticket-level implementation notes and temporary patch narratives

## Where Non-Architecture Content Goes

| Content type | Canonical home | Architecture doc action |
| --- | --- | --- |
| Contributor workflow and implementation guardrails | `docs/contributors/` | Keep contract constraints only; link out. |
| Operational diagnostics and runbook procedures | `docs/operations/` | Keep boundary implications only; link out. |
| Historical migration/completion snapshots | `docs/baselines/` | Remove from active architecture narrative; link baseline. |
| Decision alternatives/rationale history | `docs/adr/records/` | Keep `## Related ADRs`; remove duplicated rationale. |
| Retrieval assembly and context routing guidance | `docs/context/packs/` | Keep concise architecture pointers; link context pack docs. |

## Architecture Anti-Patterns and Corrective Actions

| Anti-pattern | Detection signal | Corrective action |
| --- | --- | --- |
| Router overload | README acts as router + runbook + migration log + deep subsystem reference. | Split into routing README and canonical deep docs; keep links, not duplicates. |
| Historical-active blend | Active architecture doc carries prior-state narrative as current authority. | Move historical sections to `docs/baselines/`; keep active contracts only. |
| Rationale duplication | Decision "why" repeated across architecture docs and ADRs. | Keep rationale in ADR; architecture docs link ADR IDs. |
| Implementation sprawl | Architecture docs include ticket procedures, class-level change logs, temporary patch narratives. | Move implementation workflow to `docs/contributors/`; keep contract-level architecture text. |
| Runbook leakage | Architecture docs include triage commands and operational step ordering. | Move operational content to `docs/operations/`; keep architecture boundaries. |
| Cross-domain contract duplication | Identical contract paragraphs copied across multiple domain docs. | Choose one canonical doc and replace duplicates with links. |

## Migration Triage Rules for Later Stories

1. "How to operate" sections move to `docs/operations/`.
2. "How to implement" sections move to `docs/contributors/`.
3. Historical-only completion content moves to `docs/baselines/`.
4. Decision rationale sections move to ADRs; architecture docs keep references.
5. Retrieval assembly guidance stays in `docs/context/packs/`.
6. Remaining architecture content is rewritten as stable boundary/invariant contracts.

## Authoring Rules

- Keep architecture docs contract-first and boundary-scoped.
- Prefer short durable contract statements over procedural narrative.
- Link to canonical docs instead of copying cross-area content.
- Split oversized mixed-authority architecture docs during migration.
- Keep `.md` and `.ai.md` files aligned so human and AI readers share the same boundary rules.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Folders](./domains/README.md)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md)
- [Operations Router](../operations/README.ai.md)
- [Baselines Router](../baselines/README.ai.md)
- [ADR Records Router](../adr/records/README.ai.md)
- [Context Packs Router](../context/packs/README.ai.md)
