---
title: "AI Companion: Documentation Segmentation Taxonomy"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - docs/architecture
  - docs/baselines
  - docs/contributors/docs-placement-guide.md
  - dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts
---

# AI Companion: Documentation Segmentation Taxonomy (Story 5.1.1)

Use this taxonomy to classify docs by authority state and migration posture so active guidance stays isolated from low-signal historical material.

## Segment Categories

- `Active Guidance`: current implementation, architecture, and operations authority.
- `Baselines`: point-in-time snapshots and completion/migration evidence.
- `Historical Notes`: preserved context for traceability; non-authoritative for current work.
- `Migration Guides and Records`: sequence/safety/inventory docs that coordinate movement.
- `Rollout-Boundary Notes`: explicit phase scope, non-goals, and deferred work boundaries.
- `Temporary Transition Documents`: short-lived bridge stubs and pointer notes during moves/splits.
- `Superseded or Deprecated Documents`: retired authority paths retained for continuity and redirects.

## Fast Classification Rules

1. Assign one primary segment category per document.
2. Classify by intent and authority state, not by document title keywords.
3. Keep active guidance separate from historical/transition content.
4. When a document changes segment, update metadata and replacement links in the same change.
5. Temporary transition docs must declare canonical destinations and exit once safe.

## Active Versus Historical Decision Rubric

Run these checks in order:

1. `Current-action test`: should readers follow this for today's behavior?
2. `Temporal-state test`: is it present-state guidance or prior-state chronology?
3. `Authority-source test`: is this file canonical for the scope?
4. `Purpose test`: guidance for execution vs traceability/evidence?
5. `Replacement test`: if no longer current, is `superseded_by` defined?

Decision shortcut:
- Current-action + canonical authority -> `Active Guidance`.
- Prior-state + traceability value -> `Historical Notes` or `Baselines`.
- Movement coordination -> `Migration Guides and Records` or `Temporary Transition Documents`.

## Borderline and Mixed-Content Rules

1. Keep short rationale in active docs, but move long chronology to historical/baseline docs.
2. If a doc contains non-current executable steps, split immediately; do not leave them in active authority paths.
3. If one file would need conflicting authority signals, split the file rather than weakening metadata.
4. Label any retained history in active docs as non-normative and link to the historical record.
5. If classification is ambiguous, default to non-authoritative placement and link canonical active guidance.

## Mixed-Content Split Workflow

1. Extract current canonical guidance to active destination docs.
2. Move chronology/evidence to historical or baseline destinations.
3. Keep the old path as either router index or superseded transition stub with destination links.
4. Update metadata and inbound links in the same commit.
5. Add guardrail checks for headings, links, and metadata expectations.

## Anti-Patterns for Mixed-Purpose and Low-Signal Docs

- `Architecture + change-log blend`: active `docs/architecture/` files mix canonical contracts with dated implementation chronology.
  - Corrective action: keep current contracts in architecture docs; move timeline history to `docs/baselines/architecture/` or historical notes.
- `History-heavy active docs`: active contributor/architecture docs embed long story-by-story completion history.
  - Corrective action: keep only short rationale in active docs and relocate full chronology/evidence to baselines.
- `Stale plan as active authority`: planning/migration residue remains `status: active` and appears as current guidance.
  - Corrective action: reclassify to migration or superseded segments, update metadata, and link canonical current docs.
- `Overloaded README`: a single `README.md` carries routing, architecture authority, runbook steps, and historical notes.
  - Corrective action: keep README as orientation/router only; split authority content into architecture/contributor/operations/baseline docs.
- `Superseded doc with executable steps`: deprecated pointer docs still include run procedures or implementation instructions.
  - Corrective action: convert to redirect-style stub content with destination links only.

## Anti-Pattern Decision Triggers

1. Split immediately when one file mixes canonical current rules with timeline/change-log prose.
2. Move chronology/planning residue when it exceeds one-third of active document content.
3. Replace overloaded README authority with linked specialized docs.
4. Mark retained stale planning records as historical, never canonical.
5. Keep superseded continuity paths non-normative and redirect-only.

## Expected Metadata Signals

- Active guidance: commonly `status: active`, `authoritativeness: canonical|reference`.
- Historical/retired content: commonly `authoritativeness: historical` with `status: deprecated|superseded|archived`.
- Transition docs: `status: superseded|deprecated` plus `superseded_by` when single replacement exists.

## Integration Points

- Canonical taxonomy contract: `docs/context/documentation-taxonomy.md`
- Placement decisions: `docs/contributors/docs-placement-guide.md`
- Supersession/redirect convention source: `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- Guardrail test: `dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts`

