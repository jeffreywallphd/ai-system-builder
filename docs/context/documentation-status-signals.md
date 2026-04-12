---
title: Documentation Status Signals
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/baselines
  - docs/architecture
  - docs/context/templates/baseline.template.md
  - docs/context/templates/documentation-segmentation-seeds.template.md
  - dev/tests/DocumentationStatusSignalsStory532Guardrails.test.ts
---

# Documentation Status Signals (Story 5.3.2)

## Purpose

Define one lightweight status-marker pattern so non-active documentation is visually obvious and semantically unambiguous for both human contributors and AI systems.

## Standard Status Block

Use this heading near the top of non-active docs:

```markdown
## Documentation Status

- Segment: <Baselines|Historical Notes|Migration Guides and Records|Temporary Transition Documents|Superseded or Deprecated Documents>
- Lifecycle status (`status`): <active|deprecated|superseded|archived>
- Authority state (`authoritativeness`): <canonical|reference|supplemental|historical>
- Current guidance stance: <one sentence stating whether this doc is authoritative for current implementation behavior>
- Canonical active path(s): `docs/<active-path>.md` (or `n/a` when the file is a stub-only redirect)
```

Keep this block to 4-6 bullets.

## Required Interpretation Rules

1. `status: active` in a baseline or migration file does not make it current implementation authority.
2. If the doc is non-active guidance, include an explicit "not authoritative for current implementation behavior" statement.
3. For superseded/deprecated docs, keep `## Supersession Notice` and `## Redirect` sections as the primary status signal.
4. If the file has a single replacement, keep `superseded_by` in frontmatter.
5. Keep status wording consistent across `.md` and `.ai.md` companions.

## Where to Apply

- Baseline routers and baseline snapshot files.
- Historical snapshot docs retained for traceability.
- Transitional migration records that are no longer primary execution guidance.
- Superseded/deprecated pointer stubs (using supersession/redirect headings).

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-segmentation-seed-guidance.md`
- `docs/context/documentation-supersession-and-redirect-conventions.md`
- `docs/context/documentation-metadata-header.md`
