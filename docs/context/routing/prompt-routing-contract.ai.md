---
title: "AI Companion: Prompt Routing Contract and Task Categories"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/context-asset-metadata.contract.json
  - docs/context/routing/task-to-context-routing.contract.json
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/packs/context-pack-catalog.seed.json
  - dev/tests/ContextAssetMetadataStandardsGuardrails.test.ts
  - dev/tests/TaskToContextRoutingContractGuardrails.test.ts
---

# AI Companion: Prompt Routing Contract and Task Categories

## Purpose

Define deterministic routing semantics so assistants and engineers choose the right context assets without ad hoc prompt assembly.

## Routing Inputs Contract

Required routing fields:

- `taskSummary`: concise statement of requested work.
- `taskCategory`: one supported category.
- `requestedOutcomes`: expected outputs (implementation, tests, docs, analysis).
- `changedPaths`: repo paths in scope.
- `constraints`: hard boundaries (security, compatibility, architecture).

Optional routing fields:

- `primarySurfaces`
- `qualityGates`
- `exclusions`
- `notes`

## Supported Task Categories

Use exactly one category per mapping:

- `architecture-review`
Inclusion: architecture boundaries, contracts, extension seams.
Exclusion: straightforward implementation-only tasks.
- `feature-decomposition`
Inclusion: slicing stories/features into executable work packages.
Exclusion: direct coding without decomposition.
- `coding-implementation`
Inclusion: runtime behavior changes in code with tests.
Exclusion: docs-only or migration-only work.
- `migration-refactor`
Inclusion: structural changes preserving behavior.
Exclusion: net-new feature behavior as the primary goal.
- `diagnostics`
Inclusion: regressions, failures, root-cause, fix validation.
Exclusion: speculative design work with no active failure.
- `ui-studio`
Inclusion: renderer/studio UX and state flow changes.
Exclusion: backend/runtime-only tasks with no user-facing surface.
- `runtime-security`
Inclusion: authorization, secrets, policy, transport/runtime hardening.
Exclusion: feature work without security/policy boundary changes.
- `documentation-change`
Inclusion: docs contracts, routers, canonical reference updates.
Exclusion: code-only work with no documentation contract impact.

## Pack Selection Rules

- Select active packs that match both category and path scope.
- Respect declared ordering in `packIds`; preserve deterministic output order.
- Apply pack priority metadata when overlaps occur; lower numbers win.
- Keep selected context minimal and outcome-focused.
- Include governance/taxonomy packs when contract artifacts are changed.
- Include ADR references in mapping `relatedDocPaths` only for foundational or high-risk decision constraints.
- Apply `contextAssemblyProfileId` and `contextAssemblyTierHints` before loading lower-signal supporting sources.

## Context Assembly Priority and Ordering

Use `foundation-domain-implementation-optional-v1` across initial categories:

1. `foundation` (required, highest priority)
Load routing contracts and foundational context-pack guidance first.
2. `domain` (required, high priority)
Load category-mapped domain references constrained by `changedPaths` and requested outcomes.
3. `implementation` (conditional, medium priority)
Load implementation-deep references only when quality gates or touched surfaces require them.
4. `optional` (opt-in, lowest priority)
Load supporting summaries only for explicit unresolved gaps.

Deterministic ordering and token guardrails:

- Enforce fixed tier sequence: `foundation -> domain -> implementation -> optional`.
- Complete higher-tier coverage before adding lower-tier context.
- Drop optional tier sources first when context grows noisy.
- Never allow lower-tier related material to override higher-tier authoritative sources.
- Keep tier weights strictly descending for predictable precedence.

## Exclusion Rules

- Exclude deprecated packs unless explicitly requested.
- Exclude packs outside task scope.
- Apply explicit `excludePackIds` before fallback evaluation.
- Exclude baseline or historical docs by default unless `routingInputs` or `requestedOutcomes` explicitly require historical evidence.
- Exclude superseded pointer docs by default unless the task is supersession maintenance, redirect validation, or migration traceability.
- Do not infer random replacements when all primary packs are excluded.

## Priority and Fallback Behavior

Priority tiers:

- `critical`
- `high`
- `normal`
- `low`

Fallback behavior:

- Trigger when primary packs are unavailable, inactive, or excluded.
- Resolve via category defaults first.
- Then resolve via global fallback defaults from the routing seed.
- Keep fallback sequence deterministic.

## Mapping Authoring Rules

- Keep `taskId` stable after publication.
- Use only supported `taskCategory`, `selectionMode`, `priorityTier`, and `status` values.
- Always include required `routingInputs` fields.
- `contextAssemblyProfileId` must resolve to a defined contract profile.
- `contextAssemblyTierHints` must include every tier from `contextAssemblyTierOrder` with descending weights.
- Do not redefine category semantics per mapping entry.
- Keep active-authoritative docs in `relatedDocPaths` by default; add baseline/superseded links only when mapping intent explicitly requires historical evidence or supersession maintenance.
- Always include mapping metadata fields:
`id`, `title`, `purpose`, `domain`, `owner`, `status`, `relatedDocPaths`, `relatedCodePaths`.
- `relatedDocRecordIds` is optional and provides stable-key references to registry record ids.
- Keep `id` equal to or deterministically derived from `taskId`.
- `reviewExpectations` is optional; if present it must include `cadence`.
