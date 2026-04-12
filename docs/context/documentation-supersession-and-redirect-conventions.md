---
title: Documentation Supersession and Redirect Conventions
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - docs/architecture
  - docs/contributors
  - docs/operations
  - docs/baselines
  - dev/tests/DocumentationSupersessionRedirectConventionsGuardrails.test.ts
---

# Documentation Supersession and Redirect Conventions (Story 5.1.4)

## Purpose

Define one lightweight, reusable supersession pattern so outdated docs do not compete with current authoritative guidance.

## Convention Components

Use these components together based on migration scope:

1. **Supersession note**: explicit non-authoritative marker in a retired source doc.
2. **Redirect language**: clear instruction that points readers to canonical replacement docs.
3. **Pointer file**: short old-path stub kept for link continuity.
4. **Deprecation marker**: lifecycle signal for docs that are discouraged but not fully replaced.

## When to Use Each Component

| Component | Use when | Required metadata | Content limit |
| --- | --- | --- | --- |
| Supersession note | A source doc is fully replaced by one canonical destination. | `status: superseded`, `authoritativeness: historical`, `superseded_by`. | Keep short; no full legacy workflow. |
| Redirect language | A source doc has one or more replacement docs. | `status: superseded` or `status: deprecated`. | 1-3 short paragraphs plus destination links. |
| Pointer file | Old path must stay stable while links migrate. | Same as source lifecycle (`superseded` or `deprecated`). | Stub-only; route readers to destination(s). |
| Deprecation marker | Guidance remains partially valid for legacy contexts, but new work should not follow it. | `status: deprecated`; `superseded_by` optional for multi-destination replacement. | Keep scope limits explicit. |

## Required Information for Retired Paths

Every superseded/deprecated source path must include:

1. Authority statement: this document is non-authoritative for current implementation work.
2. Replacement destination link(s): canonical doc path(s) to use instead.
3. Effective date: when supersession/deprecation took effect (`YYYY-MM-DD`).
4. Retirement reason: one concise sentence describing why it moved or split.
5. Retention/removal trigger: what must happen before pointer removal (for example inbound links migrated).

## Lightweight Supersession Block Pattern

Use this structure in old-path stubs:

```markdown
## Supersession Notice

This document is superseded and no longer authoritative for current behavior.

Effective date: YYYY-MM-DD.
Reason: <one sentence>.
Canonical source: `docs/<replacement-path>.md`.
```

If multiple destinations exist, replace `Canonical source` with `Canonical destinations` and list each path.

## Pointer File Pattern

Pointer files should keep only routing context, not retired implementation detail:

```markdown
## Redirect

Use `docs/<replacement-path>.md` as the canonical source.
This pointer is retained only for link continuity and will be removed after inbound links are migrated.
```

## Deprecation Marker Pattern

Use this when the doc still matters for legacy operation but should not guide new work:

- `status: deprecated`
- Statement: "Do not use for new implementation decisions."
- Scope note: what legacy use remains valid.
- Link to canonical modern replacement(s) if available.

## Usage by Documentation Area

### Architecture docs

- Keep full retired architecture history in `docs/baselines/architecture/` or ADR records when the history is decision rationale.
- Old architecture paths should become superseded pointer stubs once canonical domain docs exist.

### Contributor guidance

- Keep old contributor workflow paths as short pointers only during migration.
- Redirect to the current contributor guide and canonical architecture contract docs.

### Operational notes and runbooks

- Deprecate runbooks when only legacy systems still use them.
- Supersede when a new runbook fully replaces prior operational behavior.

### Baseline and historical artifacts

- Baselines remain historical evidence and should not be superseded into active authority.
- If a baseline index path moves, use a pointer file only for continuity and keep historical metadata unchanged.

## Clean Migration Sequence

1. Publish canonical destination doc(s) first.
2. Convert source doc to superseded/deprecated pointer format.
3. Update routers and inbound references in the same change set.
4. Preserve historical material in `docs/baselines/...` or ADR records.
5. Remove pointer file only after retention trigger is met.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/contributors/docs-migration-safety-guide.md`
- `docs/architecture/architecture-supersession-and-retirement-governance.md`
