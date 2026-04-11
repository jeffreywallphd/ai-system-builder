---
title: Documentation Migration Baseline
doc_type: baseline
status: archived
authoritativeness: historical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-migration-baseline.inventory.json
---

# Documentation Migration Baseline (Story 1.1.1)

This artifact captures the current-state documentation structure and taxonomy baseline before any migration work.

## Scope
- Branch context: `codex-f2b6d46d4e`
- Audited path: `docs/**/*.(md|ai.md)`
- Audited files: 560
- Audited directories: 10
- Machine-readable inventory: `docs/documentation-migration-baseline.inventory.json`

## Current Folder Layout

| Directory | Files | Primary role concentration | Missing companions |
| --- | ---: | --- | ---: |
| `docs/architecture` | 471 | ai-context-oriented | 1 |
| `docs` | 51 | ai-context-oriented | 3 |
| `docs/context/templates` | 16 | ai-context-oriented | 0 |
| `docs/context` | 6 | operational | 0 |
| `docs/contributors` | 4 | operational | 0 |
| `docs/prompts` | 3 | operational | 1 |

## Role Category Breakdown (Primary Role)

| Role | Count |
| --- | ---: |
| architectural | 229 |
| operational | 36 |
| contributor-facing | 16 |
| historical | 2 |
| ai-context-oriented | 277 |

## Role Category Breakdown (Any Role Signal)

| Role | Count |
| --- | ---: |
| architectural | 471 |
| operational | 97 |
| contributor-facing | 31 |
| historical | 50 |
| ai-context-oriented | 277 |

## Major Observations
- The `docs/architecture/` subtree dominates the doc set with 471 files and mixes current architecture guidance with historical baselines.
- The docs root currently holds 51 markdown files, creating role ambiguity between contributor guides, operational runbooks, and AI companion content.
- Companion duplication is extensive: 554 files are in `.md`/`.ai.md` pairs and 6 files do not have a companion.
- Ownership signals are missing in 551 files, which limits migration accountability.

## Highest-Risk Structural Problems
- **HIGH** A small number of hub documents are overloaded navigation bottlenecks: Readers must parse very large documents to discover canonical docs, reducing findability and increasing onboarding cost.
- **HIGH** Ownership and stewardship metadata is mostly absent: Future migrations and maintenance cannot be routed predictably to responsible owners.
- **MEDIUM** `docs/` root is overloaded with mixed contributor and operational docs: Role ambiguity at the top-level folder makes navigation unpredictable and blocks scalable taxonomy expansion.
- **MEDIUM** Large `.md` / `.ai.md` companion surface increases drift risk: Dual maintenance across human and AI companion docs creates synchronization risk without explicit parity checks.
- **MEDIUM** Historical baseline docs are mixed with active guidance in the same namespaces: Without separate archival taxonomy, readers can misinterpret historical baselines as current source-of-truth guidance.

## Overloaded Document Examples
- `docs/architecture/desktop-auth-first-startup-boundary.md` (3097 words, 0 links)
- `docs/architecture/desktop-runtime-and-hosts.md` (3665 words, 0 links)
- `docs/architecture/domain-and-application-core.ai.md` (20495 words, 0 links)
- `docs/architecture/domain-and-application-core.md` (20863 words, 0 links)
- `docs/architecture/identity-foundation.md` (3362 words, 0 links)

## High-Value Anchor Files
- `docs/general-prompt-guidance.md`
- `docs/architecture/README.md`
- `docs/architecture/README.ai.md`
- `docs/startup-memory-review.md`
- `docs/unified-api-contributor-guide.md`

## Classification and Future-Move Signals
- Every markdown file in the scope is classified in the inventory with a primary role and optional secondary roles.
- Each file includes a `likelyTargetArea` hint to support later migration planning without moving files in this story.

## Enforcement
- `dev/tests/DocumentationMigrationBaselineGuardrails.test.ts` validates baseline coverage and role taxonomy integrity.
- Regenerate after docs changes with: `node dev/scripts/generate-docs-migration-baseline.cjs`.
