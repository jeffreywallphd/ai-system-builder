# ADR-0018: Asset Authoring, Customization, and Override Management Baseline

- Status: accepted
- Date: 2026-05-19

## Context

Phase 8 needs a conservative architecture baseline for user-facing asset authoring and safe customization that preserves:

- Phase 6 workspace isolation and explicit workspace context,
- Phase 7 user-library reuse semantics (promote/link/copy/import),
- immutable system-owned foundation behavior,
- explicit provenance and no hidden propagation.

Phase 7 closeout is accepted, but Prompt 11 explicitly leaves parts of promote/import UI behavior unavailable and keeps effective-source behavior conservative/minimal. Phase 8 must not assume unavailable Phase 7 surfaces are complete.

## Decision

Phase 8 introduces explicit workspace-scoped asset authoring and customization/override records. It does not mutate system-owned assets, does not silently mutate linked user-library sources, and does not introduce hidden propagation or live workspace-to-workspace synchronization.

## Accepted Phase 8 boundaries

Phase 8 Prompt 1 is architecture/docs/context only. It does not add contracts, ports, persistence adapters, use cases, API/IPC/preload exposure, or UI behavior.

Phase 8 implementation sequence proceeds through Prompts 2–9 with Reviews A–C.

## Ownership and scope rules

- Workspace isolation remains default.
- Workspace authoring/editing requires explicit workspace ID.
- User Library scope remains separate from workspace scope and system foundation scope.
- `system.foundation@1.0.0` remains immutable/system-owned.
- Linked user-library customization cannot silently mutate source user-library assets.
- Detached copies/imported workspace copies are customized in target workspace only.
- No hidden propagation, no live workspace-to-workspace links.

## Override model decision

Adopt explicit durable workspace-scoped override records as the architecture baseline for non-destructive customization.

Override records conceptually include:

- override identity,
- target workspace,
- base asset reference/version/source kind,
- override scope/status,
- safe changed fields and safe patch summary,
- provenance, timestamps, actor/request context, and safe diagnostics.

Override records must exclude unsafe/sensitive internals (raw paths, blobs/base64, provider payloads, prompt/workflow internals by default, secrets/tokens, stack traces, command lines, environment values, signed URLs).

## Versioning/conflict baseline

- Draft vs published authored/customization states are explicit.
- Revisions are explicit; published revisions are immutable by default.
- Conflicts are detected and surfaced, never silently resolved.
- Pinned links do not auto-remap overrides.
- Explicit-update links require explicit update actions.
- Detached copies/imported copies do not auto-follow source changes.

## Consequences

Positive:

- Preserves workspace and ownership safety while enabling controlled customization.
- Provides clear vocabulary for contracts/use cases/transports/UI in later prompts.
- Reduces accidental mutation/propagation risk.

Costs:

- Requires explicit conflict/resolution flows.
- Adds lifecycle/revision complexity for authored and override records.
- Defers high-risk editable fields until safe schema and test coverage exist.

## Explicit non-goals

Phase 8 Prompt 1 does not introduce:

- broad arbitrary field editing,
- prompt/workflow raw editing,
- runtime execution-linked editing behavior,
- collaboration permissions/multi-user authorization,
- pack import/export or marketplace behavior,
- hidden/default workspaces, startup seeding, or legacy/global auto-migration.

## Relationship to Phase 7

Phase 8 depends on accepted Phase 7 constraints and implemented relationships (link vs copy, detached import semantics, provenance, explicit workspace context, effective-source summaries where available).

If Phase 7 Review D truthfulness/composition checks regress, impacted Phase 8 prompts must mark those capabilities as prerequisites/deferrals and avoid building assumptions on unavailable behavior.

## Phase 9 handoff implications

Phase 9 composition planning should consume Phase 8 authored/customized/override vocabulary as explicit inputs and should not bypass override safety, ownership isolation, or conflict visibility rules.
