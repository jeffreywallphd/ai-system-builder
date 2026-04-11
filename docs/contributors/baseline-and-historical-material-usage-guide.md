---
title: Baseline and Historical Material Usage Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/baselines/README.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - docs/context/documentation-segmentation-taxonomy.md
  - docs/context/prompt-routing.md
  - docs/context/context-map.json
  - docs/architecture/README.md
  - docs/contributors/context-engineering-system-guide.md
  - dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts
---

# Baseline and Historical Material Usage Guide

## Purpose

Help contributors use baseline, transition, and historical documentation as evidence when needed without treating it as current authority.

## Active-First Rule for This Repository

Use active docs as the default authority for implementation and review:

- `docs/architecture/README.md` and current architecture domain docs for system contracts.
- `docs/contributors/README.md` and contributor guides for delivery workflow.
- `docs/context/prompt-routing.md` plus routing artifacts for AI context assembly rules.

Use `docs/baselines/` and superseded/transition notes only when your task explicitly needs historical traceability.

## What Baselines and Historical Material Are For

- Reconstructing why a migration happened and what changed across a completed story or feature.
- Confirming behavioral parity targets during refactors where prior behavior must be preserved.
- Auditing completion evidence, rollout chronology, and retired-path lineage.
- Supporting design review discussion when a current decision references prior constraints.

They are not authoritative sources for current implementation behavior.

## Workflow Guidance by Task Type

### Implementation Tasks

Use historical material only after checking active authority first.

Use it when:
- You are preserving parity during migration/refactor and need a prior-state snapshot.
- A test failure or regression suggests behavior drift from a known baseline state.
- A superseded pointer links to a baseline artifact that explains a removed path.

Do not use it when:
- Active architecture/contributor docs already define current contracts.
- Baseline guidance conflicts with active docs. Follow active docs and treat baseline conflict as historical evidence only.

Required implementation behavior:
- Cite the active canonical doc in code/docs updates.
- If baseline evidence was used, label it as historical in PR/task notes.
- Add or update tests against current contracts, not baseline prose.

### Design Reviews

Start with active architecture and ADR authority, then use baseline/historical material to validate context.

Use it when:
- Reviewing whether a proposed change unintentionally reintroduces a retired design.
- Verifying that a migration preserved intended invariants documented in active architecture.
- Explaining tradeoffs by contrasting current architecture with previous delivery states.

Do not use it when:
- Baseline snapshots are being cited as if they override active architecture references.
- Review findings depend on superseded notes without cross-checking current docs.

Required review behavior:
- Record findings against active contracts first.
- Mark baseline references as historical supporting evidence.
- Call out any stale-source dependence as a documentation trust issue.

### AI Prompt Construction

Treat baseline/historical context as opt-in only.

Use active routing sources first:
1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/prompt-routing.md`

Add baseline or historical docs only if requested outcomes explicitly require history (for example migration traceability, parity audit, or retired-path analysis).

Prompt construction rules:
- Keep active canonical docs in the prompt even when adding historical references.
- Label historical sources in the prompt as "non-authoritative historical evidence."
- Exclude `docs/baselines/` and superseded pointers by default, consistent with prompt-routing exclusion rules.
- If historical and active docs disagree, resolve to active canonical docs and report the mismatch.

## Baselines, Transitional Notes, and Superseded Documents: Quick Decision Table

| Document class | Default handling | Allowed use | Prohibited use |
| --- | --- | --- | --- |
| Baseline artifacts (`docs/baselines/`) | Exclude by default | Historical parity checks, migration evidence, chronology | Defining current contracts or implementation direction |
| Transitional notes | Exclude unless task targets migration continuity | Link continuity, rollout handoff context | Carrying durable executable guidance |
| Superseded/deprecated docs | Treat as redirects to canonical replacements | Finding replacement paths and retirement rationale | Serving as primary authority for current decisions |

## Practical Examples in AI Loom Studio

1. Runtime host refactor: use active host assembly docs as authority; use baseline host snapshots only to verify parity claims.
2. Documentation migration review: use active docs placement and taxonomy guides as authority; use migration inventory/baselines only to check traceability completeness.
3. AI implementation prompt: include mapped active architecture + contributor docs first; include baseline docs only when requested outcomes explicitly ask for historical evidence.
4. For expanded scenario walkthroughs across decomposition, architecture review, migration planning, and troubleshooting, use `docs/contributors/active-vs-historical-docs-worked-examples.md`.

## Validation and Governance Hooks

- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
- `docs/context/documentation-supersession-and-redirect-conventions.md`
- `docs/context/documentation-status-signals.md`
- `docs/contributors/active-vs-historical-docs-worked-examples.md`
- `dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts`

Run:

```bash
npm run docs:validate:foundation
bun test dev/tests/DocumentationBaselineHistoricalUsageStory534Guardrails.test.ts
```
