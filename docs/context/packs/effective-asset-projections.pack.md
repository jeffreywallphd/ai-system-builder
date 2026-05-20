# Context Pack: Effective Asset Projections (Phase 9)

- Pack name: `effective-asset-projections`

## Purpose

Provide minimum-sufficient Phase 9 context for materialized/effective asset projection architecture, safety constraints, and implementation sequencing.

## Use When

- Materialized/effective asset projection design.
- Projection records, projection persistence, and projection read surfaces.
- Safe projected fields, projection readiness, blockers, diagnostics, provenance.
- Projection refresh/invalidation behavior.
- Preparing assets for composition/runtime-readiness planning (not execution).

## Canonical docs to inspect

- `docs/architecture/effective-asset-projections.md`
- `docs/adr/ADR-0019-effective-asset-projections.md`
- `docs/architecture/asset-authoring-customization-and-overrides.md`
- `docs/architecture/user-library-and-cross-workspace-reuse.md`
- `docs/architecture/workspace-model.md`
- `docs/architecture/asset-kernel.md`

## Core constraints

- Workspace isolation default; explicit workspace context required.
- Projections are workspace-scoped derived outputs.
- No source mutation (`system.foundation@1.0.0` immutable; linked sources not mutated; detached copies stay detached).
- No hidden propagation, live workspace links, runtime/workflow execution, auto-rebase, or hidden conflict resolution.
- Projection outputs remain safe metadata-oriented summaries only.
- Never expose paths/storage roots/provider payloads/prompt text/workflow JSON/bytes/blobs/base64/tokens/env values/stack traces/command lines/signed URLs in projection public surfaces.

## Anti-drift rules

- Keep projection vocabulary/status/policy aligned with ADR-0019 and Phase 9 architecture doc.
- Do not recast `ready` as executed.
- Do not silently apply conflicted/disabled overrides.
- Do not expand safe projected fields without explicit schema + tests in later prompts.

## Relationship to Phase 7 and Phase 8

- Phase 7 provides ownership/reuse/source-relationship foundations.
- Phase 8 provides authored/draft/revision/override/customization vocabulary and safety constraints.
- Phase 9 materializes workspace-effective projection outputs from those inputs without execution.

## Phase 9 prompt ownership

1. Prompt 1 — Architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Materialized/effective asset projection contract vocabulary.
3. Prompt 3 — Application ports and persistence for projection records.
4. Review A — Contract, persistence, boundary, and anti-drift review.
5. Prompt 4 — Safe projection service for authored assets and safe fields.
6. Prompt 5 — Safe projection service for overrides/customizations.
7. Prompt 6 — Validation, diagnostics, and conflict-blocking behavior.
8. Review B — Materialization semantics, immutability, and safety review.
9. Prompt 7 — Effective-source/read-model integration for projected assets.
10. Prompt 8 — API/IPC/preload exposure, split if needed.
11. Prompt 9 — Minimal UI indicators/actions for projection readiness.
12. Prompt 10 — Docs, context packs, ADR closeout, and Phase 10 handoff.
13. Review C — Final Phase 9 closeout review.

## Non-goals

- Workflow/runtime execution.
- Collaboration/permissions.
- Pack import/export and marketplace behavior.
- Live workspace-to-workspace sync.
- Arbitrary JSON/prompt/workflow editing/materialization.

## Phase 10 handoff

Phase 10 (Asset Composition Planning) may consume Phase 9 projections for selection/order/dependency/compatibility planning and non-runtime preparation. Execution remains out of scope.
