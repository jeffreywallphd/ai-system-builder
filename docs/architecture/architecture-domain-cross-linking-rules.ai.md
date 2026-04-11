---
title: "AI Companion: Architecture Domain Cross-Linking Rules"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/domains/README.ai.md
  - docs/adr/README.ai.md
  - docs/context/packs/README.ai.md
  - docs/baselines/README.ai.md
  - docs/contributors/README.ai.md
  - docs/operations/README.ai.md
  - dev/tests/ArchitectureDomainCrossLinkingRulesGuardrails.test.ts
---

# AI Companion: Architecture Domain Cross-Linking Rules

## Purpose

Define how domainized architecture docs connect to ADRs, context packs, baselines, contributor guidance, and operations docs without turning architecture overviews into dense link indexes.

## Why This Guardrail Exists

- Domainization only improves retrieval/navigation if relationships between doc types stay explicit.
- Flat "related links" sections degrade quickly when they mix design, operations, migration history, and workflow guidance.
- Later migration stories need one stable cross-linking contract so domain folders stay consistent.

## Outbound Links From Architecture Domain Docs

Architecture domain docs point outward only when another doc type is the canonical authority for that concern.

### Domain Overviews (`overview.ai.md`)

- Keep one focused link group per relationship type:
  - `## Related ADRs` for decision constraints in `docs/adr/records/`.
  - `## Related Context Packs` for retrieval assets in `docs/context/packs/`.
  - `## Related Contributor and Operations Guidance` for implementation/runbook docs in `docs/contributors/` and `docs/operations/`.
  - `## Related Baselines` for historical snapshots in `docs/baselines/` when active architecture text references prior-state history.
- Link only canonical routers or high-value canonical docs, not broad file indexes.

### Domain References (`references/README.ai.md` and reference docs)

- Link back inward to `../overview.md` first so boundary context stays primary.
- Add outward links only when the reference contract is constrained by:
  - ADR decisions (`docs/adr/records/`),
  - context retrieval routing quality (`docs/context/packs/`),
  - implementation workflow guardrails (`docs/contributors/`),
  - operational authority boundaries (`docs/operations/`).
- Do not add baseline links unless historical posture is required to interpret active contracts.

## Inbound Links From Neighbor Documentation Types

Neighbor docs should point inward when architecture domain boundaries are required context:

- ADRs: in `## Related Documentation`, link to impacted domain `overview.md` or canonical domain references.
- Context packs: in `## Authoritative Docs`, link to domain overviews/references that define invariants consumed by the pack.
- Baselines: include "current authority" links to active domain docs whenever a baseline captures superseded or prior-state architecture.
- Contributor guides: link to domain overviews/references when implementation constraints are architectural rather than workflow-local.
- Operations docs: link to domain overviews/references where runbook behavior depends on architecture boundaries (for example trust, control-plane authority, tenancy).

## Link Budget and Placement Rules (Findability Without Clutter)

Use these rules to keep cross-linking high-signal:

1. Keep overview-level link sections short; default to three to seven links per section.
2. Prefer router/canonical reference links over long sibling-file lists.
3. Use one link per external authority topic in overviews; move deeper lists to reference docs when necessary.
4. Group links by purpose (`ADRs`, `Context Packs`, `Contributor/Operations`, `Baselines`) instead of one mixed "Related Docs" section.
5. Replace repeated links with one canonical pointer when multiple docs in the same domain need the same external target.

## Migration Application Rules for Later Stories

Apply these rules during architecture-domain migration:

1. For each migrated domain overview, add only outward link sections justified by real dependencies.
2. For each migrated domain reference, verify inward link to `../overview.md` and keep only outbound links needed by that contract.
3. Update neighboring routers/docs to include at least one inward path to relevant domain docs when architecture constraints are referenced.
4. Remove duplicated rationale, runbook steps, and workflow instructions from architecture docs after adding the correct outward links.
5. Keep `.md` and `.ai.md` variants aligned so human/AI readers follow the same cross-linking contract.

## Related Documentation

- [Architecture Documentation Router](./README.ai.md)
- [Architecture Domain Folders](./domains/README.ai.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.ai.md)
- [ADR Router](../adr/README.ai.md)
- [Context Packs Router](../context/packs/README.ai.md)
- [Contributors Router](../contributors/README.ai.md)
- [Operations Router](../operations/README.ai.md)
- [Baselines Router](../baselines/README.ai.md)
