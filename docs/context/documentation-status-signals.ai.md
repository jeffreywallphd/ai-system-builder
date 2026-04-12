---
title: "AI Companion: Documentation Status Signals"
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

# AI Companion: Documentation Status Signals (Story 5.3.2)

## Purpose

Use one compact status-marker pattern so non-active docs are immediately recognizable and cannot be misread as active implementation authority.

## Standard Status Block

Apply this heading near the top of non-active docs:

```markdown
## Documentation Status

- Segment: <Baselines|Historical Notes|Migration Guides and Records|Temporary Transition Documents|Superseded or Deprecated Documents>
- Lifecycle status (`status`): <active|deprecated|superseded|archived>
- Authority state (`authoritativeness`): <canonical|reference|supplemental|historical>
- Current guidance stance: <one sentence saying whether this is authoritative for current implementation behavior>
- Canonical active path(s): `docs/<active-path>.md` (or `n/a` for stub-only redirects)
```

## Required Interpretation Rules

1. Baseline/migration docs may be `status: active` while still non-authoritative for current implementation behavior.
2. Non-active docs must explicitly state that they are not current implementation authority.
3. Superseded/deprecated files keep `## Supersession Notice` and `## Redirect` as the primary status signal.
4. Single-replacement stubs keep `superseded_by` frontmatter.
5. Keep `.md` and `.ai.md` status wording aligned.

## Apply To

- Baseline routers and baseline snapshots.
- Historical snapshots preserved for traceability.
- Transitional migration records with low current-action value.
- Superseded/deprecated pointer stubs.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-segmentation-seed-guidance.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/context/documentation-metadata-header.ai.md`
