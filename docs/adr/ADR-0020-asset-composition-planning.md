# ADR-0020: Asset Composition Planning

- Status: Accepted
- Date: 2026-05-20

## Context

Phase 9 established workspace-scoped effective asset projection records/summaries with planning-oriented readiness, diagnostics, blockers, safe projected fields, and provenance. The next step is to plan safe combinations of those projections without executing workflows or binding runtime providers.

Without a dedicated planning layer, composition concerns drift into authoring, resolver, or runtime surfaces, which blurs boundaries and increases mutation/execution risk.

## Decision

Phase 10 introduces workspace-scoped asset composition plans that organize Phase 9 effective asset projections into planning nodes and relationships. These plans validate compatibility and identify blockers but do not execute workflows, bind runtime providers, mutate source assets, or generate executable payloads.

## Accepted Phase 10 boundaries

Phase 10 is planning-only, reference-oriented, workspace-scoped, and non-runtime. It owns plan modeling, role/relationship semantics, compatibility diagnostics, and readiness-for-handoff outputs.

Phase 10 excludes runtime execution, provider binding, visual-canvas execution semantics, and source mutation.

## Composition plan ownership and workspace scope

- Composition plans are owned by a target workspace.
- Selected projections must resolve within that workspace.
- Cross-workspace links remain represented only through existing provenance/source summaries from Phase 7/8/9; no live sync links are created.

## Depend on Phase 9 projections

Phase 10 depends on Phase 9 projections as the canonical planning input surface:

- projection identity/scope/source kind;
- projection status/readiness/consumability;
- safe projected fields;
- diagnostics/blockers;
- provenance summaries.

Phase 10 must not bypass these summaries by directly reconstructing projection logic from raw authored/customization internals.

## Keep composition planning non-runtime

A `valid` composition plan means non-runtime planning validity only. It never implies executable state, runtime availability, or provider readiness.

## Defer visual canvas and workflow execution

Phase 10 may later support UI representations, but this ADR explicitly defers:

- visual canvas-first authoring behavior,
- executable workflow graph semantics,
- runtime task execution semantics.

## Consequences

Positive:

- Clear separation between planning and execution.
- Safe dependence on projection summaries rather than raw source mutation.
- Deterministic blocker/diagnostic model before runtime binding.

Tradeoffs:

- Additional phase boundary and compatibility vocabulary to maintain.
- Runtime readiness remains deferred to Phase 11.

## Explicit non-goals

Phase 10 does not implement workflow/runtime/model execution, ComfyUI execution, arbitrary graph editing, prompt editing, workflow JSON editing, materialized executable payload generation, conflict auto-rebase/resolution, background propagation, live workspace-to-workspace sync, collaboration permissions, pack import/export, marketplace behavior, or mutation/copy of `system.foundation`.

## Relationship to Phase 9

Phase 9 provides projection readiness for planning, not runtime execution. Phase 10 consumes this readiness as an input and adds composition-level compatibility semantics.

If required projection summaries are missing or stale, Phase 10 reports diagnostics/blockers instead of bypassing Phase 9.

## Phase 11 handoff implications

Phase 10 outputs validated composition-plan structures suitable for Phase 11 runtime-readiness binding.

Phase 11 can evaluate runtime/provider/model/storage/API/dependency/environment capability availability against required capabilities from validated plans, still without requiring immediate workflow execution.


## Phase 10 UI closeout

- Composition planning is exposed inside the **Assets** area as a `Plans` tab, not as a separate top-level page.
- The Phase 10 UI is structured form/list planning (plans, assets in plan, connections, check plan), not visual canvas authoring.
- `valid` means **Ready for planning** only; it does not mean runtime-ready or execution-ready.
- Runtime-readiness binding and workflow/runtime/model execution remain deferred to Phase 11+.
- API/IPC/preload/client exposure from Prompt 9 is the boundary used by UI operations; unsupported operations must render as unavailable in UI.
