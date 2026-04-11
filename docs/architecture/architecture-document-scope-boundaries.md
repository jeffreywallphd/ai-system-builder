---
title: Architecture Document Scope Boundaries
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/README.md
  - docs/architecture/domains/README.md
  - docs/contributors/docs-placement-guide.md
  - docs/operations/README.md
  - docs/baselines/README.md
  - docs/adr/records/README.md
  - docs/context/packs/README.md
  - dev/tests/ArchitectureDocumentScopeBoundariesGuardrails.test.ts
---

# Architecture Document Scope Boundaries

## Purpose

Define explicit boundaries for architecture documents so domainized architecture guidance remains focused, durable, and migration-friendly instead of drifting back into catch-all narrative files.

## Why This Guardrail Exists

Architecture documentation in this repository has repeatedly accumulated:

- overloaded README files that try to be routers, design contracts, migration history, and runbooks at once
- mixed historical and active guidance in the same "current" architecture narrative
- repeated design rationale copied across architecture references instead of anchored to ADRs
- implementation-specific sprawl (ticket-level plans, class-level patch notes, troubleshooting steps) inside architecture documents

This guidance makes those failure modes explicit and prevents reintroduction during migration work.

## Architecture Scope Rules

Architecture documents in `docs/architecture/` should contain:

- system boundary contracts, ownership seams, and layering direction
- domain-level invariants and extension seams
- transport, host, and composition contracts that are stable beyond one story
- concise references to ADR constraints and related context packs

Architecture documents should not contain:

- contributor execution checklists, step-by-step implementation workflow, or code-review process rules
- operational runbooks, incident response procedures, live diagnostics, or recovery playbooks
- migration completion snapshots or historical baseline handoff details presented as active authority
- decision alternatives/rationale history duplicated from ADRs
- ticket-by-ticket implementation details, temporary patch narratives, or low-level code walkthroughs that are not durable contracts

## Where Non-Architecture Content Goes

When content does not belong in architecture docs, move it to the canonical home and link back:

| Content type | Canonical home | Action from architecture docs |
| --- | --- | --- |
| Contributor implementation workflow, coding guardrails | `docs/contributors/` | Keep only architecture contract constraints; link to contributor guidance. |
| Operational steps, troubleshooting, diagnostics | `docs/operations/` | Keep only operational boundary contracts; link to runbook. |
| Historical migration snapshots and completion artifacts | `docs/baselines/` | Keep current architecture contract only; link to baseline artifact. |
| Durable decision rationale, alternatives, and status history | `docs/adr/records/` | Keep `## Related ADRs` links; remove duplicated rationale narrative. |
| Retrieval assembly notes, prompt routing context packs | `docs/context/packs/` | Keep architecture references concise; link to context pack contract. |

## Architecture Anti-Patterns and Corrective Actions

| Anti-pattern | Detection signal | Corrective action |
| --- | --- | --- |
| Router overload | `README.md` combines start-here links with runbook steps, migration logs, and detailed subsystem internals. | Split into routing-first README and separate canonical docs; preserve links only. |
| Historical-active blend | Current architecture doc includes "previous state" narrative as equal authority with active contract statements. | Move historical sections to `docs/baselines/`; keep active contract text in architecture doc. |
| Rationale duplication | Same "why" decision narrative appears across multiple architecture docs and ADRs. | Keep rationale in ADR; architecture docs reference ADR IDs in `## Related ADRs`. |
| Implementation sprawl | Architecture reference expands into ticket/task procedures, class-by-class changes, or temporary fix notes. | Move implementation workflow to `docs/contributors/`; keep architecture doc at contract level. |
| Runbook leakage | Architecture doc includes failure triage commands, step sequencing, or on-call procedures. | Move operational procedures to `docs/operations/`; leave only architecture boundary implications. |
| Cross-domain contract duplication | Same contract paragraph is copied into multiple domain docs as if each is canonical. | Keep one canonical architecture location and replace duplicates with links. |

## Migration Triage Rules for Later Stories

Use these rules when deciding what to migrate, split, or relocate during domainization:

1. If a document section explains "how to operate" rather than "how the system is bounded," move it to `docs/operations/`.
2. If a section explains "how contributors should implement/change code," move it to `docs/contributors/`.
3. If a section is historical-only evidence of completion or past state, move it to `docs/baselines/`.
4. If a section's primary value is alternatives and rationale for a decision, create or update an ADR and link from architecture docs.
5. If a section is primarily retrieval context assembly guidance, keep it in `docs/context/packs/` and link.
6. If a section must remain in architecture docs, rewrite it as a stable contract/invariant statement with explicit boundaries.

## Authoring Rules That Keep Architecture Docs Focused

- Keep architecture docs contract-first: scope, invariants, seams, and canonical references.
- Prefer short "what and why boundary" statements over long procedural narratives.
- Require explicit link-outs instead of embedded copies when content belongs to another docs area.
- Treat oversized architecture docs as split candidates when they mix multiple authorities.
- Keep `.md` and `.ai.md` companions aligned so humans and AI assistants receive the same boundary rules.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Folders](./domains/README.md)
- [Documentation Placement Guide](../contributors/docs-placement-guide.md)
- [Operations Router](../operations/README.md)
- [Baselines Router](../baselines/README.md)
- [ADR Records Router](../adr/records/README.md)
- [Context Packs Router](../context/packs/README.md)
