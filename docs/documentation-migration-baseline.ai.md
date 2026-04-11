---
title: "AI Companion: Documentation Migration Baseline"
doc_type: baseline
status: archived
authoritativeness: historical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-migration-baseline.inventory.json
---

# AI Companion: Documentation Migration Baseline (Story 1.1.1)

Use `docs/documentation-migration-baseline.inventory.json` as the source of truth for the current docs layout, role classification, and migration risk baseline.

## Documentation Status
- Segment: `Baselines`
- Lifecycle status (`status`): `archived`
- Authority state (`authoritativeness`): `historical`
- Current guidance stance: this file is not authoritative for current implementation behavior; it preserves point-in-time baseline evidence
- Canonical active path(s): `docs/README.ai.md`, `docs/context/documentation-taxonomy.ai.md`, and `docs/context/documentation-segmentation-taxonomy.ai.md`

## What this baseline gives you
- Full inventory of `docs/**/*.(md|ai.md)` files with per-file role tags.
- Directory-level counts and companion-pairing signals.
- Explicit risk list for overloaded docs, ownership gaps, and namespace ambiguity.
- Non-destructive future-move hints (`likelyTargetArea`) for follow-on migration stories.

## Role taxonomy used
- `architectural`
- `operational`
- `contributor-facing`
- `historical`
- `ai-context-oriented`

## Guardrail expectations
- Update the inventory when docs are added, removed, or renamed.
- Keep every docs markdown file represented in the inventory with an allowed primary role.
- Keep this file and `docs/documentation-migration-baseline.md` aligned with inventory intent.

## Regeneration command
- `node dev/scripts/generate-docs-migration-baseline.cjs`
