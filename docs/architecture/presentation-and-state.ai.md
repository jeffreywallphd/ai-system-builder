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

## TODO
- If asked for the renderer's main composition root, answer `ui/composition/createUiDependencies.ts`, not the infrastructure bootstrap.
