---
title: "AI Companion: Documentation Segmentation Seed Guidance"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-segmentation-taxonomy.ai.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.ai.md
  - docs/context/documentation-supersession-and-redirect-conventions.ai.md
  - docs/context/templates/documentation-segmentation-seeds.template.ai.md
  - docs/contributors/docs-placement-guide.ai.md
  - docs/contributors/docs-migration-safety-guide.ai.md
  - dev/tests/DocumentationSegmentationSeedGuidanceGuardrails.test.ts
---

# AI Companion: Documentation Segmentation Seed Guidance (Story 5.1.6)

Use this as a compact seed set for classification and relocation decisions so migrations stay consistent without adding heavy process.

## Minimal Usage Rules

1. Choose only the snippet needed for the current migration.
2. Keep the note short and replace placeholders.
3. Update destination links and metadata in the same change.

## Seed Template: Classification Note

```markdown
## Classification Note

Source path: `docs/<path>.md`
Primary segment: <Active Guidance|Baselines|Historical Notes|Migration Guides and Records|Rollout-Boundary Notes|Temporary Transition Documents|Superseded or Deprecated Documents>
Current authority state: <canonical|reference|supplemental|historical>
Decision summary: <one sentence>
Canonical destination (if changed): `docs/<destination>.md`
```

## Seed Template: Superseded-By Marker

```markdown
## Supersession Notice

This document is superseded and is not authoritative for current implementation or operations.

Effective date: YYYY-MM-DD.
Reason: <one sentence>.
Canonical source: `docs/<replacement-path>.md`
Retention/removal trigger: <remove after inbound-link migration is complete>
```

For split replacements, use `Canonical destinations:` and list each canonical path.

## Seed Template: Baseline Introduction

```markdown
## Baseline Introduction

Snapshot date: YYYY-MM-DD
Snapshot scope: <feature/epic/story/system area>
Why this baseline exists: <one sentence>
Current canonical guidance: `docs/<active-path>.md`
Historical handling note: This file is historical evidence and non-authoritative for new implementation decisions.
```

## Seed Template: Migration Decision Checklist

- [ ] Segment classification selected from `documentation-segmentation-taxonomy.ai.md`.
- [ ] Lifecycle metadata updated (`status`, `authoritativeness`, `superseded_by` when needed).
- [ ] Baseline target chosen using `documentation-baseline-and-historical-folder-strategy.ai.md`.
- [ ] Supersession block includes effective date, reason, canonical destination, and retention trigger.
- [ ] Canonical destination links and routers updated in same change.
- [ ] Human/AI companion docs kept aligned.

## Fast Baseline Routing

- Architecture history -> `docs/baselines/architecture/`
- Contributor workflow history -> `docs/baselines/contributors/`
- Operations history -> `docs/baselines/operations/`
- Context/taxonomy history -> `docs/baselines/context/`
- UI history -> `docs/baselines/ui/`
- Cross-domain historical bundle -> `docs/baselines/cross-cutting/`

## Related Sources

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/context/templates/documentation-segmentation-seeds.template.ai.md`
