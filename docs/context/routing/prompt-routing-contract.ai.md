---
title: "AI Companion: Prompt Routing Contract and Task Categories"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/routing/task-to-context-routing.contract.json
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/packs/context-pack-catalog.seed.json
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

## Exclusion Rules

- Exclude deprecated packs unless explicitly requested.
- Exclude packs outside task scope.
- Apply explicit `excludePackIds` before fallback evaluation.
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
- Do not redefine category semantics per mapping entry.
