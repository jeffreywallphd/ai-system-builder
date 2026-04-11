---
title: Documentation Foundation Validation Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocsFoundationValidationScript.test.ts
---

# Documentation Foundation Validation Guide

## Purpose and Audience

Use this guide when you need a fast contract check for the documentation foundation introduced by Feature 1.

## What the Validator Checks

- Required top-level docs folders exist.
- Expected router files exist (`README.md` and `README.ai.md` at root and top-level docs areas).
- Required `docs/context` foundation subfolders and seed artifacts exist (`packs`, `routing`, `governance`, `templates`).
- Context foundation contracts/seeds are valid JSON and keep expected schema markers.
- Seed docs have a valid metadata header and stay aligned to taxonomy/metadata contracts.
- Seed `.md` and `.ai.md` pairs stay aligned for routing metadata fields.

## Run Locally

```bash
npm run docs:validate:foundation
```

## CI Usage

Run the same command in CI to block changes that erode the baseline docs structure contract.

```bash
npm run docs:validate:foundation
```

## Failure Output

Failures are printed with stable error codes so contributors can quickly locate the issue type.

Examples:
- `TOP_LEVEL_FOLDER_MISSING`
- `ROUTER_FILE_MISSING`
- `CONTEXT_SUBFOLDER_MISSING`
- `CONTEXT_FILE_MISSING`
- `HEADER_FIELD_MISSING`
- `SEED_PAIR_MISMATCH`

## Scope Notes

This validator is intentionally lightweight. It enforces the initial baseline guardrails and is not a full markdown linting or doc-quality system.
