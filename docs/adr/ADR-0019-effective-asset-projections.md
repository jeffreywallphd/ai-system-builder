# ADR-0019: Effective Asset Projections Baseline

- Status: accepted
- Date: 2026-05-20

## Context

Phase 9 needs a conservative architecture baseline for deriving safe, workspace-scoped effective outputs from system/workspace/user-library/authored/customized asset sources.

Phase 8 established authoring/customization/override vocabulary, but intentionally deferred portions of override targeting, existing-authored revision publishing, and guaranteed workspace-wide effective summaries. Phase 9 must build on available behavior without assuming deferred capabilities are complete.

## Decision

Phase 9 introduces workspace-scoped effective asset projections as safe, metadata-oriented outputs derived from system, workspace, user-library, authored, and customized sources. Projections do not execute workflows, mutate sources, resolve conflicts automatically, or materialize unsafe payloads.

## Accepted Phase 9 boundaries

Phase 9 Prompt 1 is architecture/docs/context baseline only. It adds no contracts, ports, persistence adapters, use cases, API/IPC/preload handlers, or UI runtime behavior.

## Projection ownership and workspace scope

- Workspace isolation remains default.
- Projection creation/read requires explicit workspace ID.
- Projections are workspace-scoped derived outputs.
- `system.foundation@1.0.0` remains immutable/system-owned and is never mutated/copied as source definitions.
- Linked user-library sources are never silently mutated.
- Detached copies/imported copies remain detached.
- No hidden propagation and no live workspace-to-workspace links.

## Materialization policy decision

Adopt constrained policy vocabulary for safe projection outputs only:

- `summary-only`
- `safe-fields-only`
- `draft-preview-only`
- `execution-ready-metadata-only`
- `blocked`

No policy implies workflow payload synthesis, runtime execution, or arbitrary JSON merge behavior.

## Safe projected fields decision

Phase 9 projections are metadata-oriented and conservative.

Allowed baseline fields include display/summary/description labels, classification/tags, Phase 8-sanitized metadata keys, source/revision labels, readiness, and safe diagnostics.

Explicitly excluded by default: raw paths/storage roots, bytes/blobs/base64, provider payloads, raw prompt/workflow payloads, credentials/tokens, environment values, stack traces, command lines, signed URLs, and arbitrary JSON blobs.

## Conflict/blocking decision

Projection conflicts/blockers are explicit and never silently resolved.

Minimum baseline outcomes:

- missing source => `source-missing`/blocked,
- conflicted override or base revision mismatch => `conflicted`,
- disabled override => not applied,
- unsafe/unsupported fields => blocked or partial with sanitized diagnostics,
- draft without published revision => `draft-only` or blocked by policy/context,
- missing target reader => unavailable/unsupported diagnostic.

No automatic rebase, auto-update, or hidden conflict resolution workflows.

## Consequences

Positive:

- Enables a clear non-executing projection layer for future composition planning.
- Preserves ownership/workspace safety across mixed source kinds.
- Provides explicit diagnostic/readiness semantics for downstream layers.

Costs:

- Requires explicit conflict and invalidation handling surfaces in later prompts.
- Keeps high-risk payload fields deferred until explicit schemas/tests are accepted.
- Depends on truthful handling of Phase 8 deferred capabilities.

## Explicit non-goals

Phase 9 Prompt 1 does not introduce:

- workflow/runtime execution,
- collaboration permissions/multi-user auth,
- pack import/export or marketplace behavior,
- hidden/default workspaces/startup seeding/legacy-global migration,
- live workspace synchronization,
- arbitrary prompt/workflow/json editing.

## Relationship to Phase 8

Phase 9 consumes Phase 8 authored assets, drafts, published revisions, override records, customization targets, provenance, conflict status, safe editable fields, and explicit workspace context.

Phase 9 must preserve Phase 8 truthfulness limits:

- override creation safe-target flow may remain deferred,
- existing-authored-asset revision publishing may remain deferred,
- workspace-wide effective summaries may be partial/unavailable.

## Phase 10 handoff implications

Phase 10 (**Asset Composition Planning**) should build on Phase 9 projections for selection, ordering, dependency planning, compatibility checks, and non-runtime preparation.

Phase 10 must not reinterpret Phase 9 as execution authorization, and must not assume runtime execution, collaboration, marketplace behavior, or arbitrary payload editing.
