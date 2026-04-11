---
title: Prompt Routing Contract and Task Categories
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

# Prompt Routing Contract and Task Categories

## Purpose

Define a durable, deterministic routing contract that maps common repository tasks to the correct context assets without ad hoc prompt assembly.

## Routing Inputs Contract

Every routing request must provide:

- `taskSummary`: one to three sentences describing the requested work.
- `taskCategory`: one category from the supported list below.
- `requestedOutcomes`: expected outputs (for example, implementation, tests, docs).
- `changedPaths`: repo paths in scope or expected to change.
- `constraints`: non-negotiable boundaries (for example, security, architecture, compatibility).

Optional but recommended:

- `primarySurfaces`: UI/API/host/runtime surfaces most likely affected.
- `qualityGates`: required validation checks (tests, linters, docs checks).
- `exclusions`: packs or domains explicitly excluded from this task.
- `notes`: any additional routing hints.

## Supported Task Categories

The category set is intentionally specific but stable:

- `architecture-review`: evaluate boundaries, contracts, or extension seams.
Inclusion: architecture docs, core domain/application boundaries, contract changes.
Exclusion: pure implementation tasks with no boundary/design decisions.
- `feature-decomposition`: break work into implementation slices and dependencies.
Inclusion: story slicing, sequencing, dependency and ownership planning.
Exclusion: direct coding/refactor execution without decomposition.
- `coding-implementation`: implement or modify runtime behavior.
Inclusion: application/domain/infrastructure/UI code changes with tests.
Exclusion: pure migration planning or docs-only updates.
- `migration-refactor`: change structure while preserving behavior.
Inclusion: module moves, API reshaping, interface extraction, naming normalization.
Exclusion: net-new feature development not centered on structural change.
- `diagnostics`: investigate failures, regressions, or inconsistent behavior.
Inclusion: root-cause analysis, reproduction narrowing, fix verification.
Exclusion: speculative design work without observed failures.
- `ui-studio`: change renderer/studio UX behavior and patterns.
Inclusion: screen flows, component behavior, UI state management, accessibility fixes.
Exclusion: backend-only changes with no user-facing impact.
- `runtime-security`: enforce runtime safety, policy, authorization, or secrets posture.
Inclusion: security controls, auth boundaries, transport/runtime hardening.
Exclusion: non-security feature work where policy controls are untouched.
- `documentation-change`: change docs structure, contracts, or canonical references.
Inclusion: docs/context, docs/architecture, contributor guide, router updates.
Exclusion: code-only changes with no doc contract impact.

## Pack Selection Rules

- Route only to active packs whose scope matches `taskCategory` and `changedPaths`.
- Apply deterministic ordering from `packIds` and pack priority metadata.
- Lower numeric priority values win when two candidate packs overlap.
- Keep selected packs minimal: include the smallest set needed to satisfy `requestedOutcomes`.
- Always include cross-cutting governance/taxonomy packs when contract files are in scope.
- Include ADR references in mapping `relatedDocPaths` only when decision history is a foundational or high-risk constraint for the task.
- Use `contextAssemblyProfileId` and `contextAssemblyTierHints` to order source material by tier before adding optional support.

## Context Assembly Priority and Ordering

Use profile `foundation-domain-implementation-optional-v1` for the initial category set:

1. `foundation` (highest priority; required)
Load canonical routing contracts, foundational context packs, and cross-cutting governance constraints first.
2. `domain` (high priority; required)
Load task-category architecture or contributor references mapped by routing assets and scoped by `changedPaths`.
3. `implementation` (medium priority; conditional)
Load implementation-specific references only when needed to satisfy quality gates or clarify touched surfaces.
4. `optional` (lowest priority; opt-in)
Load supporting summaries or adjacent references only for explicit unresolved gaps.

Ordering and token-efficiency rules:

- Keep tier order deterministic: `foundation -> domain -> implementation -> optional`.
- Prefer complete coverage in higher tiers before adding lower-tier context.
- Remove `optional` material first when prompt size grows.
- Never let lower-tier related sources override higher-tier authoritative sources.
- Keep tier weights descending to preserve predictable source precedence.

## Exclusion Rules

- Exclude deprecated packs unless the request explicitly asks for historical behavior.
- Exclude packs outside declared path/surface scope.
- Respect explicit `excludePackIds` from task mappings.
- Exclude baseline or historical docs by default unless `routingInputs` or `requestedOutcomes` explicitly require historical evidence.
- Exclude superseded pointer docs by default unless the task is supersession maintenance, redirect validation, or migration traceability.
- If exclusions remove all primary packs, route via fallback behavior rather than guessing.

## Priority and Fallback Behavior

Priority tiers:

- `critical`: security/runtime correctness boundaries.
- `high`: architecture, decomposition, migration, diagnostics.
- `normal`: implementation and documentation updates.
- `low`: non-blocking background alignment tasks.

Fallback behavior:

- Trigger fallback when all primary packs are unavailable, excluded, or inactive.
- First try category-level fallback packs.
- If still unresolved, use global fallback packs from the routing seed.
- Keep fallback ordering deterministic and auditable.

## Mapping Authoring Rules

- `taskId` must be stable once published.
- `taskCategory` must be one of the supported categories in the contract JSON.
- `routingInputs` must include all required request fields.
- `contextAssemblyProfileId` must reference a profile in `contextAssemblyProfiles`.
- `contextAssemblyTierHints` must define all tiers in `contextAssemblyTierOrder` with descending weights.
- `selectionMode` must be `ordered`, `fallback`, or `single`.
- `priorityTier` must be `critical`, `high`, `normal`, or `low`.
- `status` must be `draft`, `active`, or `deprecated`.
- Keep active-authoritative docs in `relatedDocPaths` by default; add baseline/superseded links only when the mapping intent explicitly depends on historical evidence or supersession maintenance.
- Every mapping must include metadata fields:
`id`, `title`, `purpose`, `domain`, `owner`, `status`, `relatedDocPaths`, `relatedCodePaths`.
- Keep `id` equal to or deterministically derived from `taskId`.
- `reviewExpectations` is optional, but when set it must include `cadence`.

When adding new entries to `task-to-context-routing.seed.json`, follow this contract instead of redefining category or fallback semantics inside each mapping.
