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
- Phase 8.7 adds shared composition metadata renderers in Agent Studio (`CompositionSummaryCard`) across agent detail/launch/session surfaces; these render backend taxonomy/contract projections as-is with no UI-side ontology/classification derivation.
- Phase 8.8 adds canonical asset-native output exploration in Agent Studio (`OutputAssetExplorerPanel`) for output and memory-write asset IDs by reusing canonical asset-management reads (`loadAssetDetail`, `listVersionChain`) instead of agent-specific asset semantics.
- Phase 8.9 hardens session observability/debug UX through backend-owned operational projections: `SessionDetailPanel` now composes thin bounded sections (`SessionOperationalSummary`, `SessionTransitionHistoryPanel`, `SessionStepOutcomePanel`, `SessionDiagnosticAssetsPanel`) that render canonical session status/terminal/progress/retry/outcome/step/transition/diagnostic/output fields from `AgentSessionDetailReadModel` directly.
- Phase 8.10 hardens end-to-end Studio integration by keeping refresh deterministic after authoring/launch/control flows (`getStudioSnapshot` as primary session source, selected-session retention when still present, and reuse of `snapshot.latestSession` when it matches selected detail), and by aligning empty/error/loading behavior with backend contract truth (including explicit no-session empty state) rather than page-level inference.
- Session list/detail/control are rendered from backend read models/capability flags as-is; the UI does not rebuild runtime semantics or infer derived execution states.
- Validation failures are shown exactly from backend `validationIssues` payloads without UI-side rule duplication.
- Composition semantics stay backend-owned: UI reads taxonomy/contract projections already classified via `CompositionTaxonomyClassifier` and `CompositionAssetContractResolver`.
- Out of scope in this slice: client-derived launch semantics, UI validation/business rules, inferred runtime state machines, speculative observability/analytics frameworks, and control actions not advertised by backend capabilities.


- Phase 9.1 introduces the first bounded Studio Shell renderer surface (`ui/pages/StudioShellPage.tsx`) built from reusable panel primitives (`ui/components/studio-shell/StudioShellPanel.tsx`) and a thin desktop bridge-backed service (`ui/services/StudioShellService.ts`).
- Studio Shell validation/error UX is backend-authoritative via `StudioShellBackendApi` snapshot/validation contracts (`validationIssues` + typed operation error codes); the page only renders those payloads and does not implement taxonomy/contract/provenance/dependency/lifecycle/version business rules locally.
- Phase 9.2 adds a bounded Studio Shell extension seam in the renderer (`ui/studio-shell/StudioShellExtensions.ts`) with typed `StudioRegistration` (`kind`, semantic role, allowed behavior options, defaults, shell presentation hints, slot contributions) so atomic and composite studios register through the same shell model.
- Extension composition remains typed and intentionally small (slot + title/subtitle + order + render callback); this is not a generic plugin runtime.
- Phase 9.3 now validates the initial authoring/publish vertical slice through the real renderer service boundary (`ui/services/tests/StudioShellService.integration.test.ts`), including publish and persistence reload behavior through the desktop/backend/application/repository path.
- Phase 9.4 (story 2.7) now routes Model Studio through the same shell renderer (`ui/pages/ModelStudioPage.tsx` -> `StudioShellPage` with `modelStudioRegistration`) so model authoring uses shared draft/session, validation, dependency, lifecycle, and publish/version surfaces instead of a parallel page stack.
- Model-specific UI behavior is bounded to registration slot contributions (`draft-authoring`, `metadata`) and registration defaults; no model business rules were moved into renderer logic.

## TODO
- If asked for the renderer's main composition root, answer `ui/composition/createUiDependencies.ts`, not the infrastructure bootstrap.

- Phase 9.5 (story 2.9) now routes Dataset Studio through the same shell renderer (`ui/pages/DatasetStudioPage.tsx` -> `StudioShellPage` with `datasetStudioRegistration`) so dataset authoring inherits shared draft/session, validation, dependency, lifecycle, and publish/version surfaces.
- Dataset-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots); no dataset business rules were moved into UI logic.
- Phase 9.6 (story 2.11) now routes Tool Studio through that same shell renderer (`ui/pages/ToolStudioPage.tsx` -> `StudioShellPage` with `toolStudioRegistration`) so atomic MCP/API tool authoring uses the same session/draft/validation/lifecycle/publish path.
- Tool-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) with MCP/API-oriented defaults; no tool business rules were moved into UI logic.
- Phase 9.7 (story 2.12) keeps validation projection backend-authoritative while standardizing atomic defaults: model/dataset/tool registration metadata now includes taxonomy-driven contract defaults and empty dependency defaults, and shared validation issue projection is centralized behind the backend contract.
- Phase 9.8 (story 2.15) now adds cross-atomic end-to-end consistency coverage (`ui/services/tests/StudioShellService.integration.test.ts`) for Model/Dataset/Tool create -> edit -> validate -> publish -> reload behavior over real shared seams (service, bridge, backend API, application orchestration, SQLite persistence).
- Model/Dataset/Tool renderer integration remains registration-bounded on `StudioShellPage`; no parallel page/business-rule stacks were introduced.
- Phase 9.9 (story 2.18) now routes Prompt Template Studio through the same shell renderer (`ui/pages/PromptTemplateStudioPage.tsx` -> `StudioShellPage` with `promptTemplateStudioRegistration`) so prompt-template authoring uses the same draft/session/validation/dependency/lifecycle/publish/version flow.
- Prompt-template renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots), and cross-atomic shell integration coverage now includes Prompt Template Studio in `ui/services/tests/StudioShellService.integration.test.ts`.
- Phase 9.10 (stories 2.21–2.22) now routes Config Profile Studio through that same shell renderer (`ui/pages/ConfigProfileStudioPage.tsx` -> `StudioShellPage` with `configProfileStudioRegistration`) so config-profile authoring uses the same draft/session/validation/dependency/lifecycle/publish/version flow and shared persistence-backed consistency coverage.
- Phase 9.11 (stories 3.5–3.6) now routes Workflow Studio through that same shell renderer (`ui/pages/WorkflowStudioPage.tsx` -> `StudioShellPage` with `workflowStudioRegistration`) so composite workflow-orchestrator authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Workflow-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.12 (stories 3.7–3.8) now routes Context Bundle Studio through that same shell renderer (`ui/pages/ContextBundleStudioPage.tsx` -> `StudioShellPage` with `contextBundleStudioRegistration`) so composite context-bundle input-preparer authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Context-bundle-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
