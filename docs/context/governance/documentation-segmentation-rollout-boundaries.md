---
title: Documentation Segmentation Rollout Boundaries and Follow-On Work
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-segmentation-taxonomy.md
  - docs/context/documentation-segmentation-seed-guidance.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - docs/contributors/docs-placement-guide.md
  - dev/tests/DocumentationSegmentationRolloutBoundariesStory544Guardrails.test.ts
---

# Documentation Segmentation Rollout Boundaries and Follow-On Work (Story 5.4.4)

## Scope and Intent

This note closes the initial documentation segmentation rollout by stating what is materially complete now, what remains intentionally out of scope, and how to extend the model without reintroducing mixed-authority ambiguity.

## Initial Segmentation Rollout Scope (What Is Included)

Treat the initial rollout as complete when all of the following are true:

- Segmentation categories are defined and stable in `docs/context/documentation-segmentation-taxonomy.md`.
- Placement, migration, and supersession guidance is active and cross-linked across context and contributor docs.
- Baseline and historical isolation rules are documented and reflected in active router paths.
- Segmentation guardrails and validation scripts enforce baseline destination, supersession, and active-path link hygiene.
- Contributors have explicit extension guidance for future segmentation follow-on work.

## Explicit Out-Of-Scope for Initial Rollout (What Is Not Included Yet)

This rollout is intentionally bounded. It does not require:

- Immediate reclassification of every legacy document across the entire repository.
- Exhaustive elimination of all mixed-purpose prose in a single release window.
- Full automation that infers segment classification without contributor review.
- Uniform depth and narrative style across every historical or baseline artifact.
- Removal of all transitional stubs before inbound links are safely migrated.

## Known Remaining Segmentation Gaps

Known remaining work is expected and should be tracked as follow-on maintenance:

- Additional long-tail legacy docs still need active-vs-historical split cleanup.
- Some baseline/historical artifacts may need metadata, status-marker, or cross-link tightening.
- Some router and contributor pages may still carry concise transitional wording that should eventually move into isolated baseline evidence.
- Guardrails currently validate structural quality and key invariants, but not full semantic correctness of every classification decision.

## Definition of Material Completion for This Feature

Feature 5 documentation segmentation is materially complete for this rollout when:

- Active guidance, baseline/historical material, migration records, and superseded paths are separated by clear segment intent.
- Current authoritative guidance is discoverable without relying on baseline or superseded documents.
- Remaining gaps are explicitly documented as follow-on work instead of hidden cleanup debt.
- Contributors can apply a stable extension path without reopening authority ambiguity.

Material completion for this rollout does not require exhaustive repository-wide segmentation finalization.

## Follow-On Segmentation Work (Prioritized)

1. Finish remaining long-tail split and relocation work:
   - Prioritize active docs where historical narrative still crowds current guidance.
   - Move durable historical evidence into `docs/baselines/` destinations with canonical link-backs.
2. Tighten metadata and status consistency:
   - Backfill missing lifecycle metadata and status markers where non-active docs remain ambiguous.
   - Keep `.md` and `.ai.md` companions synchronized as changes are made.
3. Expand guardrail coverage where ambiguity is recurring:
   - Add tests for frequently regressing mixed-purpose patterns.
   - Strengthen router checks for accidental links to superseded authority paths.
4. Continue supersession and transition cleanup safely:
   - Keep transition stubs minimal and redirect-only.
   - Remove stubs only after inbound-link continuity is confirmed.

## Contributor Extension Rules for Future Work

- Classify first, move second: decide segment intent before changing document location.
- Use `docs/context/documentation-segmentation-taxonomy.md` and `docs/context/documentation-segmentation-seed-guidance.md` as the canonical decision aid for new segmentation work.
- Keep active authority in active docs and keep historical evidence in baseline/historical destinations.
- Do not mix current executable guidance with retirement chronology in one file; split and cross-link instead.
- Record deferred items as explicit follow-on tasks rather than leaving ambiguous "temporary" mixed content in active docs.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-segmentation-seed-guidance.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
- `docs/context/documentation-supersession-and-redirect-conventions.md`
- `docs/contributors/docs-placement-guide.md`
