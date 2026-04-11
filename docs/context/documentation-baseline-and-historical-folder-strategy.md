---
title: Baseline and Historical Folder Strategy
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/baselines
  - docs/architecture
  - docs/contributors/docs-placement-guide.md
  - dev/tests/DocumentationBaselineHistoricalFolderStrategyGuardrails.test.ts
---

# Baseline and Historical Folder Strategy (Story 5.1.3)

## Purpose

Define explicit target destinations for baseline and historical documentation so migration work has one consistent landing model and stale material does not compete with active authority paths.

## Core Placement Contract

1. `docs/baselines/` is the default destination for historical snapshots, completion handoffs, and migration evidence.
2. Active authority remains in active routers (`docs/architecture/`, `docs/contributors/`, `docs/operations/`, `docs/ui/`, `docs/context/`).
3. Replaced active paths may keep only short superseded pointer notes; they must not retain full historical narrative.

## Target Destinations for Baseline and Historical Material

| Material type | Target destination | Why |
| --- | --- | --- |
| Feature/epic completion baselines, migration inventories, state snapshots | `docs/baselines/` | Keeps historical evidence isolated from active guidance. |
| Historical architecture baselines moved out of active architecture docs | `docs/baselines/architecture/` | Preserves architecture history without polluting canonical architecture contracts. |
| Historical contributor workflow baselines | `docs/baselines/contributors/` | Keeps obsolete contributor workflows out of active contributor guidance. |
| Historical operational runbooks or migration-era procedure snapshots | `docs/baselines/operations/` | Preserves prior operating posture without competing with live runbooks. |
| Historical context/taxonomy migration snapshots | `docs/baselines/context/` | Preserves historical context-engineering artifacts separately from active context contracts. |
| Historical UI behavior or rollout snapshots | `docs/baselines/ui/` | Keeps prior UI state references away from active UI contracts. |
| Cross-cutting historical bundles spanning multiple active areas | `docs/baselines/cross-cutting/` | Avoids scattering one historical bundle across many active namespaces. |

## Narrowly Justified Non-Baseline Destinations

### Superseded Pointer Notes at Old Active Paths

Use old-path notes only when link continuity is required.

- Allowed content: 1-3 short paragraphs that include replacement link(s), retirement reason, and effective date.
- Required metadata: `status: superseded` or `status: deprecated`; set `superseded_by` when a single replacement exists.
- Prohibited content: full legacy workflows, long chronology, or mixed active/historical guidance.

### Superseded Decision History in ADR Records

Keep decision supersession lineage in `docs/adr/records/` when the historical content is decision rationale rather than migration evidence.

- ADR records remain the canonical destination for architecture decision status history.
- Do not copy full ADR supersession history into baseline snapshots.

### Brief Non-Normative Historical Notes in Active Docs

Active docs may keep brief historical notes only for immediate reader orientation.

- Keep the note short and label it non-authoritative.
- Link to the full record in `docs/baselines/` (or ADR record when decision history is the source).
- If the historical section becomes substantial, move it to a baseline artifact.

## Baselines Versus Superseded Pointer Notes

Use this rule:

1. If the content is meaningful historical evidence or prior-state narrative, move it to `docs/baselines/...`.
2. If the old path only needs continuity guidance, keep a minimal superseded pointer note at the old path.
3. If both are needed, do both: move full history to baselines and keep a short pointer stub at the old path.

## Migration Landing Zone Rules

1. Choose one target subpath under `docs/baselines/` before moving content.
2. Keep `.md` and `.ai.md` companion pairs aligned for baseline artifacts.
3. Update router links in the same change set when introducing a new baseline destination.
4. Preserve active authority links from baselines back to canonical active docs.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/contributors/docs-migration-safety-guide.md`
- `docs/baselines/README.md`
