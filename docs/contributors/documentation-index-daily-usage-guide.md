---
title: Documentation Index Daily Usage Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-index.md
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-status-signals.md
  - docs/contributors/context-engineering-system-guide.md
  - docs/contributors/baseline-and-historical-material-usage-guide.md
  - dev/tests/DocumentationIndexContributorDailyUsageStory634Guardrails.test.ts
---

# Documentation Index Daily Usage Guide

## Purpose

Make the documentation index a normal first step for contributor work by defining when to consult it, how to pick authoritative docs, and how to avoid stale historical-material mistakes.

## When to Consult the Index

Use `docs/context/documentation-index.md` at the start of:

1. Feature decomposition and implementation planning.
2. Architecture or design review prep.
3. Runtime diagnostics and security investigations.
4. Documentation refactor and migration tasks.

Skip broad folder scans unless the index points to a known gap.

## Daily Workflow (Findability First, Authority Second)

1. Start in the index section that matches the task:
   - `Browse by Task Workflow` for task-oriented starts.
   - `Browse by Domain` for domain-scoped work.
   - `Browse by Status` when validating lifecycle state.
2. Collect candidate docs and `recordId` values.
3. Open candidate docs and confirm authority before using them as decision input:
   - `status`
   - `authoritativeness`
   - supersession or redirect notes when present
4. Use active canonical docs as implementation authority.
5. Treat historical docs as context evidence only.

The index improves findability. It does not by itself grant authority.

## Interpreting `status` and `authoritativeness`

- `status: active` + `authoritativeness: canonical`:
  default implementation authority.
- `status: active` + `authoritativeness: reference` or `supplemental`:
  supporting context; validate against canonical docs before making decisions.
- `status: archived` or `superseded`:
  historical traceability only unless a task explicitly requests historical analysis.
- `authoritativeness: historical`:
  do not treat as current implementation authority, even if still discoverable in the index.

Use the metadata header in each doc as the source of truth, not the document path.

## Using Indexed Historical Documents Safely

When an indexed result is historical (`archived`, `superseded`, or `authoritativeness: historical`):

1. Label it explicitly as historical evidence in notes/prompts/reviews.
2. Follow redirects/supersession links to active replacements.
3. Confirm current behavior from active canonical docs before implementing.
4. Keep historical docs out of final authority lists unless the task is migration parity or historical reconstruction.

## Prompt and Review Checklist

- Did I begin from the index rather than folder guessing?
- Did I verify `status` and `authoritativeness` for each selected doc?
- Did I separate findability (index hit) from authority (metadata + active canonical source)?
- Did I mark historical docs as evidence-only?
- If active authority was unclear, did I request a docs follow-up instead of guessing?

## Related Documentation

- `docs/context/documentation-index.md`
- `docs/context/documentation-registry.md`
- `docs/context/documentation-status-signals.md`
- `docs/contributors/active-vs-historical-docs-worked-examples.md`
- `docs/contributors/context-engineering-system-guide.md`
