---
title: "AI Companion: Documentation Index Coverage Rules"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationIndexCoverageRulesStory615Guardrails.test.ts
---

# AI Companion: Documentation Index Coverage Rules (Story 6.1.5)

Use this file for deterministic index inclusion, selective indexing, and exclusions.

## Canonical Source

- Human-readable policy: `docs/context/documentation-index-coverage-rules.md`

## Coverage Modes

- `required`: must be represented in the registry when active authority docs exist.
- `selective`: index only curated anchors; do not index every file.
- `excluded`: do not create standalone registry entries.

## Required Categories

- Active architecture docs (`docs/architecture/`)
- Active contributor guides (`docs/contributors/`)
- Active operations runbooks and operational authority docs
- Context packs (`docs/context/packs/*.pack.md`)
- ADR records (`docs/adr/records/adr-*.md`)

## Selective Categories

- Baseline and migration snapshots (`docs/baselines/` and migration baseline anchors)
- Superseded or historical pointer material retained for redirects, lineage, or compliance traceability

## Excluded Categories

- Router `README.md` navigation files
- Template scaffolds in `docs/context/templates/`
- Prompt-helper docs in `docs/prompts/` unless promoted to canonical guidance
- AI companion duplicates (`*.ai.md`) as separate entries

## Status and Authority Rules

- Required categories usually map to `status: active`, `authoritativeness: canonical`.
- Historical/superseded selective entries should use explicit lifecycle and authority signals (`superseded|archived`, `historical`).
- Keep one entry per human path with optional `aiPath`; do not create duplicate AI-only entries.

## Registry Contract

- Machine-readable coverage rules live in `documentation-registry.seed.json` under `coveragePolicy`.
- `coveragePolicy` is validated so inclusion/exclusion boundaries remain explicit and auditable.

## Guardrails

- Story guardrail: `dev/tests/DocumentationIndexCoverageRulesStory615Guardrails.test.ts`
- Foundation validator: `dev/scripts/validate-docs-foundation.cjs`
