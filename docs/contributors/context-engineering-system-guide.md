# Context Engineering System Contributor Guide

## Purpose

Give contributors a practical workflow for preparing prompts, decomposition plans, implementation tasks, and review tasks using the context engineering system in this repository.

## Canonical Sources

Use these as source of truth:

1. `docs/context/routing/task-to-context-routing.contract.json`
2. `docs/context/routing/task-to-context-routing.seed.json`
3. `docs/context/context-map.json`
4. `docs/context/packs/context-pack-catalog.seed.json`
5. `docs/context/packs/context-pack.contract.json`
6. `docs/context/prompt-routing.md`
7. `docs/context/governance/context-system-rollout-boundaries.md`

## Routing Workflow

1. Classify the task into one `taskCategory`:
   - `architecture-review`
   - `feature-decomposition`
   - `coding-implementation`
   - `migration-refactor`
   - `diagnostics`
   - `ui-studio`
   - `runtime-security`
   - `documentation-change`
2. Fill required routing inputs exactly:
   - `taskSummary`
   - `taskCategory`
   - `requestedOutcomes`
   - `changedPaths`
   - `constraints`
3. Load the matching mapping from `task-to-context-routing.seed.json`.
4. Apply the mapping's `packIds`, `selectionMode`, `priorityTier`, and `contextAssemblyProfileId`.
5. Assemble context in tier order from `foundation-domain-implementation-optional-v1`:
   - `foundation`
   - `domain`
   - `implementation`
   - `optional`
6. Stop when requested outcomes are covered by authoritative docs and paths.

## When To Use Context Packs

Use packs when you need stable, reusable context for cross-document retrieval:

- Start with baseline order: `repository-overview`, `architecture-core`, `context-system-foundations`.
- Add category packs from routing mappings:
  - `runtime-and-host` for host/startup/runtime behavior and diagnostics.
  - `identity-and-security` for authz/authn/trust/secrets and security-sensitive work.
  - `studio-and-system-composition` for Studio Shell/System Studio/UI interaction work.
  - `documentation-refactor` for docs structure, contracts, routers, and validation.
- Respect `excludePackIds` and any explicit task exclusions.

Do not pick packs ad hoc when a mapping already defines deterministic order.

## How To Avoid Over-Contexting

- Keep first-tier context (`foundation`, `domain`) authoritative; add lower tiers only for unresolved gaps.
- Prefer canonical documents over related summaries.
- Exclude unrelated domains not present in `changedPaths` or declared surfaces.
- Remove `optional` and non-authoritative material first when context grows.
- Do not mix multiple task categories in one prompt if decomposition can split the work safely.

## Index-First Discovery in Daily Work (Story 6.3.4)

Before finalizing context for any task category:

1. Start in `docs/context/documentation-index.md` to gather candidate docs and stable `recordId` values.
2. Confirm each candidate's `status` and `authoritativeness` from document metadata before using it as authority.
3. Keep findability and authority separate:
   - index hit = discoverable candidate
   - active canonical metadata = implementation authority
4. If a candidate is `archived`, `superseded`, or `historical`, treat it as evidence-only and follow active replacements.

For full daily usage details and review checks, use:
- `docs/contributors/documentation-index-daily-usage-guide.md`

## Worked Retrieval Flows for Real Tasks (Story 6.3.5)

When task context is ambiguous, use:
- `docs/contributors/documentation-index-assisted-discovery-worked-examples.md`

These examples show how to:
- start from index task workflows and collect `recordId` values
- cross-check domain and status before authority decisions
- map selected records to routing `taskId` and `relatedDocRecordIds`
- keep taxonomy/status and authority checks explicit for security and diagnostics tasks

## Task Playbooks

### Prompt Preparation

1. Capture required routing inputs and outcome format.
2. Pull mapped `packIds` and top `relatedDocPaths`.
3. Include only the docs needed to answer the current prompt.

### Feature Decomposition

1. Route as `feature-decomposition`.
2. Build slices using mapped architecture + baseline references.
3. For each slice, produce:
   - candidate `changedPaths`
   - tests to add/update
   - docs to add/update
4. Re-route each slice independently before implementation.

### Implementation Tasks

1. Route as `coding-implementation` (or `runtime-security` when policy/trust boundaries are touched).
2. Keep edits scoped to mapped paths and constraints.
3. Validate outcomes with targeted tests and guardrails.
4. Update `.md` and `.ai.md` doc pairs when behavior or contracts change.

### Reviews (Code or Design)

1. Route as `architecture-review` for boundary/contract reviews, or `documentation-change` for docs governance reviews.
2. Evaluate alignment against mapped authoritative docs first.
3. Call out context drift:
   - missing canonical sources
   - conflicting summaries
   - stale or superseded references
4. Require follow-up updates to routing assets when repeated drift appears.

## Example Prompt Assembly Workflows

Use these workflows when writing contributor prompts so context stays deterministic, minimal, and authoritative.

### Workflow 1: Feature Decomposition Prompt

Route selection:
- `taskCategory`: `feature-decomposition`
- `taskId`: `feature-decomposition-epic-story-planning`

Minimum sufficient context:
- Packs: `repository-overview`, `architecture-core`, `context-system-foundations`
- Authoritative docs:
1. `docs/architecture/README.md`
2. `docs/baselines/README.md`
3. `docs/context/routing/prompt-routing-contract.md`
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
3) docs/context/routing/prompt-routing-contract.md

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
1. `docs/context/routing/README.md`
2. `docs/context/context-asset-metadata.md`
3. `docs/contributors/router-overview-writing-standard.md`
4. `docs/contributors/docs-placement-guide.md`
5. `docs/contributors/docs-migration-safety-guide.md`
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

Before extending routing or packs, confirm the requested change is outside initial-release boundaries documented in `docs/context/governance/context-system-rollout-boundaries.md`.

When adding or changing routing mappings:

- Keep `taskId` stable.
- Use supported categories and allowed values only (`selectionMode`, `priorityTier`, `status`).
- Include all required mapping fields and metadata fields from the contract.
- Keep `contextAssemblyTierHints` complete across all tiers with descending weights.
- Add or update `relatedDocPaths` and `relatedCodePaths` to real repository paths.

When adding a new context pack:

- Follow required pack headings exactly:
  - `## Purpose`
  - `## When To Use`
  - `## When Not To Use`
  - `## Invariants`
  - `## Authoritative Docs`
  - `## Authoritative Code Paths`
  - `## Anti-Patterns`
  - `## Related Packs`
- Register the pack in `context-pack-catalog.seed.json` with metadata contract fields.
- Keep pack content retrieval-first, concise, and non-duplicative.

## Validation Checklist Before Merge

1. `docs/contributors/context-engineering-system-guide.md` and `.ai.md` are both updated.
2. Routing/packs contracts and seeds remain parseable and consistent, including `context-map.json` pack/category/profile references and context-pack required headings.
3. Relevant `dev/tests` guardrails are updated for new routing or pack behavior.
4. `npm run docs:validate:foundation` passes.
5. `npm run docs:validate:segmentation` passes when segmentation or supersession paths are touched.
