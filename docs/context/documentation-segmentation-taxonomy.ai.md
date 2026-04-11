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

## Expected Metadata Signals

- Active guidance: commonly `status: active`, `authoritativeness: canonical|reference`.
- Historical/retired content: commonly `authoritativeness: historical` with `status: deprecated|superseded|archived`.
- Transition docs: `status: superseded|deprecated` plus `superseded_by` when single replacement exists.

## Integration Points

- Canonical taxonomy contract: `docs/context/documentation-taxonomy.md`
- Placement decisions: `docs/contributors/docs-placement-guide.md`
- Guardrail test: `dev/tests/DocumentationSegmentationTaxonomyGuardrails.test.ts`

