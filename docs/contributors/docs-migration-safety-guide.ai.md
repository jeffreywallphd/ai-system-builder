---
title: AI Companion: Documentation Migration Safety Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/tests/DocumentationMigrationSafetyGuideGuardrails.test.ts
---

# AI Companion: Documentation Migration Safety Guide

## Purpose

Use this guide when documentation is moved, split, or reclassified so migrations preserve authority and link stability.

## Migration Contract

Before editing content, define:

- Destination authoritative path.
- Destination metadata (`doc_type`, `status`, `authoritativeness`, `owned_by`, `last_reviewed`).
- Inbound links that must be updated.
- Whether a pointer note is required at the old path.

## Safe Sequence

1. Create destination doc first with complete metadata and canonical content.
2. Update routers and known inbound links.
3. Add old-path deprecation/pointer notes.
4. Set lifecycle metadata (`deprecated` or `superseded` + `superseded_by`).
5. Run validation checks before merge.

## Moving and Splitting Rules

- Move: preserve old path with pointer notes when references may persist.
- Split: keep one canonical owner per responsibility; source doc becomes pointer/index or superseded.
- Avoid parallel canonical copies after split.

## Reclassification Rules

When changing doc role or authority, update metadata intentionally:

- `doc_type` must match actual role.
- `authoritativeness` must reflect source-of-truth level.
- `status` must reflect lifecycle.
- `status: superseded` requires `superseded_by`.

## Mixed Historical + Active Content

Do not keep mixed authority indefinitely.

Preferred handling:

- Active guidance -> canonical active doc.
- Historical material -> `docs/baselines/` or superseded/historical docs.

Temporary bridge (only if needed):

- `## Current Canonical Guidance`
- `## Historical Context (Non-Authoritative)`

## Pointer Note Expectations

Pointer notes should state replacement path, effective date, and canonical authority.
Use `docs/context/documentation-supersession-and-redirect-conventions.ai.md` as the canonical supersession/redirect format source.
Use `docs/context/documentation-segmentation-seed-guidance.ai.md` for reusable classification notes, supersession markers, baseline introductions, and migration checklist seeds.

Example:

```markdown
This document moved to `docs/<new-path>.md` on YYYY-MM-DD.
Use the new path as the canonical source.
```

## Validation

```bash
npm run docs:validate:foundation
npm run docs:validate:segmentation
bun test dev/tests/DocumentationMigrationSafetyGuideGuardrails.test.ts
```
