---
title: "AI Companion: Baseline and Historical Folder Strategy"
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
  - dev/tests/DocumentationBaselineHistoricalReviewExpectationsStory543Guardrails.test.ts
---

# AI Companion: Baseline and Historical Folder Strategy (Story 5.1.3)

Use this contract to place historical and baseline material consistently during migration so active docs stay authoritative and low-signal history stays isolated.

## Core Placement Rules

1. Default destination for baseline/historical artifacts: `docs/baselines/`.
2. Active authority stays in active docs areas; history must not remain as peer authority there.
3. Old active paths can keep only short superseded pointer notes.

## Target Baseline Destinations

- `docs/baselines/`: top-level historical snapshots and migration evidence.
- `docs/baselines/architecture/`: architecture history moved out of active architecture contracts.
- `docs/baselines/contributors/`: prior contributor workflow baselines.
- `docs/baselines/operations/`: historical runbook/procedure snapshots.
- `docs/baselines/context/`: historical context/taxonomy migration records.
- `docs/baselines/ui/`: historical UI behavior snapshots.
- `docs/baselines/cross-cutting/`: bundles spanning multiple active areas.
- Transition-era migration notes and rollout completion logs: `docs/baselines/architecture/<domain>/` (or `docs/baselines/cross-cutting/` for multi-domain bundles).

## Narrowly Justified Non-Baseline Destinations

### Superseded Pointer Notes (Old Paths)

Allowed only for continuity:

- Keep 1-3 short paragraphs with replacement link(s), reason, and effective date.
- Set `status: superseded|deprecated`; set `superseded_by` when one replacement exists.
- Do not keep long historical narrative on old active paths.

### ADR Supersession Records

Use `docs/adr/records/` when retained history is architecture decision rationale/supersession lineage.

### Brief Historical Notes in Active Docs

Allowed only as short non-authoritative context with links to the full baseline or ADR history source.

## Baseline vs Pointer Decision

1. Meaningful historical evidence -> move to `docs/baselines/...`.
2. Link continuity only -> keep a short superseded pointer note at old path.
3. Need both -> baseline artifact + short old-path stub.

## Migration Landing Zone Rules

1. Pick one `docs/baselines/` subpath before moving files.
2. Keep `.md` and `.ai.md` baseline companions aligned.
3. Update routers when new baseline destinations are introduced.
4. Baselines should link back to canonical active authority docs.

## Transitional and Rollout Note Handling

1. Keep active rollout-scope declarations in explicit rollout-boundary docs only.
2. Move completed transition and rollout notes into baseline destinations.
3. Keep old active paths as short superseded stubs with canonical destination links.
4. Link active authority first from routers; add historical baseline links as secondary context.

## Ongoing Review and Maintenance Expectations (Story 5.4.3)

### Review Posture

- Review archival docs for trust and navigation quality, not for routine implementation freshness.
- Keep baselines and historical notes stable as evidence snapshots.
- Verify each archive path links back to canonical active authority.

### Review Scope

Validate these checks during recurring maintenance:
1. Metadata integrity: `status`, `authoritativeness`, `superseded_by` when applicable.
2. Redirect quality: superseded pointers resolve to current canonical docs.
3. Isolation quality: no current executable workflow guidance leaks into archival paths.
4. Retirement context: superseded stubs include concise rationale and effective direction.

### Update Boundaries

Allowed:
- Metadata fixes, link repairs, and required redaction/compliance edits.
- Clearer replacement-path annotations when material is newly superseded.

Not allowed:
- Evolving archived artifacts into active implementation guides.
- Using baselines as a storage area for draft plans or unresolved design parking notes.

### Newly Superseded Intake Contract

1. Place durable prior-state evidence into the correct `docs/baselines/...` destination.
2. Keep old active paths as minimal superseded pointers.
3. Ensure archived artifacts cross-link canonical active successors.
4. Require explicit retention reason: parity, traceability, auditability, or retirement lineage.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/contributors/docs-placement-guide.ai.md`
- `docs/contributors/docs-migration-safety-guide.ai.md`
- `docs/baselines/README.ai.md`
- `docs/contributors/baseline-and-historical-material-usage-guide.ai.md`
