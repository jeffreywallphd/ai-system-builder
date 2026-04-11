---
title: AI Companion: Documentation Foundation Validation Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocsFoundationValidationScript.test.ts
---

# AI Companion: Documentation Foundation Validation Guide

## Purpose and Audience

Use this guide to run the baseline docs foundation validator before or during documentation changes.

## What the Validator Checks

- Required top-level docs folders exist.
- Root and top-level routers keep required `README.md` and `README.ai.md` files.
- Required `docs/context` foundation subfolders and seed artifacts exist (`packs`, `routing`, `governance`, `templates`).
- Context foundation contract/seed JSON artifacts keep expected schema markers.
- Seed docs keep required metadata header fields with taxonomy-aligned enum values.
- Seed `.md` and `.ai.md` pairs stay aligned on routing metadata.

## Run Command

```bash
npm run docs:validate:foundation
```

## CI Contract

Use the same command in CI so baseline structure regressions fail fast with clear codes.

## Common Failure Codes

- `TOP_LEVEL_FOLDER_MISSING`
- `ROUTER_FILE_MISSING`
- `CONTEXT_SUBFOLDER_MISSING`
- `CONTEXT_FILE_MISSING`
- `FRONTMATTER_INVALID`
- `HEADER_ENUM_INVALID`
- `SEED_PAIR_MISMATCH`

## Scope Notes

This check is an early guardrail. Keep it lightweight and focused on baseline structure and metadata contract consistency.
