---
title: "AI Companion: Documentation Index Daily Usage Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-index.ai.md
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-status-signals.ai.md
  - docs/contributors/context-engineering-system-guide.ai.md
  - docs/contributors/baseline-and-historical-material-usage-guide.ai.md
  - dev/tests/DocumentationIndexContributorDailyUsageStory634Guardrails.test.ts
---

# AI Companion: Documentation Index Daily Usage Guide

## Purpose

Make index-first discovery part of normal contributor and AI workflow while preserving authority discipline.

## When to Consult the Index

Consult `docs/context/documentation-index.ai.md` first for:

1. Feature decomposition and implementation prompts.
2. Architecture review and boundary checks.
3. Runtime diagnostics and security-sensitive triage.
4. Documentation-change and migration tasks.

Avoid broad path scanning unless index coverage is missing.

## Daily Workflow (Findability Then Authority)

1. Start in the relevant index section:
   - `Browse by Task Workflow`
   - `Browse by Domain`
   - `Browse by Status`
2. Collect candidate docs and `recordId` values.
3. Open each candidate and validate authority metadata:
   - `status`
   - `authoritativeness`
   - supersession/redirect notices
4. Use active canonical docs as implementation authority.
5. Keep historical docs as evidence only.

The index is a findability layer, not an authority grant.

## Metadata Interpretation Contract

- `status: active` + `authoritativeness: canonical` -> primary implementation authority.
- `status: active` + `authoritativeness: reference|supplemental` -> supporting material; verify against canonical docs.
- `status: archived|superseded` -> historical/retrieval context, not current authority.
- `authoritativeness: historical` -> never current implementation authority.

Use doc metadata headers as source of truth, not folder location.

## Historical-Document Safety Rules

When indexed results include historical docs:

1. Label them as historical evidence in prompts/reviews.
2. Follow `superseded_by` and redirect targets to active docs.
3. Confirm current behavior using active canonical docs before coding.
4. Exclude historical docs from final authority lists unless task scope is migration parity/history reconstruction.

## Prompt and Review Checks

- Index-first lookup completed.
- `status` + `authoritativeness` validated for every cited authority doc.
- Findability and authority treated as separate decisions.
- Historical docs clearly tagged evidence-only.
- Ambiguous authority escalated as docs follow-up instead of guessed.

## Related Documentation

- `docs/context/documentation-index.ai.md`
- `docs/context/documentation-registry.ai.md`
- `docs/context/documentation-status-signals.ai.md`
- `docs/contributors/active-vs-historical-docs-worked-examples.ai.md`
- `docs/contributors/context-engineering-system-guide.ai.md`
