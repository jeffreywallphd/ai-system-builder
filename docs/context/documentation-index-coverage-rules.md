---
title: Documentation Index Coverage Rules
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-status-signals.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationIndexCoverageRulesStory615Guardrails.test.ts
---

# Documentation Index Coverage Rules (Story 6.1.5)

## Purpose

Define explicit inclusion and exclusion boundaries for the documentation registry so indexing stays high-signal and authoritative.

## Coverage Modes

- `required`: category must have indexed entries when active docs exist.
- `selective`: category is indexable, but only curated anchor records should be indexed.
- `excluded`: category should not be indexed as standalone records.

## Coverage Policy By Category

| Category | Coverage mode | Indexing treatment |
| --- | --- | --- |
| Active architecture docs (`docs/architecture/`) | `required` | Index canonical architecture overviews/references that guide current implementation and review decisions. |
| Active contributor docs (`docs/contributors/`) | `required` | Index canonical contributor guides used for implementation workflows and safe change practices. |
| Active operations docs (`docs/operations/` and top-level operational runbooks) | `required` | Index canonical runbooks and operational authority docs used for runtime management and diagnostics. |
| Context packs (`docs/context/packs/*.pack.md`) | `required` | Index curated pack assets as discovery entry points for task-scoped context assembly. |
| ADR records (`docs/adr/records/adr-*.md`) | `required` | Index accepted/active decision records and maintain discoverability for superseded ADR lineage. |
| Baselines and migration snapshots (`docs/baselines/`, migration baseline docs) | `selective` | Index only durable, cross-cutting baseline anchors; do not index every snapshot or derived inventory file. |
| Superseded or historical pointer docs in active paths | `selective` | Keep minimal records only when they provide redirect continuity, traceability, or compliance-critical lineage. |
| Routers (`README.md` files) | `excluded` | Routers remain navigation helpers and are represented indirectly through indexed authority docs. |
| Templates (`docs/context/templates/`) | `excluded` | Templates are authoring scaffolds, not authoritative runtime or implementation guidance. |
| Prompt snippets and helper prompts (`docs/prompts/`) | `excluded` | Prompt helpers are task aids; index only if promoted to canonical contributor/context guidance. |
| AI companion duplicates (`*.ai.md`) | `excluded` | Use `aiPath` on indexed human docs instead of creating duplicate registry entries. |

## Inclusion Rules

1. Prefer `status: active` and `authoritativeness: canonical` for required categories.
2. Include non-active records only when they materially improve routing, supersession tracing, or auditability.
3. Keep one record per authoritative human path (`.md`), with optional `aiPath` companion reference.
4. Index records must provide concise summaries and stable identifiers (`recordId`) for deterministic retrieval.

## Selective Indexing Rules

Selective categories are intentionally constrained:

1. Use anchor records over exhaustive file-level indexing.
2. Prioritize artifacts that serve as durable entry points across epics, domains, or migration phases.
3. Avoid indexing churn-heavy working notes or one-off transition logs unless they are canonical retention points.
4. When indexing superseded material, mark lifecycle and authority explicitly (`status: superseded|archived`, `authoritativeness: historical`).

## Exclusion Rules

Exclude docs that are not primary retrieval targets for authoritative guidance:

- scaffolds (`templates/`),
- navigation wrappers (router README files),
- duplicate AI companion variants,
- narrow prompt helper artifacts that do not carry canonical implementation or operational authority.

If an excluded artifact becomes canonical guidance, reclassify it through normal taxonomy and metadata updates before indexing.

## Status and Authoritativeness Expectations

- Required categories default to `status: active`, `authoritativeness: canonical`.
- Selective historical categories generally use `authoritativeness: historical` and a lifecycle status that reflects current usability (`active` historical snapshot, `superseded`, or `archived`).
- Superseded pointers must include replacement direction (`supersededBy`) when a single canonical successor exists.

## Registry Representation Rules

To keep discovery high-signal:

1. Registry entries represent authoritative or intentionally retained anchors, not every markdown file.
2. `coveragePolicy` in `docs/context/documentation-registry.seed.json` is the machine-readable source of category indexing rules.
3. Validation enforces presence and structural completeness of the coverage policy contract.

## Related Guidance

- `docs/context/documentation-indexing-model.md`
- `docs/context/documentation-registry.md`
- `docs/context/documentation-status-signals.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
