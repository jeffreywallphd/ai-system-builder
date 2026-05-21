# Context Pack: Asset Composition Planning (Phase 10)

- Pack name: `asset-composition-planning`

## Purpose

Define and constrain Phase 10 asset composition planning as a workspace-scoped, projection-referenced, non-runtime planning layer.

## Use When

Include this pack when work materially involves:

- composition plans;
- composition nodes/relationships;
- planning roles and relationship kinds;
- compatibility checks/statuses;
- composition blockers/diagnostics;
- projection selection for planning;
- planning readiness;
- Phase 11 runtime-readiness handoff preparation.

## Canonical docs/files to inspect

- `docs/architecture/asset-composition-planning.md`
- `docs/adr/ADR-0020-asset-composition-planning.md`
- `docs/architecture/effective-asset-projections.md`
- `docs/adr/ADR-0019-effective-asset-projections.md`

## Core constraints

- Composition planning is non-runtime and non-executing.
- Plans are workspace-scoped and projection-reference-oriented.
- Planning records must not contain executable payloads or unsafe raw data.
- `valid` means plan-valid, not runtime-ready and not executable.

## Anti-drift rules

- Do not bypass Phase 9 projection summaries when available.
- Do not mutate Asset Authoring/User Library/system foundation from planning surfaces.
- Do not describe Phase 10 as workflow execution or runtime binding.
- If projection data is missing/stale/unsupported, emit planning diagnostics/blockers.

## Relationship to Phase 7, 8, 9

- Phase 7: composition may include projections originating from linked/copied/imported user-library sources; no live sync or source mutation.
- Phase 8: composition may include projections derived from authored/customized assets; editing remains in authoring flows.
- Phase 9: composition planning consumes effective projection summaries/status/readiness/diagnostics as canonical planning inputs.

## Phase 10 prompt ownership sequence

1. Prompt 1 — Architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Contract vocabulary: plans, nodes, relationships, roles, compatibility.
3. Prompt 3 — Application ports and persistence adapters.
4. Review A — Contracts, persistence, workspace isolation, anti-drift review.
5. Prompt 4 — Create/read/list/archive composition plans.
6. Prompt 5 — Add/remove projected assets as composition nodes.
7. Prompt 6 — Relationship modeling and simple dependency planning.
8. Review B — Plan semantics, compatibility, no-runtime boundary review.
9. Prompt 7 — Compatibility/readiness validation services.
10. Prompt 8 — Composition read model integration.
11. Prompt 9 — API/IPC/preload exposure (may split into 9a/9b/9c if needed).
12. Prompt 10 — Minimal desktop/thin-client planning UI and docs closeout.
13. Review C — Final Phase 10 closeout review.

## Non-goals

No workflow/runtime/model execution, runtime/provider binding, visual-canvas-first authoring, arbitrary graph editing, prompt/workflow JSON editing, materialized workflow payload generation, collaboration permissions, pack import/export, marketplace behavior, live cross-workspace sync, or source mutation.

## Phase 11 handoff

Phase 10 prepares validated composition plan outputs for **Runtime Readiness Binding** in Phase 11, where required capabilities are matched against available runtime/provider/environment capabilities without implying immediate execution.


## Phase 10 UI closeout

- Composition planning is exposed inside the **Assets** area as a `Plans` tab, not as a separate top-level page.
- The Phase 10 UI is structured form/list planning (plans, assets in plan, connections, check plan), not visual canvas authoring.
- `valid` means **Ready for planning** only; it does not mean runtime-ready or execution-ready.
- Runtime-readiness binding and workflow/runtime/model execution remain deferred to Phase 11+.
- API/IPC/preload/client exposure from Prompt 9 is the boundary used by UI operations; unsupported operations must render as unavailable in UI.

- In UI closeout, keep planning inside the Assets area and avoid exposing projection internals as primary end-user jargon.
