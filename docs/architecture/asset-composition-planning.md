# Asset Composition Planning (Phase 10)

## Purpose

Phase 10 introduces **Asset Composition Planning** as a workspace-scoped, non-runtime planning layer.

Architecture thesis: **Phase 10 introduces workspace-scoped composition plans that reference safe effective asset projections from Phase 9. Composition plans organize selected projections into roles and relationships, validate compatibility, and identify blockers before any runtime binding or workflow execution occurs.**

This phase answers: _Which effective assets can be combined, in what planning roles and relationships, to form a valid system/workflow plan?_ It does **not** execute workflows.

## Scope and boundaries

Phase 10 is:

- a planning layer;
- workspace-scoped;
- reference-oriented (projection references, not raw authored payloads);
- non-runtime;
- non-executing;
- dependent on Phase 9 projection summaries/statuses/diagnostics;
- preparatory for Phase 11 runtime-readiness binding.

Phase 10 is not visual-canvas-first authoring, not runtime execution, and not workflow materialization.

## Vocabulary

- **Asset composition plan / Composition plan**: workspace-owned planning record that organizes selected effective asset projections into nodes and relationships, plus compatibility/readiness outcomes.
- **Composition node**: a plan-local role assignment for one selected projection.
- **Composition relationship**: a plan-local planning connection between nodes.
- **Selected projection**: an effective asset projection chosen for planning.
- **Projection reference**: stable reference to a Phase 9 effective projection record.
- **Composition role**: plan-level role assigned to a node.
- **Relationship kind**: plan-level relationship category used for compatibility checks.
- **Compatibility check**: deterministic plan-time validation against workspace scope, projection status, role compatibility, and relationship rules.
- **Compatibility status**: outcome of compatibility checks (for plan, node, relationship).
- **Composition blocker**: issue that prevents a plan from being valid for runtime-readiness handoff.
- **Composition diagnostic**: safe explanation/warning/error used by operators and UI.
- **Composition readiness**: planning-only readiness state; not runtime readiness.
- **Planning-ready**: plan/projection state sufficient for Phase 10 planning checks.
- **Planning-blocked**: plan/projection state that blocks planning progress.
- **Missing dependency**: required node/relationship/capability reference is absent.
- **Required capability**: capability needed by node/relationship during planning analysis.
- **Provided capability**: capability advertised by selected projections/nodes.
- **Composition provenance**: source and update lineage for plan creation/refresh actions.
- **Plan validation**: compatibility check execution and status/diagnostic updates.
- **Plan refresh**: re-check against latest projection summaries/statuses.
- **Plan snapshot**: optional immutable read view of a plan at a point in time.
- **Runtime-readiness handoff**: constrained output passed to Phase 11 for capability binding analysis.
- **Execution deferred**: explicit marker that workflow/runtime/model execution is out of scope.

User-facing labels should stay simpler (for example: “Plan”, “Assets in this plan”, “Role”, “Connection”, “Ready for planning”, “Needs attention”, “Missing requirement”).

## Conceptual model (non-contract baseline)

Phase 10 defines conceptual records only (no TypeScript contracts in Prompt 1).

### Composition plan (conceptual)

- composition plan ID;
- target workspace ID;
- name;
- description;
- status;
- selected projection references;
- composition nodes;
- composition relationships;
- compatibility diagnostics;
- blockers;
- readiness summary;
- provenance;
- created/updated timestamps.

### Composition node (conceptual)

- node ID;
- projection ID;
- effective asset reference;
- role;
- status;
- required inputs/capabilities;
- provided outputs/capabilities;
- diagnostics.

### Composition relationship (conceptual)

- relationship ID;
- source node ID;
- target node ID;
- relationship kind;
- compatibility status;
- diagnostics.

All records are planning metadata only. They must not carry executable payloads, runtime/provider command payloads, prompt text, workflow JSON, bytes/base64, paths, or secrets.

## Plan status baseline

Conservative Phase 10 plan statuses:

- `draft`
- `valid`
- `blocked`
- `conflicted`
- `stale`
- `unsupported`
- `invalid`
- `archived`

Status semantics:

- `valid` = valid as a non-runtime composition plan only.
- `valid` does **not** imply executable.
- `valid` does **not** imply runtime-ready.
- `blocked` = cannot safely proceed to runtime-readiness binding.
- `stale` = projection summaries/statuses changed and plan refresh is required.
- `archived` = inactive historical plan.

## Initial composition role vocabulary

- `input`
- `data-source`
- `processor`
- `model`
- `prompt-template`
- `configuration`
- `output`
- `ui-surface`
- `runtime-capability-placeholder`
- `supporting-asset`

These are intentionally modest planning roles, not a full workflow language. Later phases may refine role taxonomies based on concrete vertical slices.

## Initial relationship kinds

- `depends-on`
- `feeds-into`
- `configures`
- `uses-model`
- `uses-data`
- `produces-output`
- `requires-capability`
- `supports`

These are planning relationships only and are not executable graph edges.

## Compatibility model baseline

Plan validation should check, at minimum:

1. selected projections belong to the target workspace;
2. selected projections exist;
3. selected projections are planning-consumable/ready for planning;
4. blocked projections block the plan;
5. conflicted projections block the plan;
6. stale projections require refresh before `valid`;
7. draft-only projections are excluded from normal planning unless draft planning is explicitly allowed;
8. disabled projections cannot be active nodes;
9. missing source projections block the plan;
10. unsupported projections block the plan;
11. node role is compatible with projection source kind/shape;
12. required inputs/capabilities are satisfied where known;
13. provided outputs/capabilities are not contradictory where known;
14. relationship kinds are allowed for selected roles;
15. plan structure does not imply source mutation;
16. plan structure does not imply workflow/runtime execution.

Checks must output safe diagnostics and explicit blockers.

## Dependency on Phase 9 effective projections

Phase 10 depends on the stable Phase 9 concept of workspace-scoped effective projection summaries and statuses.

Phase 10 may read:

- projection IDs;
- workspace IDs;
- effective asset references;
- source kinds;
- statuses;
- policies;
- safe projected fields;
- diagnostics;
- blockers;
- provenance summaries;
- readiness/consumability flags.

Phase 10 must not:

- bypass projection summaries to inspect raw authored/customization internals when summaries exist;
- reconstruct projection logic;
- mutate user-library or system foundation records;
- treat projection `ready` as runtime-ready;
- hide missing projections by direct source fallbacks.

If a required summary is missing, Phase 10 emits planning diagnostics/blockers (not bypass logic).

## Relationship to Phase 8 Asset Authoring

- Phase 10 may compose projections derived from authored/customized assets.
- Phase 10 does not author or edit those assets.
- If edits are needed, user flow returns to Assets authoring/customization surfaces.

## Relationship to Phase 7 User Library

- Phase 10 may compose projections derived from linked assets, detached copies, or workspace imports.
- Phase 10 must not mutate user-library sources, create live workspace-to-workspace links, or silently propagate source changes.
- Phase 10 does not perform marketplace or import/export behavior.

## Relationship to Asset Kernel

- Phase 10 consumes effective asset references and safe projected fields.
- Phase 10 does not write kernel definitions, mutate system foundation assets, copy `system.foundation@1.0.0`, or generate executable payloads.
- Composition nodes are planning wrappers, not new kernel definitions.

## What Phase 10 implements vs defers

Implemented in Phase 10 (across planned prompts):

- planning vocabulary and contracts for composition plans/nodes/relationships;
- workspace-scoped plan creation/read/list/archive;
- node selection from effective projections;
- planning relationship modeling;
- compatibility/readiness diagnostics;
- read-model/transport/UI baseline for planning workflows.

Deferred from Phase 10:

- workflow/runtime/model execution;
- runtime/provider binding and capability activation;
- visual canvas-first authoring;
- arbitrary graph editors;
- prompt/workflow JSON editing;
- materialized executable workflow payload generation;
- conflict rebase/resolution automation;
- live cross-workspace synchronization;
- collaboration permissions;
- pack import/export and marketplace behavior;
- source mutation (authoring/library/system foundation).

## Phase 11 handoff

Phase 11 is **Runtime Readiness Binding**.

Phase 10 hands off validated planning structure; Phase 11 determines whether runtime capabilities/providers are actually available (installed runtimes, model/provider/storage/API/dependency/environment readiness, capability mapping).

Conceptual handoff shape (illustrative only):

```ts
ValidatedCompositionPlan {
  planId
  workspaceId
  selectedProjectionRefs[]
  nodes[]
  relationships[]
  compatibilityStatus
  blockers[]
  requiredRuntimeCapabilities[]
  unsupportedRuntimeCapabilities[]
}
```

Phase 11 may still remain non-executing unless a later phase introduces execution semantics.

## Phase 10 implementation sequence

1. Prompt 1 — Architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Contract vocabulary: plans, nodes, relationships, roles, compatibility.
3. Prompt 3 — Application ports and persistence adapters.
4. Review A — Contracts, persistence, workspace isolation, and anti-drift review.
5. Prompt 4 — Create/read/list/archive composition plans.
6. Prompt 5 — Add/remove projected assets as composition nodes.
7. Prompt 6 — Relationship modeling and simple dependency planning.
8. Review B — Plan semantics, compatibility, no-runtime boundary review.
9. Prompt 7 — Compatibility/readiness validation services.
10. Prompt 8 — Composition read model integration.
11. Prompt 9 — API/IPC/preload exposure (may split into 9a/9b/9c if needed).
12. Prompt 10 — Minimal desktop/thin-client planning UI and docs closeout.
13. Review C — Final Phase 10 closeout review.

## Non-goals (explicit)

Phase 10 does not implement workflow execution, runtime execution, ComfyUI execution, model execution, visual canvas authoring, arbitrary graph editing, prompt/workflow JSON editing, materialized workflow payload generation, conflict rebase/resolution, background propagation, live workspace linking/sync, collaboration permissions, pack import/export, marketplace behavior, or mutation/copy of `system.foundation`.


## Phase 10 UI closeout

- Composition planning is exposed inside the **Assets** area as a `Plans` tab, not as a separate top-level page.
- The Phase 10 UI is structured form/list planning (plans, assets in plan, connections, check plan), not visual canvas authoring.
- `valid` means **Ready for planning** only; it does not mean runtime-ready or execution-ready.
- Runtime-readiness binding and workflow/runtime/model execution remain deferred to Phase 11+.
- API/IPC/preload/client exposure from Prompt 9 is the boundary used by UI operations; unsupported operations must render as unavailable in UI.
