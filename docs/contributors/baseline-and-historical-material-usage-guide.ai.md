---
title: "AI Companion: Baseline and Historical Material Usage Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/baselines/README.ai.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.ai.md
  - docs/context/documentation-segmentation-taxonomy.ai.md
  - docs/context/prompt-routing.ai.md
  - docs/context/context-map.json
  - docs/architecture/README.ai.md
  - docs/contributors/context-engineering-system-guide.ai.md
  - dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts
---

# AI Companion: Baseline and Historical Material Usage Guide

## Purpose

Use baseline and historical docs as traceability evidence when needed without treating them as current authority.

## Active-First Rule

Default authority comes from active docs:

- `docs/architecture/README.ai.md` and active architecture domain references.
- `docs/contributors/README.ai.md` and active contributor guides.
- `docs/context/prompt-routing.ai.md` and routing contracts/seeds.

Use `docs/baselines/` and superseded/transition notes only when outcomes explicitly require historical evidence.

## What Historical Material Is For

- Migration and completion traceability.
- Parity checks during refactor/migration work.
- Retired-path lineage and chronology.
- Historical evidence during design review.

Not for defining current implementation contracts.

## Workflow Rules

### Implementation Tasks

Use historical docs only after active authority checks.

Use it when:
- Prior-state parity checks for migration/refactor.
- Regression investigation tied to a known baseline snapshot.
- Superseded-pointer follow-up to locate retired-path history.

Do not use it when:
- Replacing active architecture/contributor contracts with baseline guidance.
- Treating baseline conflicts as current policy.

Required:
- Keep active canonical sources as decision authority.
- Mark baseline usage as historical evidence in notes/reviews.
- Validate behavior with tests aligned to current contracts.

### Design Reviews

Review against active architecture and ADR authority first.

Use it when:
- Detecting accidental reintroduction of retired design patterns.
- Verifying migration parity against current invariants.
- Providing historical comparison context for tradeoff discussion.

Do not use it when:
- Findings based only on superseded/baseline docs.
- Citing historical docs as override authority.

Required:
- Record findings against current contracts first.
- Label historical references as supporting evidence only.
- Flag stale-source dependence as a docs-trust issue.

### AI Prompt Construction

Baseline/historical docs are opt-in only.

Primary routing sources:
1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/prompt-routing.ai.md`

Include historical docs only when outcomes explicitly require migration traceability, parity audit, or retired-path analysis.

Prompt rules:
- Keep active canonical docs in the context set even when history is added.
- Label historical sources as non-authoritative evidence.
- Exclude `docs/baselines/` and superseded pointers by default.
- If active and historical docs conflict, follow active canonical docs and report mismatch.

## Quick Decision Table

| Document class | Default handling | Allowed use | Prohibited use |
| --- | --- | --- | --- |
| Baseline artifacts (`docs/baselines/`) | Exclude by default | Historical evidence and parity checks | Current contract authority |
| Transitional notes | Exclude unless migration continuity is requested | Redirect continuity and rollout handoff context | Durable executable guidance |
| Superseded/deprecated docs | Redirect to replacement | Locate replacement path and retirement rationale | Primary authority for current behavior |

## Practical Examples

1. Runtime host refactor: active host docs are authoritative; baseline snapshots are parity evidence only.
2. Docs migration review: active placement/taxonomy docs are authoritative; baselines confirm traceability.
3. AI implementation prompt: load mapped active docs first, then add historical sources only when explicitly required.

## Validation Hooks

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- `docs/context/documentation-status-signals.ai.md`
- `dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts`

Run:

```bash
npm run docs:validate:foundation
bun test dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts
```
