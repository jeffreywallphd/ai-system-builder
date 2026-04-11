---
title: Documentation Migration Safety Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationMigrationSafetyGuideGuardrails.test.ts
---

# Documentation Migration Safety Guide

## Purpose

Provide one safe, repeatable migration workflow for moving, splitting, or reclassifying documentation without breaking navigation, authority signals, or historical traceability.

## Use This Guide When

- A document path changes (move/rename).
- A mixed-scope document is split into multiple documents.
- A document changes taxonomy role (`doc_type`) or authority/lifecycle state.

## Safe Migration Workflow

1. Plan the migration contract before editing content.
   - Decide the target authoritative path and metadata (`doc_type`, `status`, `authoritativeness`, `owned_by`, `last_reviewed`).
   - List inbound links to the old path from routers and reference docs.
2. Stage authority at the destination first.
   - Create the destination document with full metadata and complete content.
   - Keep the destination as the single source of truth before deprecating the source path.
3. Preserve link continuity.
   - Update known inbound links immediately.
   - Keep an old-path pointer note when external or unknown references may still exist.
4. Apply deprecation or supersession metadata on source docs.
   - Use `status: superseded` with `superseded_by` when a replacement exists.
   - Use `status: deprecated` for soft retirement without a single replacement.
5. Validate and review.
   - Run `npm run docs:validate:foundation`.
   - Run docs guardrail tests before merge.

## Moving Documents Safely

- Treat a move as path migration, not content deletion.
- If link stability matters, leave a short pointer note at the old path that links to the new canonical path.
- Keep pointer notes intentionally small and non-authoritative.
- Update router `README.md` and `README.ai.md` files when navigation entry points change.

## Splitting Documents Safely

- Split by responsibility boundaries, not arbitrary section count.
- Keep exactly one canonical document for each active responsibility.
- For a split source document:
  - Convert the source into a short index/pointer doc or mark it superseded.
  - Add explicit links to each replacement doc.
- Verify that split docs do not duplicate canonical guidance across multiple locations.

## Reclassifying Documents Safely

- Reclassification means taxonomy migration; update metadata intentionally.
- Required checks:
  - `doc_type` reflects actual role (`architecture-reference`, `runbook`, `contributor-guide`, etc.).
  - `authoritativeness` communicates source-of-truth level (`canonical`, `reference`, `supplemental`, `historical`).
  - `status` reflects lifecycle (`active`, `deprecated`, `superseded`, `archived`).
- If status becomes `superseded`, set `superseded_by`.

## Deprecation and Pointer Note Rules

- Prefer explicit supersession over silent removal.
- Keep deprecation notes at the old path whenever practical.
- Follow the canonical supersession/redirect pattern in `docs/context/documentation-supersession-and-redirect-conventions.md`.
- Pointer notes should include:
  - Non-authoritative supersession/deprecation statement.
  - Replacement document link.
  - Why the move/split/reclassification happened (one sentence).
  - Effective date.
  - Removal trigger for the old-path pointer.

Suggested pointer note body:

```markdown
This document moved to `docs/<new-path>.md` on YYYY-MM-DD.
Use the new document as the canonical source.
```

## Handling Mixed Historical and Active Content

- Do not leave active and historical authority mixed in one long-lived canonical doc.
- Preferred approach:
  - Extract active guidance to an `active` canonical document.
  - Move historical snapshots to `docs/baselines/` or a superseded ADR/reference doc.
- If immediate split is not possible, add explicit sections:
  - `## Current Canonical Guidance`
  - `## Historical Context (Non-Authoritative)`
- Complete the split in a follow-up change before adding new feature guidance.

## Human and AI Agent Checklist

- Confirm destination authority and metadata before moving content.
- Preserve or replace every known inbound link.
- Add deprecation/supersession metadata and pointer notes where needed.
- Keep `.md` and `.ai.md` companion docs aligned for routing metadata.
- Run validation:

```bash
npm run docs:validate:foundation
bun test dev/tests/DocumentationMigrationSafetyGuideGuardrails.test.ts
```
