---
title: Architecture Domain Cross-Linking Rules
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/domains/README.md
  - docs/adr/README.md
  - docs/context/packs/README.md
  - docs/baselines/README.md
  - docs/contributors/README.md
  - docs/operations/README.md
  - dev/tests/ArchitectureDomainCrossLinkingRulesGuardrails.test.ts
---

# Architecture Domain Cross-Linking Rules

## Purpose

Define how domainized architecture docs connect to ADRs, context packs, baselines, contributor guidance, and operations docs without turning architecture overviews into link indexes.

## Why This Guardrail Exists

- Domainization improves boundaries only when cross-doc relationships remain explicit and low-noise.
- Flat "related links" lists become unreadable when they mix design, operations, migration history, and implementation workflow links.
- Migration stories need one reusable cross-linking contract so teams do not invent local linking styles per domain.

## Outbound Links From Architecture Domain Docs

Architecture domain docs point outward only when external docs provide authority that architecture should not duplicate.

### Domain Overviews (`overview.md`)

- Keep one focused link group per relationship type:
  - `## Related ADRs` for decision constraints in `docs/adr/records/`.
  - `## Related Context Packs` for retrieval assets in `docs/context/packs/`.
  - `## Related Contributor and Operations Guidance` for implementation/runbook docs in `docs/contributors/` and `docs/operations/`.
  - `## Related Baselines` for historical snapshots in `docs/baselines/` when active architecture text references prior-state history.
- Link only canonical routers or high-value canonical docs, not every neighboring file.

### Domain References (`references/README.md` and reference docs)

- Link back inward to `../overview.md` first so boundary context stays primary.
- Add outward links only when the reference contract is constrained by:
  - ADR decisions (`docs/adr/records/`),
  - context retrieval routing quality (`docs/context/packs/`),
  - implementation workflow guardrails (`docs/contributors/`),
  - operational authority boundaries (`docs/operations/`).
- Do not add baseline links unless historical posture is required to interpret current contracts.

## Inbound Links From Neighbor Documentation Types

Neighbor docs should point inward when they depend on architecture domain boundaries for meaning:

- ADRs: in `## Related Documentation`, include links to impacted domain `overview.md` or canonical domain references.
- Context packs: in `## Authoritative Docs`, include links to domain overviews/references that define architecture invariants used by the pack.
- Baselines: include "current authority" links to active domain docs whenever a baseline captures superseded or prior-state architecture.
- Contributor guides: link to domain overviews/references when implementation constraints are architectural rather than workflow-local.
- Operations docs: link to domain overviews/references where runbook behavior depends on architecture boundaries (for example trust, control-plane authority, tenancy).

## Link Budget and Placement Rules (Findability Without Clutter)

Use these rules to keep cross-linking useful:

1. Keep overview-level link sections short; default to three to seven links per section.
2. Prefer router or canonical reference links over long lists of sibling files.
3. Use one link per external authority topic in overviews; put deeper link lists in reference-level docs if needed.
4. Keep links grouped by purpose (`ADRs`, `Context Packs`, `Contributor/Operations`, `Baselines`) rather than one mixed "Related Docs" bucket.
5. Replace repeated links with a single canonical pointer when multiple docs in the same domain need the same external target.

## Migration Application Rules for Later Stories

Apply these rules during domain migration:

1. For each migrated domain overview, add only the outward sections justified by real dependencies.
2. For each migrated domain reference, verify inward link to `../overview.md` and only keep outbound links needed by that contract.
3. Update neighboring routers/docs to include at least one inward path to relevant domain docs when architecture constraints are referenced.
4. Remove duplicated rationale, runbook steps, and workflow instructions from architecture docs after adding the correct outward links.
5. Keep `.md` and `.ai.md` variants aligned so human and AI readers follow the same cross-linking contract.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domain Folders](./domains/README.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [ADR Router](../adr/README.md)
- [Context Packs Router](../context/packs/README.md)
- [Contributors Router](../contributors/README.md)
- [Operations Router](../operations/README.md)
- [Baselines Router](../baselines/README.md)
