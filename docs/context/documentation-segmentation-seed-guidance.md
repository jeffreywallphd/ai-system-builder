---
title: Documentation Segmentation Seed Guidance
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-segmentation-taxonomy.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - docs/context/documentation-supersession-and-redirect-conventions.md
  - docs/context/templates/documentation-segmentation-seeds.template.md
  - docs/contributors/docs-placement-guide.md
  - docs/contributors/docs-migration-safety-guide.md
  - dev/tests/DocumentationSegmentationSeedGuidanceGuardrails.test.ts
---

# Documentation Segmentation Seed Guidance (Story 5.1.6)

## Purpose

Provide small reusable starter patterns that reduce guesswork when contributors classify, relocate, or retire documentation during segmentation work.

## Scope and Usage

Use this guidance as a seed kit, not a heavy process:

1. Pick only the snippet needed for the current change.
2. Keep snippets concise and adapt placeholders.
3. Link canonical destination docs in the same change where classification is updated.

## Seed 1: Classification Note Template

Use this block in migration PR notes, issue comments, or temporary review sections when deciding a document segment.

```markdown
## Classification Note

Source path: `docs/<path>.md`
Primary segment: <Active Guidance|Baselines|Historical Notes|Migration Guides and Records|Rollout-Boundary Notes|Temporary Transition Documents|Superseded or Deprecated Documents>
Current authority state: <canonical|reference|supplemental|historical>
Decision summary: <one sentence describing why this segment is correct>
Canonical destination (if changed): `docs/<destination>.md`
```

## Seed 2: Superseded-By Marker Template

Use this block at old paths that remain for link continuity after a canonical replacement exists.

```markdown
## Supersession Notice

This document is superseded and is not authoritative for current implementation or operations.

Effective date: YYYY-MM-DD.
Reason: <one sentence>
Canonical source: `docs/<replacement-path>.md`
Retention/removal trigger: <remove after inbound links migrate or external references are retired>
```

If replacement is split across multiple docs, use `Canonical destinations:` and list each path.

## Seed 3: Baseline File Introduction Template

Use this intro at the top of newly created baseline files so readers immediately understand historical intent.

```markdown
## Baseline Introduction

Snapshot date: YYYY-MM-DD
Snapshot scope: <feature/epic/story/system area>
Why this baseline exists: <one sentence>
Current canonical guidance: `docs/<active-path>.md`
Historical handling note: This file preserves point-in-time evidence and is non-authoritative for new implementation decisions.
```

## Seed 4: Migration Decision Checklist

Use this lightweight checklist before moving or reclassifying docs.

- [ ] Primary segment category selected using `docs/context/documentation-segmentation-taxonomy.md`.
- [ ] Metadata lifecycle updated (`status`, `authoritativeness`, and `superseded_by` when applicable).
- [ ] Non-active docs include a `## Documentation Status` block from `docs/context/documentation-status-signals.md`.
- [ ] Baseline destination chosen with `docs/context/documentation-baseline-and-historical-folder-strategy.md` when history is retained.
- [ ] Supersession/pointer note uses required fields from `docs/context/documentation-supersession-and-redirect-conventions.md`.
- [ ] Canonical destination link(s) and routers updated in the same change.
- [ ] `.md` and `.ai.md` companion docs kept aligned.

## Seed 5: Documentation Status Block Template

Use this block in baseline, historical, and migration-record docs to make non-active status explicit.

```markdown
## Documentation Status

- Segment: <Baselines|Historical Notes|Migration Guides and Records|Temporary Transition Documents|Superseded or Deprecated Documents>
- Lifecycle status (`status`): <active|deprecated|superseded|archived>
- Authority state (`authoritativeness`): <canonical|reference|supplemental|historical>
- Current guidance stance: <state whether this doc is authoritative for current implementation behavior>
- Canonical active path(s): `docs/<active-path>.md`
```

## Fast Placement Decisions for Baselines

Use these quick rules to avoid overthinking baseline placement:

1. Architecture-history snapshot -> `docs/baselines/architecture/`
2. Contributor workflow history -> `docs/baselines/contributors/`
3. Operational/runbook history -> `docs/baselines/operations/`
4. Taxonomy/context migration history -> `docs/baselines/context/`
5. UI behavior history -> `docs/baselines/ui/`
6. Multi-area historical bundle -> `docs/baselines/cross-cutting/`

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
- `docs/context/documentation-status-signals.md`
- `docs/context/documentation-supersession-and-redirect-conventions.md`
- `docs/context/templates/documentation-segmentation-seeds.template.md`
