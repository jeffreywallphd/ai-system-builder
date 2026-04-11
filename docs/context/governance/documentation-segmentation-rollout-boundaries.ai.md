---
title: "AI Companion: Documentation Segmentation Rollout Boundaries and Follow-On Work"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-segmentation-taxonomy.ai.md
  - docs/context/documentation-segmentation-seed-guidance.ai.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.ai.md
  - docs/contributors/docs-placement-guide.ai.md
  - dev/tests/DocumentationSegmentationRolloutBoundariesStory544Guardrails.test.ts
---

# AI Companion: Documentation Segmentation Rollout Boundaries and Follow-On Work (Story 5.4.4)

## Scope and Intent

Use this note to understand what the initial documentation segmentation rollout includes, what remains out of scope, and how to extend safely without reopening ambiguity or reintroducing mixed-authority docs.

## Initial Segmentation Rollout Scope (What Is Included)

Treat initial rollout as complete when these conditions hold:

- Segmentation categories are defined and stable in `docs/context/documentation-segmentation-taxonomy.ai.md`.
- Placement, migration, and supersession guidance is active and cross-linked for contributors and assistants.
- Baseline and historical isolation rules are explicit and discoverable from active routers.
- Segmentation guardrails enforce key invariants for baseline destinations, supersession links, and active-path link hygiene.
- Contributors have explicit extension rules for follow-on segmentation work.

## Explicit Out-Of-Scope for Initial Rollout (What Is Not Included Yet)

This rollout is intentionally bounded. It does not require:

- Immediate reclassification of every legacy document.
- Exhaustive mixed-content cleanup in one release.
- Fully automated classification with no contributor review.
- Uniform depth/style across all baseline and historical artifacts.
- Immediate removal of all transitional stubs before inbound links are migrated.

## Known Remaining Segmentation Gaps

Expected follow-on gaps:

- Long-tail legacy docs still needing active-vs-historical split cleanup.
- Baseline/historical docs needing metadata or cross-link tightening.
- Some concise transition wording still present in active paths pending migration completion.
- Guardrails that validate structure and invariants, not full semantic classification correctness.

## Definition of Material Completion for This Feature

Feature 5 documentation segmentation is materially complete for this rollout when:

- Segment boundaries between active guidance, historical/baseline records, migration docs, and superseded paths are explicit.
- Current authority is discoverable without relying on superseded or baseline sources.
- Remaining gaps are documented as follow-on work, not hidden debt.
- Contributors can extend with stable rules without reopening ambiguity.

Material completion does not require exhaustive repository-wide segmentation finalization.

## Follow-On Segmentation Work (Prioritized)

1. Complete long-tail split and relocation work:
   - Prioritize active docs where historical narrative still crowds current guidance.
   - Move durable history to `docs/baselines/` with canonical link-backs.
2. Tighten metadata and status consistency:
   - Backfill lifecycle metadata and status markers for non-active docs.
   - Keep `.md` and `.ai.md` companions synchronized.
3. Expand guardrails where ambiguity recurs:
   - Add checks for mixed-purpose regression patterns.
   - Tighten router checks for accidental superseded-path links.
4. Continue safe supersession cleanup:
   - Keep transition stubs redirect-only.
   - Remove stubs only after inbound-link continuity is verified.

## Contributor Extension Rules for Future Work

- Classify first, move second.
- Use `docs/context/documentation-segmentation-taxonomy.ai.md` and `docs/context/documentation-segmentation-seed-guidance.ai.md` as primary decision aids.
- Keep active authority in active docs and historical evidence in baseline/historical destinations.
- Split files when current executable guidance and retirement chronology conflict.
- Track deferrals explicitly as follow-on tasks; do not leave ambiguous mixed content in active authority docs.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-segmentation-seed-guidance.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/contributors/docs-placement-guide.ai.md`
