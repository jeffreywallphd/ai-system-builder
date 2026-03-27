# AI Companion: Presentation and State

## Core fact
The renderer uses manual composition plus class-based stores/services; it is not a thin React shell over a shared DI container.

## Main files
- App shell: `ui/App.tsx`
- Provider/bootstrap: `ui/composition/AppProviders.tsx`
- Main composition root: `ui/composition/createUiDependencies.ts`
- Router: `ui/routes/AppRouter.tsx`
- UI service examples: `ui/services/WorkflowService.ts`, `ui/services/ToolService.ts`
- Execution-status presenter: `ui/presenters/WorkflowExecutionPresenter.ts`
- Durable history/detail projection surface: `ui/services/ExecutionHistoryService.ts`, `ui/components/execution/ExecutionHistoryPanel.tsx`, `ui/components/execution/ExecutionRunDetailPanel.tsx`

## Key wording
Describe stores as "page-facing state managers" and UI services as "presentation-facing adapters over application use cases and repositories."

## Important caveat
`createUiDependencies.ts` is one of the most important architecture files in the repo because it reflects real renderer wiring, even though there is also a generic DI bootstrap elsewhere.

Execution-state wording for the workflow editor is now intentionally projected through `ui/presenters/WorkflowExecutionPresenter.ts`, and durable execution history/detail wording is now intentionally projected through the application execution-run list/detail projections plus `ui/services/ExecutionHistoryService.ts` instead of being assembled ad hoc inside the page/component tree, including the MCP page's runtime-backed server-operation history surface.
Related-run lineage navigation now also uses that same execution-history service seam (related-run cluster projection + detail-panel navigation) instead of page-level custom grouping logic.
- Phase 8.2 introduces a thin Agent Studio shell page (`ui/pages/AgentStudioPage.tsx`) that consumes desktop backend contracts only (`ai-loom-desktop-agents:*` bridge methods) and keeps runtime/business semantics in backend/application layers.
- Phase 8.3 extends this shell with authoring sections (goals, policy, tools, memory, strategy) that submit backend configuration use cases through the same desktop bridge/service seam and reload backend snapshots after success.
- Phase 8.4 adds launch/run monitoring surfaces as thin contract consumers: launch request fields (`input`, `contextOverrides`, `metadata`, `trigger`), session list/detail operational summaries, and backend-truthful run controls (cancel when supported).
- Phase 8.5 places run-control affordances in launch/session list/session detail surfaces through shared renderer controls (`AgentRunControls`) that consume backend capability flags only (`snapshot.capabilities.controls`), submit actions via `AgentStudioService.controlRun`, and refresh backend session reads after control results.
- Phase 8.6 adds trigger UX seams (`TriggerSelector`, `TriggerConfigFields`) that expose only supported trigger contracts (`manual`, `backend`) and route backend-trigger launches through the backend `triggerLaunch` contract; UI-side checking is limited to basic request-shape guardrails (for example `backend` requires `trigger.source`) while backend validation remains authoritative.
- Session list/detail/control are rendered from backend read models/capability flags as-is; the UI does not rebuild runtime semantics or infer derived execution states.
- Validation failures are shown exactly from backend `validationIssues` payloads without UI-side rule duplication.
- Composition semantics stay backend-owned: UI reads taxonomy/contract projections already classified via `CompositionTaxonomyClassifier` and `CompositionAssetContractResolver`.
- Out of scope in this slice: client-derived launch semantics, UI validation/business rules, inferred runtime state machines, and speculative control actions not advertised by backend capabilities.


## TODO
- If asked for the renderer's main composition root, answer `ui/composition/createUiDependencies.ts`, not the infrastructure bootstrap.
