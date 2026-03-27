# Presentation and State

This document explains how the renderer is organized and how state, stores, services, and composition fit into the larger architecture.

## Presentation architecture in one sentence

The renderer is a React application whose pages and components depend on a manually composed dependency graph of **stores**, **UI services**, **application use cases**, and **runtime-aware adapters**.

## Top-level structure

### React shell
- `ui/App.tsx` wraps the router with `AppProviders`.
- `ui/routes/AppRouter.tsx` defines the route tree for the main product areas.
- `ui/layout/AppLayout.tsx` provides shared layout/chrome.

### Dependency provider
`ui/composition/AppProviders.tsx` creates the full UI dependency graph with `createUiDependencies()` and performs startup work such as:
- initializing the runtime console/runtime manager
- initializing MCP state
- refreshing health
- refreshing workflow MCP tooling metadata

This means `AppProviders` is not only dependency injection; it is also a startup orchestrator.

## Manual renderer composition

`ui/composition/createUiDependencies.ts` is the real renderer composition root.

It creates and wires together:
- settings storage/configuration
- Python runtime client/manager
- runtime event buffering
- MCP integration
- workflow repository selection
- context repositories/services
- workflow/node/model/tool/MCP services
- execution-history projection/query services for durable run history and run detail
- stores for workflows, models, tools, context, managed services, tuning datasets, and model training

Architecturally, this file is extremely important because it shows what the product actually instantiates in the renderer today.

## UI services as presentation-facing adapters

Examples include:
- `ui/services/WorkflowService.ts`
- `ui/services/NodeService.ts`
- `ui/services/ModelService.ts`
- `ui/services/ToolService.ts`
- `ui/services/ContextService.ts`
- `ui/services/McpService.ts`

These services wrap application use cases and repositories in APIs that are convenient for the stores and pages.

### Why they exist
They reduce UI component coupling to the application layer and let the renderer expose a product-oriented API to stores.

### Architectural tradeoff
Some of these services also include convenience logic that directly manipulates domain objects. That keeps UI code simpler, but it also means some orchestration that could live in the application layer currently lives in the presentation layer.

## Stores as page-facing state managers

The UI uses store classes rather than pushing all state into React components. Stores are the main place where asynchronous workflows, optimistic updates, page state, and view-model shaping happen.

Examples:
- `ui/state/WorkflowStore.ts`
- `ui/state/ModelStore.ts`
- `ui/state/McpStore.ts`
- `ui/state/ContextStore.ts`
- `ui/state/TuningDatasetStore.ts`
- `ui/state/RuntimeConsoleStore.ts`
- `ui/state/ManagedServicesStore.ts`

This gives the renderer a middle layer between components and application services.

## Feature-page organization

The product is organized into page-level workspaces rather than a single monolithic editor. Top-level pages include:
- workflows
- workflow editor
- tools and tool run
- models
- context / context workbench
- MCP
- managed services
- assets
- settings

The architecture is therefore both layered and feature-oriented: each feature has pages/components/stores/services, but most features still rely on the same application/domain infrastructure beneath them.

## Agent Studio shell boundary (Phase 8.2 initial slice)

- The first Agent Studio UI slice is intentionally shell-level (`ui/pages/AgentStudioPage.tsx`) and desktop-backend-driven.
- The shell only consumes backend contracts exposed through the desktop bridge (`DesktopAgentAuthoringBridge` / `ai-loom-desktop-agents:*`) for list/load, launch, session reads, run control, and studio snapshot.
- UI state remains view orchestration only (selection/loading/error); it does not reconstruct runtime or policy semantics that already come from backend composition-classified/projection-backed read models.
- Validation/business/runtime interpretation remains in domain/application/backend seams.
- Phase 8.3 extends this shell with authoring sections (goals, policy, tools, memory, strategy) that submit backend configuration use cases through the same desktop bridge/service seam and reload backend snapshots after success.
- Phase 8.4 adds a launch form that sends backend run request contracts directly (`input`, `contextOverrides`, `metadata`, `trigger`) through the existing studio bridge/service and then refreshes snapshot/session reads from backend truth.
- Phase 8.5 adds run-control UX in launch/session list/session detail panels via shared `AgentRunControls`, consuming only backend-advertised control capabilities, submitting controls through `AgentStudioService.controlRun`, and reloading backend session state after each control response.
- Phase 8.6 adds trigger configuration UX via `TriggerSelector` and `TriggerConfigFields`, exposing only currently-supported trigger kinds (`manual`, `backend`) and routing backend-trigger launches through `AgentStudioService.triggerLaunch`/desktop `trigger-launch` contracts rather than UI-owned automation logic.
- Phase 8.7 adds composition-aware rendering across Agent Studio surfaces (agent list/detail, launch, session list/detail) through shared thin UI cards that render backend-provided taxonomy/contract projections directly, rather than introducing agent-only labels or UI-side classification logic.
- Phase 8.8 adds output and memory-write asset exploration from launch/session/authoring surfaces via canonical asset-management seams (`canonicalAssetManagementService.loadAssetDetail` + `listVersionChain`) so agent output references resolve into canonical asset identity/detail/lineage reads instead of dead text or agent-specific output viewers.
- Phase 8.9 extends session observability/debugging through bounded detail sections (`SessionOperationalSummary`, `SessionTransitionHistoryPanel`, `SessionStepOutcomePanel`, `SessionDiagnosticAssetsPanel`) that render backend operational read-model fields directly (status, terminal reason, progress, retry summary, outcome summary, step outcomes, transition history, diagnostic references, output assets).
- Phase 8.10 hardens end-to-end Studio integration by using snapshot-provided session lists as the primary refresh truth, retaining selected-session detail when still present after refresh, reusing `snapshot.latestSession` when it matches selected detail, and tightening empty/error/loading handling around backend contract responses (including explicit no-session empty state).
- Session list/detail and run controls are rendered from backend session read models and studio capability flags as-is; the UI does not rebuild runtime semantics, infer derived execution states, or expose unsupported controls.
- Unsupported automation capabilities (scheduler/cron/event-bus/background orchestrator) remain intentionally out of scope in the renderer; launch semantics stay backend-contract driven.
- Validation failures are shown exactly from backend `validationIssues` payloads without UI-side rule duplication.
- Composition semantics stay backend-owned: UI reads taxonomy/contract projections already classified via `CompositionTaxonomyClassifier` and `CompositionAssetContractResolver`.
- Intentionally out of scope in this slice: client-side policy validation, runtime/session interpretation heuristics, synthetic progress derivation, speculative observability frameworks, and any non-backend launch/control path.


### Presentation-side execution summaries
The workflow editor still uses a dedicated presentation projection (`ui/presenters/WorkflowExecutionPresenter.ts`) to turn raw execution events, provenance, and output counts into a UI-friendly status summary for `ui/components/execution/WorkflowExecutionStatusPanel.tsx`.

Durable execution history now follows the same pattern through application-layer list/detail projections (`ExecutionRunProjectionService` and `ExecutionRunDetailProjectionService`), a thin renderer `ExecutionHistoryService`, and reusable `ui/components/execution/ExecutionHistoryPanel.tsx` / `ExecutionRunDetailPanel.tsx` surfaces. Workflow editor history, dataset-generation history, model-training history, and runtime-backed MCP server-operation history all consume those projected summaries/details instead of reconstructing plan semantics in page components or decoding feature-specific artifacts in the UI.

Related-run lineage navigation now also flows through this same seam: the renderer asks `ExecutionHistoryService` for related-run clusters, and the execution detail panel can jump directly between runs in the same flow/plan grouping without introducing feature-specific linkage logic in page components.

That keeps display wording, badge tone, fallback wording, progress summaries, and truthfulness summaries out of the page/component tree while still leaving execution business logic in the application/infrastructure layers.

## Why this presentation architecture fits desktop tooling

For a sophisticated desktop tool, the renderer needs more than passive CRUD components. It has to coordinate:
- host/runtime initialization
- long-running operations
- degraded runtime states
- multiple workspaces/tabs/pages
- persisted local settings
- streaming events and health status

The current store-and-service approach is a good fit for that level of interaction.

## Notable architectural tension

The clean-architecture story would be simpler if the renderer reused the generic container/bootstrap directly, but the current UI composition is hand-written and host-aware. This gives the renderer a lot of flexibility, but also means architecture understanding depends heavily on reading `createUiDependencies.ts`.


- Phase 9.1 introduces the first bounded Studio Shell renderer surface (`ui/pages/StudioShellPage.tsx`) built from reusable panel primitives (`ui/components/studio-shell/StudioShellPanel.tsx`) and a thin desktop bridge-backed service (`ui/services/StudioShellService.ts`).
- Studio Shell validation/error UX is backend-authoritative via `StudioShellBackendApi` snapshot/validation contracts (`validationIssues` + typed operation error codes); the page only renders those payloads and does not implement taxonomy/contract/provenance/dependency/lifecycle/version business rules locally.

## TODO

- The renderer composition root is effective but very large. It may eventually need sub-composition modules per feature or per bounded capability area to stay comprehensible.
- The startup logic in `AppProviders.tsx` mixes dependency provisioning with operational bootstrapping. If initialization behavior grows further, a dedicated application startup coordinator could make the architecture clearer.
