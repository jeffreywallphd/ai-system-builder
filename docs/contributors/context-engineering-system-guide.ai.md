# AI Companion: Context Engineering System Contributor Guide

## Purpose

Deterministic workflow for AI agents and contributors preparing prompts, decomposition plans, implementation tasks, and review tasks with the repository context engineering system.

## Canonical Sources

Treat these as authoritative:

1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/packs/context-pack-catalog.seed.json`
5. `docs/context/packs/context-pack.contract.json`
6. `docs/context/prompt-routing.ai.md`
7. `docs/context/governance/context-system-rollout-boundaries.ai.md`

## Routing Workflow

1. Pick exactly one `taskCategory`:
   - `architecture-review`
   - `feature-decomposition`
   - `coding-implementation`
   - `migration-refactor`
   - `diagnostics`
   - `ui-studio`
   - `runtime-security`
   - `documentation-change`
2. Provide required routing inputs:
   - `taskSummary`
   - `taskCategory`
   - `requestedOutcomes`
   - `changedPaths`
   - `constraints`
3. Resolve the mapping in `task-to-context-routing.seed.json`.
4. Apply mapping values: `packIds`, `selectionMode`, `priorityTier`, `contextAssemblyProfileId`.
5. Assemble context by profile tier order:
   - `foundation`
   - `domain`
   - `implementation`
   - `optional`
6. Stop once authoritative context is sufficient for requested outcomes.

## When To Use Context Packs

Use packs for stable multi-doc retrieval:

- Default order: `repository-overview`, `architecture-core`, `context-system-foundations`.
- Insert category packs when mapped:
  - `runtime-and-host`
  - `identity-and-security`
  - `studio-and-system-composition`
  - `documentation-refactor`
- Enforce mapped exclusions and task-specific exclusions.

Do not bypass routing mappings with ad hoc pack selection.

## How To Avoid Over-Contexting

- Keep authority in `foundation` and `domain` tiers first.
- Add `implementation` and `optional` tiers only for explicit unresolved gaps.
- Prioritize canonical contracts/docs over related summaries.
- Drop unrelated or low-signal assets before adding more files.
- Split multi-category requests into separate routed passes.

## Task Playbooks

### Prompt Preparation

1. Capture required routing inputs.
2. Pull mapped `packIds` and top `relatedDocPaths`.
3. Assemble minimum sufficient context only.

### Feature Decomposition

1. Route as `feature-decomposition`.
2. Build implementation slices from mapped architecture/context docs.
3. For each slice, output `changedPaths`, tests, and docs updates.
4. Re-route each slice before coding.

### Implementation Tasks

1. Route as `coding-implementation` (or `runtime-security` if policy/trust boundaries are touched).
2. Keep code and docs changes bounded to mapped scope.
3. Validate with targeted tests and guardrails.
4. Keep `.md` and `.ai.md` pairs aligned.

### Reviews (Code or Design)

1. Use `architecture-review` for boundary/contract reviews or `documentation-change` for docs-governance reviews.
2. Compare behavior and changes against mapped authoritative docs first.
3. Flag drift:
   - missing canonical docs
   - non-authoritative conflicts
   - stale/superseded sources
4. Require routing/pack updates if drift repeats.

## Example Prompt Assembly Workflows

Use these workflows to build contributor prompts with deterministic routing, minimum sufficient context, and authoritative-source precedence.

### Workflow 1: Feature Decomposition Prompt

Route selection:
- `taskCategory`: `feature-decomposition`
- `taskId`: `feature-decomposition-epic-story-planning`

Minimum sufficient context:
- Packs: `repository-overview`, `architecture-core`, `context-system-foundations`
- Authoritative docs:
1. `docs/architecture/README.md`
2. `docs/baselines/README.md`
3. `docs/context/routing/prompt-routing-contract.ai.md`
- Exclude runtime diagnostics and UI-specific docs unless requested outcomes explicitly require them.

Prompt scaffold:
```text
You are decomposing a new feature into implementation-ready slices for AI Loom Studio.
Routing metadata:
- taskCategory: feature-decomposition
- taskId: feature-decomposition-epic-story-planning
- changedPaths: [docs/architecture, docs/context/routing, src/application, src/domain]
- requestedOutcomes: [slice-plan, dependency-order, test-and-docs-plan]
- constraints: [respect-existing-host-and-layer-boundaries, avoid-speculative-abstractions]

Use minimum sufficient context only. Prioritize authoritative sources in this order:
1) docs/architecture/README.md
2) docs/baselines/README.md
3) docs/context/routing/prompt-routing-contract.ai.md

Output:
- implementation slices with dependency order
- changedPaths per slice
- required tests and doc updates per slice
```

### Workflow 2: Implementation Prompt

Route selection:
- `taskCategory`: `coding-implementation`
- `taskId`: `runtime-host-coding-implementation`

Minimum sufficient context:
- Packs: `repository-overview`, `architecture-core`, `runtime-and-host`, `context-system-foundations`
- Authoritative docs:
1. `docs/architecture/host-bootstrap-pipeline.md`
2. `docs/architecture/host-runtime-composition-boundaries.md`
3. `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`
4. `docs/architecture/desktop-auth-first-startup-boundary.md`
- Exclude unrelated UI and broad security references unless runtime evidence requires them.

Prompt scaffold:
```text
You are implementing a runtime/host startup behavior change in AI Loom Studio.
Routing metadata:
- taskCategory: coding-implementation
- taskId: runtime-host-coding-implementation
- changedPaths: [src/hosts, electron/main, src/infrastructure/runtime, dev/tests]
- requestedOutcomes: [code-change, targeted-regression-tests, docs-update-where-contracts-changed]
- constraints: [preserve-host-authority-boundaries, keep-auth-first-and-post-login-startup-boundaries-explicit]

Use only minimum sufficient context and authoritative docs listed below.
Do not add unrelated packs or neighboring docs without explicit gap justification.

Return:
- implementation plan
- concrete file edits
- tests and docs updates required for contract alignment
```

### Workflow 3: Architecture Review Prompt

Route selection:
- `taskCategory`: `architecture-review`
- `taskId`: `architecture-review-host-boundaries`

Minimum sufficient context:
- Packs: `repository-overview`, `architecture-core`, `runtime-and-host`, `context-system-foundations`
- Authoritative docs:
1. `docs/architecture/authoritative-server-host-assembly.md`
2. `docs/architecture/desktop-host-assembly.md`
3. `docs/architecture/worker-host-assembly.md`
4. `docs/architecture/studio-handoff-contract.md`
- Exclude stale baseline snapshots and UI-only docs when evaluating host boundaries.

Prompt scaffold:
```text
You are reviewing architecture boundary changes before implementation.
Routing metadata:
- taskCategory: architecture-review
- taskId: architecture-review-host-boundaries
- changedPaths: [src/hosts, src/application, docs/architecture, dev/tests/HostCompositionArchitectureGuardrails.test.ts]
- requestedOutcomes: [boundary-review, contract-impact-summary, recommended-change-plan]
- constraints: [preserve-layered-architecture-direction, avoid-cross-layer-shortcuts]

Evaluate only against authoritative host-boundary contracts first.
Call out conflicts, missing contracts, and context drift.

Output:
- boundary findings
- risk-ranked recommendations
- required test/doc follow-ups
```

### Workflow 4: Documentation Refactor Prompt

Route selection:
- `taskCategory`: `documentation-change`
- `taskId`: `documentation-refactor-context-and-architecture`

Minimum sufficient context:
- Packs: `repository-overview`, `architecture-core`, `documentation-refactor`, `context-system-foundations`
- Authoritative docs:
1. `docs/context/routing/README.ai.md`
2. `docs/context/context-asset-metadata.ai.md`
3. `docs/contributors/router-overview-writing-standard.ai.md`
4. `docs/contributors/docs-placement-guide.ai.md`
5. `docs/contributors/docs-migration-safety-guide.ai.md`
- Exclude implementation-only runtime docs unless a docs claim depends on verified runtime behavior.

Prompt scaffold:
```text
You are refactoring context and architecture documentation in AI Loom Studio.
Routing metadata:
- taskCategory: documentation-change
- taskId: documentation-refactor-context-and-architecture
- changedPaths: [docs/context, docs/architecture, docs/contributors, dev/tests]
- requestedOutcomes: [docs-update, metadata-alignment, guardrail-test-updates]
- constraints: [keep-md-and-ai-doc-pairs-aligned, preserve-canonical-router-links]

Keep context minimal and authoritative. Prefer contracts and router standards over narrative summaries.
Ensure both .md and .ai.md are updated together.

Return:
- exact doc/test files to change
- required section-level edits
- validation checklist execution plan
```

## Extending the System Responsibly

Before adding packs or routing entries, confirm the request is outside initial-release boundaries in `docs/context/governance/context-system-rollout-boundaries.ai.md`.

Routing mapping changes:

- Keep `taskId` stable.
- Use contract-allowed category and enum values only.
- Include all required mapping and metadata fields.
- Define all `contextAssemblyTierHints` with descending weights.
- Keep `relatedDocPaths` and `relatedCodePaths` valid and current.

New context packs:

- Enforce required headings:
  - `## Purpose`
  - `## When To Use`
  - `## When Not To Use`
  - `## Invariants`
  - `## Authoritative Docs`
  - `## Authoritative Code Paths`
  - `## Anti-Patterns`
  - `## Related Packs`
- Register the pack in `context-pack-catalog.seed.json`.
- Keep content concise, retrieval-first, and non-duplicative.

## Validation Checklist Before Merge

1. Human and AI guide files are both updated.
2. Routing and pack contracts/seeds remain aligned, including `context-map.json` pack/category/profile references and required context-pack headings.
3. Relevant `dev/tests` guardrails are updated.
4. `npm run docs:validate:foundation` passes.
5. `npm run docs:validate:segmentation` passes when segmentation or supersession paths are touched.
