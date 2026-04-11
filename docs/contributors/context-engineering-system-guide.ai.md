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

## Extending the System Responsibly

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
2. Routing and pack contracts/seeds remain aligned.
3. Relevant `dev/tests` guardrails are updated.
4. `npm run docs:validate:foundation` passes.
