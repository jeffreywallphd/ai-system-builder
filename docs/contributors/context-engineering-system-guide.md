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

## Extending the System Responsibly

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
2. Routing/packs contracts and seeds remain parseable and consistent.
3. Relevant `dev/tests` guardrails are updated for new routing or pack behavior.
4. `npm run docs:validate:foundation` passes.
