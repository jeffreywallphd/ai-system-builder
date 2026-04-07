# Presentation and State

This document explains how the renderer is organized and how state, stores, services, and composition fit into the larger architecture.

## Presentation architecture in one sentence

The renderer is a React application whose pages and components depend on a manually composed dependency graph of **stores**, **UI services**, **application use cases**, and **runtime-aware adapters**.

## Top-level structure

### React shell
- `src/ui/App.tsx` now gates authenticated renderer startup: unauthenticated routes render without `AppProviders`, and authenticated sessions mount the full provider/bootstrap graph.
- `src/ui/App.tsx` now runs authenticated bootstrap checks against real identity session validation before mounting authenticated providers, and re-validates on visibility return for expiry/revocation recovery.
- `src/ui/routes/AppRouter.tsx` defines the route tree for the main product areas.
- `src/ui/layout/AppLayout.tsx` provides shared layout/chrome.

### Identity entry surface
- Minimal production identity UI now lives in route-driven pages:
  - `src/ui/pages/LoginPage.tsx`
  - `src/ui/pages/RegisterPage.tsx`
  - `src/ui/pages/IdentityAdminPage.tsx`
  - `src/ui/pages/TrustedDevicesPage.tsx`
- Identity transport and environment seams are split by renderer convention:
  - shared transport/session/validation: `src/ui/shared/identity/*`
  - desktop endpoint resolution: `src/ui/desktop/identity/*`
  - web/thin-client endpoint resolution: `src/ui/web/identity/*`
  - UI service adapter: `src/ui/services/IdentityAuthService.ts`
- Shared auth session-state seams now include:
  - `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts` for authenticated bootstrap and active-session refresh orchestration
  - `src/ui/shared/identity/IdentityAuthSessionStore.ts` for platform-aware session persistence (desktop storage bridge when available, local storage fallback)
  - `src/ui/shared/identity/IdentityAuthEnvironment.ts` for channel-aware login context (`desktop` vs `thin-client`)

### Dependency provider
`src/ui/composition/AppProviders.tsx` creates the full UI dependency graph with `createUiDependencies()` and performs startup work such as:
- initializing the runtime console/runtime manager
- initializing MCP state
- refreshing health
- refreshing workflow MCP tooling metadata

This means `AppProviders` is not only dependency injection; it is also a startup orchestrator.

## Manual renderer composition

`src/ui/composition/createUiDependencies.ts` is the real renderer composition root.

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
- `src/ui/services/WorkflowService.ts`
- `src/ui/services/NodeService.ts`
- `src/ui/services/ModelService.ts`
- `src/ui/services/ToolService.ts`
- `src/ui/services/ContextService.ts`
- `src/ui/services/McpService.ts`

These services wrap application use cases and repositories in APIs that are convenient for the stores and pages.

### Why they exist
They reduce UI component coupling to the application layer and let the renderer expose a product-oriented API to stores.

### Architectural tradeoff
Some of these services also include convenience logic that directly manipulates domain objects. That keeps UI code simpler, but it also means some orchestration that could live in the application layer currently lives in the presentation layer.

## Stores as page-facing state managers

The UI uses store classes rather than pushing all state into React components. Stores are the main place where asynchronous workflows, optimistic updates, page state, and view-model shaping happen.

Examples:
- `src/ui/state/WorkflowStore.ts`
- `src/ui/state/ModelStore.ts`
- `src/ui/state/McpStore.ts`
- `src/ui/state/ContextStore.ts`
- `src/ui/state/TuningDatasetStore.ts`
- `src/ui/state/RuntimeConsoleStore.ts`
- `src/ui/state/ManagedServicesStore.ts`

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

The architecture is therefore both layered and feature-oriented: each feature has pages/components/stores/services, but most features still rely on the same src/application/domain infrastructure beneath them.

## Agent Studio shell boundary (Phase 8.2 initial slice)

- The first Agent Studio UI slice is intentionally shell-level (`src/ui/pages/AgentStudioPage.tsx`) and desktop-backend-driven.
- The shell only consumes backend contracts exposed through the desktop bridge (`DesktopAgentAuthoringBridge` / `ai-loom-desktop-agents:*`) for list/load, launch, session reads, run control, and studio snapshot.
- UI state remains view orchestration only (selection/loading/error); it does not reconstruct runtime or policy semantics that already come from backend composition-classified/projection-backed read models.
- Validation/business/runtime interpretation remains in src/domain, src/application, and backend seams.
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
The workflow editor still uses a dedicated presentation projection (`src/ui/presenters/WorkflowExecutionPresenter.ts`) to turn raw execution events, provenance, and output counts into a UI-friendly status summary for `src/ui/components/execution/WorkflowExecutionStatusPanel.tsx`.

Durable execution history now follows the same pattern through application-layer list/detail projections (`ExecutionRunProjectionService` and `ExecutionRunDetailProjectionService`), a thin renderer `ExecutionHistoryService`, and reusable `src/ui/components/execution/ExecutionHistoryPanel.tsx` / `ExecutionRunDetailPanel.tsx` surfaces. Workflow editor history, dataset-generation history, model-training history, and runtime-backed MCP server-operation history all consume those projected summaries/details instead of reconstructing plan semantics in page components or decoding feature-specific artifacts in the UI.

Workflow Studio run-history list/detail follows the same boundary style: `WorkflowStudioRunHistoryPanel` renders workflow-scoped run summaries and detail sections, while data is loaded through `StudioShellService` (`listWorkflowRuns`, `getWorkflowRunDetail`) from backend-owned run-history projections instead of UI-layer repository access.
The panel now keeps disclosure bounded in that same seam: run-level summary first, expandable step-by-step inspection second, and structured diagnostics/failure-location cues rendered from backend read models rather than UI-side parsing/inference.
The same panel now also hosts rerun UX on those backend contracts: `Rerun as-is` and `Edit and rerun` both route through `StudioShellService.startWorkflowRunRerun`, start from canonical persisted execution context, and navigate to the newly created derived run detail.
Edit-and-rerun stays structured and user-facing (target/parameters/execution-metadata/property-overrides fields) rather than exposing raw log parsing or debug-only controls.
Observability entry points now also appear on adjacent workflow surfaces (persisted workflow list cards, workflow draft status, and workflow execution feedback), so run history/run detail navigation is embedded in the normal build -> run -> inspect loop rather than hidden behind one panel.
Workflow execution feedback now links directly to the current run detail and workflow run history when backend run-history persistence returns a durable run id.
Run-history rerun controls now surface explicit unsupported-state UX for non-terminal runs or missing structured historical execution input context.

Related-run lineage navigation now also flows through this same seam: the renderer asks `ExecutionHistoryService` for related-run clusters, and the execution detail panel can jump directly between runs in the same flow/plan grouping without introducing feature-specific linkage logic in page components.

That keeps display wording, badge tone, fallback wording, progress summaries, and truthfulness summaries out of the page/component tree while still leaving execution business logic in the src/application/infrastructure layers.

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

## Multi-surface composition baseline (Feature 15 / Epic 15.1 / Story 15.1.1)

- Canonical multi-surface UI layering, folder responsibilities, and page-shell guardrails now live in `docs/architecture/multi-surface-ui-composition-foundation.md`.
- New desktop, thin-client, tablet, and mobile-responsive admin/operational UI stories should follow that baseline to keep shared presentation logic centralized and host/runtime concerns isolated.

- Phase 9.1 introduces the first bounded Studio Shell renderer surface (`src/ui/pages/StudioShellPage.tsx`) built from reusable panel primitives (`src/ui/components/studio-shell/StudioShellPanel.tsx`) and a thin desktop bridge-backed service (`src/ui/services/StudioShellService.ts`).
- Studio Shell validation/error UX is backend-authoritative via `StudioShellBackendApi` snapshot/validation contracts (`validationIssues` + typed operation error codes); the page only renders those payloads and does not implement taxonomy/contract/provenance/dependency/lifecycle/version business rules locally.
- Phase 9.2 adds a bounded Studio Shell extension seam in the renderer (`src/ui/studio-shell/StudioShellExtensions.ts`) with typed `StudioRegistration` (`kind`, semantic role, allowed behavior options, defaults, shell presentation hints, slot contributions) so atomic and composite studios register through the same shell model.
- Extension composition remains typed and intentionally small (slot + title/subtitle + order + render callback); this is not a generic plugin runtime.
- Phase 9.3 now validates the initial authoring/publish vertical slice through the real renderer service boundary (`src/ui/services/tests/StudioShellService.integration.test.ts`), including publish and persistence reload behavior through the desktop/backend/src/application/repository stack.

## TODO

- The renderer composition root is effective but very large. It may eventually need sub-composition modules per feature or per bounded capability area to stay comprehensible.
- The startup logic in `AppProviders.tsx` mixes dependency provisioning with operational bootstrapping. If initialization behavior grows further, a dedicated application startup coordinator could make the architecture clearer.

- Phase 9.4 (story 2.7) now routes Model Studio through the same shell renderer (`src/ui/pages/ModelStudioPage.tsx` -> `StudioShellPage` with `modelStudioRegistration`) so model authoring uses shared draft/session, validation, dependency, lifecycle, and publish/version surfaces instead of a parallel page stack.
- Model-specific UI behavior is bounded to registration slot contributions (`draft-authoring`, `metadata`) and registration defaults; no model business rules were moved into renderer logic.

- Phase 9.5 (story 2.9) now routes Dataset Studio through the same shell renderer (`src/ui/pages/DatasetStudioPage.tsx` -> `StudioShellPage` with `datasetStudioRegistration`) so dataset authoring inherits shared draft/session, validation, dependency, lifecycle, and publish/version surfaces.
- Dataset-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots); no dataset business rules were moved into UI logic.
- Phase 9.6 (story 2.11) now routes Tool Studio through that same shell renderer (`src/ui/pages/ToolStudioPage.tsx` -> `StudioShellPage` with `toolStudioRegistration`) so atomic MCP/API tool authoring uses the same session/draft/validation/lifecycle/publish path.
- Tool-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) with MCP/API-oriented defaults; no tool business rules were moved into UI logic.
- Phase 9.7 (story 2.12) keeps validation projection backend-authoritative while standardizing atomic defaults: model/dataset/tool registration metadata now includes taxonomy-driven contract defaults and empty dependency defaults, and shared validation issue projection is centralized behind the backend contract.
- Phase 9.8 (story 2.15) adds a cross-atomic end-to-end consistency test (`src/ui/services/tests/StudioShellService.integration.test.ts`) that runs the same create -> edit -> validate -> publish -> reload flow for Model, Dataset, and Tool studios over the real shared seams (renderer service, desktop bridge, backend API, application service, SQLite persistence).
- This keeps studio UI integration truthful: atomic studios remain thin registration variants of `StudioShellPage`, and composite studios can onboard through the same registration seam without parallel page/business-rule stacks.
- Phase 9.9 (story 2.18) now routes Prompt Template Studio through the same shell renderer (`src/ui/pages/PromptTemplateStudioPage.tsx` -> `StudioShellPage` with `promptTemplateStudioRegistration`) so prompt-template authoring uses shared draft/session, validation, dependency, lifecycle, and publish/version surfaces.
- Prompt-template-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots), and cross-atomic shell integration coverage now includes Prompt Template Studio in `src/ui/services/tests/StudioShellService.integration.test.ts`.
- Phase 9.10 (stories 2.21â€“2.22) now routes Config Profile Studio through that same shell renderer (`src/ui/pages/ConfigProfileStudioPage.tsx` -> `StudioShellPage` with `configProfileStudioRegistration`) so config-profile authoring uses shared draft/session, validation, dependency, lifecycle, publish/version, and persistence-backed consistency seams.
- Phase 9.11 (stories 3.5â€“3.6) now routes Workflow Studio through that same shell renderer (`src/ui/pages/WorkflowStudioPage.tsx` -> `StudioShellPage` with `workflowStudioRegistration`) so composite workflow-orchestrator authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Workflow-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Story 4.13 promotes draft authoring as the primary shell surface: `StudioShellPage` now renders draft authoring above/outside the card grid, and shell toolbar configuration is now registration-driven (`shell.toolbar`) with optional typed actions (refresh/save/validate/workflow-mode) that execute through existing shell orchestration seams.
- Studio shell authoring now also supports optional registration-driven side drawers (`shell.drawers.left/right`) with toolbar-bound open/close toggles (left toggle rendered as the leftmost control, right toggle rendered as the rightmost control) so studio-specific authoring cards can be moved into closable side rails without creating a second shell pattern.
- Workflow Studio draft authoring now includes an explicit mode abstraction (`wizard`, `canvas`) plus a centralized renderer-side mode/draft state manager (`src/ui/studio-shell/workflow/WorkflowStudioModes.ts`, `WorkflowStudioModeStateStore.ts`) so mode selection and canonical workflow draft state are shared instead of mode-local.
- Workflow Studio now exposes an explicit mode switch control in the draft-authoring shell and routes mode changes through canonical Workflow Studio mode paths (wizard/canvas) so in-app and direct URL navigation stay aligned.
- Workflow Studio shell toolbar mode switching now renders as a single context-aware toggle action (`Wizard`/`Canvas`) that routes through the same mode-state + route synchronization seam.
- Workflow Studio shell `Nodes` drawer toggle is now mode-aware: it is visible only in Canvas mode and hidden in Wizard mode to avoid non-applicable toolbar controls, and Canvas mode loads with that drawer closed by default.
- Workflow Studio shell toolbar now renders `Nodes` immediately after the mode toggle in Canvas mode and keeps `Save` as the rightmost toolbar action.
- Workflow Studio registration no longer contributes the prior `Workflow draft guidance` draft-authoring card; workflow authoring guidance now lives in the mode surface and shared readiness disclosures.
- Workflow Studio mode state now treats canonical `WorkflowDraft` content as the single source of truth for both modes, with explicit shared section support for `triggers`, `inputs`, `steps`, and `outputs` and no per-mode draft shape.
- Mode switching synchronization is now state-driven: wizard and canvas both mutate/read the same `WorkflowStudioModeStateStore` canonical draft, so switching modes preserves current draft data without shadow transfer logic.
- Canvas mode now uses a bounded projection/sync adapter (`src/ui/studio-shell/workflow/WorkflowStudioCanvasViewModel.ts`) that derives section/node view state from canonical `WorkflowDraft` and applies typed canvas actions back into that same draft (no canvas-only workflow model).
- Workflow Studio Canvas Mode now renders that projection through React Flow (`src/ui/components/studio-shell/workflow/WorkflowStudioCanvasReactFlow.tsx`) as the canonical canvas primitive layer (nodes, edges, controls, viewport).
- React Flow node/edge derivation remains adapter-driven and deterministic: section/item graph nodes + section-flow/entry/sequence edges + stable initial placement are projected in `WorkflowStudioCanvasViewModel` from shared draft truth (not canvas-local workflow state).
- Canvas graph projection now calculates per-node heights from projected node content and applies deterministic cumulative y-axis spacing inside each section column in `WorkflowStudioCanvasViewModel`, so section/item nodes do not touch or overlap.
- Canvas node movement now uses gentle position transitions (`react-flow` node transform transitions), so auto-spacing updates are visually smooth instead of abrupt.
- Canvas wheel behavior now prioritizes zoom interactions (`zoomOnScroll`) and disables scroll-wheel panning for this authoring surface.
- Workflow Studio Canvas Mode now includes a registry-derived node palette for triggers/inputs/steps/outputs where each option submits typed add actions into canonical draft state (`WorkflowStudioCanvasModeSurface` -> `applyWorkflowCanvasAction`), and Workflow Studio configures that palette as a searchable left drawer (`Nodes`) while preserving one shared-draft mutation path.
- Canvas item nodes now expose inline edit + remove controls and a selected-node inspector surface; edits/removals are draft-backed and then reprojected through the React Flow adapter (no canvas-local workflow structure).
- Canvas step sequencing now supports visual reorder interactions in Canvas Mode (drag reorder plus inline move controls), while canonical order remains `WorkflowDraft.steps[]` through typed canvas actions and explicit reorder guardrails.
- Canvas edge management now includes editable connections for currently-supported relationships (`step -> step` dependencies and `step -> output` source links), with create/reconnect/remove routed through React Flow callbacks and reconciled into canonical draft fields (`dependsOnStepIds`, `sourceStepId`).
- Unsupported connection attempts are rejected in the workflow canvas adapter/action seam rather than being accepted as canvas-only graph state.
- Canvas branching now projects canonical if-then config as explicit React Flow branch edges (`then` / `else`) and reconciles branch create/reconnect/remove operations through typed canvas actions into canonical `WorkflowDraft.steps[].config.branches` state.
- Canvas step editing now includes first-pass conditional controls (condition expression, branch labels, branch step-id lists) in the shared step editor surface so conditional configuration is authored against canonical draft state rather than canvas-only component state.
- Canvas input/step node editors now include selector-backed dataset and agent asset linkage through shared asset-selector seams (session store, adapters, shell UI), writing canonical references into `inputs[].asset` and `steps[].assetRef` while preserving wizard/canvas shared-draft synchronization.
- Workflow Studio Canvas Mode now renders the left `Nodes` drawer as a real overlay drawer: fixed under the app header, anchored to the far-left edge on tablet/desktop, full-width on mobile, and including a fixed close affordance with independently scrollable node sections.
- Workflow Studio canvas layout now renders the React Flow canvas surface directly (without the prior canvas layout container card wrapper), with inspector/details surfaces still kept in the same mode boundary.
- Workflow Studio draft authoring now has explicit mode-aware renderer boundaries: shared shell orchestration stays in `StudioShellPage`, while mode-specific surfaces are isolated in `WorkflowStudioDraftAuthoringBoundary` + `WorkflowStudioWizardExperienceSurface` + `WorkflowStudioCanvasExperienceSurface`.
- Experience-asset authoring keeps the reusable UI-neutral contract seam (`src/ui/studio-shell/experience-assets/ExperienceAssetContracts.ts`), while active mode switching now resolves directly inside studio-specific boundaries (`WorkflowStudioDraftAuthoringBoundary`, `DatasetStudioDraftAuthoringBoundary`) instead of routing through a shared intermediary renderer.
- `ExperienceAssetAuthoringBoundary` has been removed from the repository after disconnection from active runtime; workflow and dataset authoring continue to preserve route-driven wizard/canvas behavior in their canonical studio boundaries.
- Migration audit snapshot for workflow authoring/runtime seams under the studio-shell flow:
  - **Standalone editor route retired from active runtime:** `/workflows/:workflowId` now redirects into Workflow Studio entry routing and no longer mounts the standalone editor page.
  - **Legacy workflow editor removed:** `WorkflowEditorPage` is no longer imported in active router paths and has been deleted after deprecation.
  - **Workflow-specific wizard/canvas intermediary surfaces removed:** active runtime now binds through `WorkflowStudioWizardExperienceSurface` and `WorkflowStudioCanvasExperienceSurface`; prior mode layout/surface files were deleted after disconnection.
  - **Legacy compatibility infrastructure removed:** `ExperienceAssetAuthoringBoundary` is no longer part of active studio runtime or source.

- Experience-asset presentation now also has a compact neutral vocabulary layer (`src/ui/studio-shell/experience-assets/ExperiencePresentationVocabulary.ts`) covering document/issue/page/mode/action ids plus reusable action/progress/issue summary models for cross-studio authoring surfaces.
- Wizard engine mechanics are now extracted into a workflow-neutral renderer (`src/ui/components/studio-shell/experience-assets/ConfigurableWizardSurface.tsx`) with narrow contracts (`src/ui/studio-shell/experience-assets/ConfigurableWizardSurfaceContracts.ts`) for ordered page navigation, current-page hosting, progress summary, terminal actions, and readiness summary rendering without workflow-editor imports.
- Canvas engine mechanics are now extracted into a workflow-neutral renderer (`src/ui/components/studio-shell/experience-assets/ConfigurableCanvasSurface.tsx`) with narrow contracts (`src/ui/studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts.ts`) for graph shell hosting, focused-target handling, palette/inspector regions, interaction messaging, and optional drawer orchestration without workflow-editor imports.
- Studio-shell orchestration remains host-owned around these reusable surfaces: save/run/validate/lifecycle orchestration and backend persistence/execution calls continue in `StudioShellPage` + `StudioShellService`/backend contracts, while wizard/canvas experience surfaces consume document/mode/issue state plus host-provided callbacks.
- Wizard and canvas are now first-class registered experience assets (`loom-wizard`, `loom-canvas`) via `src/ui/studio-shell/experience-assets/ExperienceSurfaceAssets.ts`, and Workflow Studio declares consumption through registration configuration (`workflowStudioRegistration.shell.experienceAssets`) instead of hardcoded mode metadata.
- Experience-asset canvas definition format now exists as a bounded contract (`CanvasExperienceAssetDefinition`) so studios can map document-to-graph summaries, palette/inspector hooks, and graph interaction hosts into the reusable canvas surface without embedding workflow-specific domain semantics.
- Workflow Studio Canvas now binds through an explicit workflow adapter seam (`src/ui/studio-shell/workflow/WorkflowCanvasExperienceAdapter.tsx`) that maps workflow draft/view-model semantics into `CanvasExperienceAssetDefinition` for the reusable canvas engine, while keeping workflow-specific editing behavior outside generic canvas contracts.
- Reusable experience surfaces now expose route-neutral state/callback contracts (`currentModeId`/`onModeChange`, `currentPageId`/`onPageChange`) so workflow route parsing/synchronization stays in workflow-host integration layers rather than inside generic wizard/canvas boundary components.
- Workflow Studio mode surfaces now render directly as asset-native experience surfaces (`WorkflowStudioWizardExperienceSurface`, `WorkflowStudioCanvasExperienceSurface`) inside the draft authoring boundary without workflow-specific layout wrappers in active runtime paths.
- Wizard Mode now provides a structured section framework via reusable section components (`WizardSection`, `SectionHeader`, `SectionBody`) and always renders Trigger, Inputs, Steps, and Outputs in top-to-bottom order.
- Wizard Trigger section now uses a registry-backed interactive authoring editor (`WorkflowStudioTriggerSectionEditor` + `src/ui/studio-shell/workflow/WorkflowWizardTriggers.ts`) that enumerates supported trigger types from `WorkflowTriggerTypeRegistry`, adds trigger instances from registry defaults, and binds add/edit/remove/type-switch actions directly to canonical `WorkflowDraft.triggers` in `WorkflowStudioModeStateStore`.
- Trigger authoring now supports multi-trigger management in wizard mode (add/select/edit/reorder/remove) with id-based operations, stable display ordering, and safe selected-trigger fallback after deletion.
- Trigger configuration editing now uses type-specific form surfaces for user/manual, temporal, and state triggers, with shared utility-level config patching and validation-message projection from shared trigger validation seams.
- Trigger validation feedback now stays canonical-projection-driven (`WorkflowStudioModeStateStore` + `validateWorkflowDraft`) without renderer-local trigger-rule duplication.
- Trigger UX language/config now remains continuation-ready: user scope authoring exposes both `workflow-start` and `workflow-continuation` semantics so later intermediate resume/human-approval trigger behavior is not blocked by start-only assumptions.
- Wizard Inputs now include an interactive dataset selector (`WorkflowStudioInputSectionEditor`) that queries registry dataset assets (`atomic/dataset/none`), supports search + multi-select, writes directly to canonical `WorkflowDraft.inputs[]`, and preserves mode-shared draft truth.
- Wizard Inputs now also support inline dataset creation handoff through shared route-based inline creation semantics (`InlineAssetCreationService`): launch Dataset Studio, return to Wizard Inputs, and auto-attach returned dataset assets when handoff status is `created` (while `cancelled` returns without side effects).
- Workflow Wizard Inputs now also include bounded explicit input-binding authoring on the same surface (`WorkflowStudioInputSectionEditor` + `WorkflowWizardInputBindings`) so each workflow input can map to canonical source kinds (UI form value, selected-image context, dataset-instance reference, runtime/trigger payload, and constants), persist authored `metadata.systemInputBinding`, and render validation/preview diagnostics through shared binding-resolution services.
- Binding flow coverage now includes UI + application integration tests for authoring persistence, validation/preview diagnostics, and execution-context resolution across supported binding sources (`src/ui/studio-shell/workflow/tests/WorkflowWizardInputBindings.test.ts`, `src/ui/components/studio-shell/workflow/tests/WorkflowStudioInputSectionEditor.test.tsx`, `src/application/workflow-studio/tests/WorkflowExecutionContextAssemblyService.test.ts`, `src/application/workflow-studio/tests/WorkflowInputBindingPreviewService.test.ts`).
- Wizard Steps now include an interactive ordered step builder (`WorkflowStudioStepSectionEditor`) over canonical `WorkflowDraft.steps[]` with add/remove, up/down reorder, stable step identity preservation, and explicit empty-state first-step CTA.
- Wizard Steps now include an extensible step-type selector over canonical `WorkflowDraft.steps[]`, supporting both asset-backed and built-in action step categories.
- Wizard step selection now uses one registry-backed authoring flow for both asset-backed and built-in options, with built-in actions clearly labeled by canonical category (`control-flow`, `temporal`, `human-interaction`) and no page-local hardcoded built-in list.
- Built-in wizard actions now include `if-then`, `loop-iteration`, `delay-wait`, and `manual-approval`, with per-step type switching that clears incompatible stale config/asset references.
- Wizard built-in step configuration is now structured and draft-bound for all initial built-ins: conditional expression + branch labels/step-ids (`if-then`), loop mode/source/body/limits (`loop-iteration`), duration vs until-time with note (`delay-wait`), and prompt/mode/outcomes/roles/timeout policy (`manual-approval`).
- Wizard Steps now expose a placement-aware insertion control (`Insertion point`) and control-flow-aware move guards: reorders that would place referenced branch/body/outcome steps before their control-flow parent are blocked in authoring operations, and move buttons only enable when the resulting order stays valid.
- Wizard Outputs now include an interactive output editor (`WorkflowStudioOutputSectionEditor`) over canonical `WorkflowDraft.outputs[]` with multi-output list management (view/select/edit/remove/reorder), destination-type selection (`file-export`, `web-viewer`, `system-entry`, `prompt-response-chat`), canonical output ordering (`order`) preservation, and metadata-driven type-specific configuration forms (required/optional field semantics plus type-switch resets that clear stale destination-specific options).
- Output add/config UI now composes a reusable registry-driven selector seam (`WorkflowOutputSelector` + `src/ui/studio-shell/workflow/WorkflowWizardOutputs.ts` + `WorkflowOutputTypeRegistry`) so wizard and future authoring surfaces reuse one metadata contract instead of hardcoded per-type add flows.
- Output reload hardening now preserves unknown/stale output destination types as explicit unknown entries in authoring/review summaries (instead of silently coercing to a default type), so malformed persisted output payloads remain visible and recoverable.
- Output configuration remains draft-bound and mode-shared: file export format/delivery/path/name, web viewer title/presentation mode, and system-record destination fields (entity, collection path, write mode, record shape, metadata inclusion) persist through Wizard/Canvas mode switches using `WorkflowStudioModeStateStore`.
- Wizard review/overview surfaces now render registry-driven output summaries (type label + key configuration details) from canonical `WorkflowDraft.outputs[]`, including the workflow readiness review and mode overview cards, so summaries stay current after add/edit/remove/reorder operations.
- Workflow execution now has a bounded conversational continuation seam in the renderer (`src/ui/workflow-conversation/*` + `WorkflowConversationSessionService`): eligible prompt-response workflow runs create canonical chat sessions linked to workflow + execution ids and persisted through local UI storage.
- Conversational sessions now route through a dedicated chat surface (`/run/workflow-chat/:sessionId`, `src/ui/pages/WorkflowConversationPage.tsx`) that rehydrates persisted session state, renders seeded initial prompt/assistant messages from execution output truth, and appends continued turns through the existing workflow execution service path.
- Workflow Studio mode state now exposes shared validation hooks (`WorkflowStudioModeValidation` + `WorkflowStudioModeStateStore` validation projection) so both Wizard and Canvas consume one canonical draft validation result path (including parse-safety and draft-integrity checks) with non-crashing feedback.
- Workflow Studio now supports direct mode deep links through `/studio-shell/workflow/:modeId` and `?mode=` parsing via `WorkflowStudioModeRouting`; resolved modes are synchronized into the centralized `WorkflowStudioModeStateStore` (no routing-local mode shadow state).
- Default mode behavior is now explicit and centralized: entering Workflow Studio without an explicit mode (or with an invalid mode) resolves deterministically to `wizard`, while valid explicit route/query modes are still respected.
- Invalid workflow mode routes are handled as safe fallbacks (default mode selected, warning surfaced) so unsupported mode URLs do not break draft authoring or shared save/lifecycle flows.
- Workflow mode/draft state is now persisted per studio through a shared store accessor (`getWorkflowStudioModeStateStore`) and snapshot-aware synchronization so normal mode-route transitions do not reset in-progress draft edits for the same authoring session.
- Workflow Studio hardening now keeps unsaved state explicit at shell level (`WorkflowStudioModeStateStore.hasLocalDraftEdits`) and projects that state in `StudioShellPage` with route-leave + browser-refresh guards (`useBlocker`, `useBeforeUnload`) that trigger only when exiting Workflow Studio routes.
- Workflow mode transitions stay mode-safe under unsaved edits: wizard/canvas toggles remain inside one shared draft store and do not trigger leave-guards, while save flows now return success/failure so guarded navigation can save-then-proceed safely.
- Workflow Studio save flows now also synchronize persisted workflow records through backend/application workflow-persistence use cases, so wizard-authored and canvas-authored shared-draft saves update the same persisted canonical workflow definition.
- Workflow Studio metadata authoring now keeps workflow name/summary/tags in the same save/dirty contract as shared draft content: save status projects `saving`/`saved`/`unsaved`/`failed`, route-leave guards include metadata edits, and workflow metadata updates flow through the same studio save path into persistence and Explore listings.
- Canvas validation polish now projects canonical draft issues into React Flow-adjacent UI (`WorkflowStudioCanvasModeSurface`): section/node issue summaries, invalid-node styling, empty-state guidance, and actionable invalid-connection feedback from `WorkflowStudioCanvasViewModel.resolveWorkflowCanvasConnectionAction`.
- Story 2.13 now adds focused mode-system regression coverage at renderer/application seams (`src/ui/studio-shell/workflow/tests/WorkflowStudioModeSystem.integration.test.tsx` + expanded routing tests), covering default/direct/invalid route resolution, mode-switch UI state transitions, wizard/canvas shared-draft synchronization, mode-layout rendering, and validation-hook safety checks.
- Wizard progression/readiness is now derived from canonical draft + shared validation via `src/ui/studio-shell/workflow/WorkflowStudioWizardProgress.ts` (section completeness/readiness, previous/current/next section targets, and workflow-ready summary) rather than persisted draft fields.
- Wizard mode now uses explicit page routing and linear progression in `WorkflowStudioWizardModeSurface`: one page is visible at a time (`trigger`, `inputs`, `steps`, `outputs`) with route-backed page buttons plus Back/Next controls.
- Wizard page-routing contracts are now reusable at the shell level (`src/ui/studio-shell/wizard/WizardPageRouting.ts`), and Workflow Studio binds that contract through `src/ui/studio-shell/workflow/WorkflowStudioWizardRouting.ts` + `/studio-shell/workflow/wizard/:wizardPageId` routes.
- Story 3.15 now adds a unified wizard readiness summary surface (per-section status + workflow-level blocking issues + explicit required-input policy) and an explicit terminal handoff action (`Prepare for Run`) that blocks invalid completion while linking ready flows into lifecycle/publish controls.
- Workflow Studio manual run now routes through backend/application orchestration from the shell toolbar (`Run Workflow`) and renders backend-authoritative pre-execution validation + launch outcome feedback in the same shell surface (no UI-local execution rule path).
- Workflow Studio execution feedback is now presented through a dedicated reusable renderer panel (`src/ui/components/studio-shell/workflow/WorkflowStudioExecutionFeedbackPanel.tsx`) that combines canonical readiness checks, launch lifecycle status, failure summaries, and bounded output handoff summaries from backend read models.
- Toolbar `Run Validation` in Workflow Studio now uses canonical execution-readiness validation (`StudioShellService.assessWorkflowExecutionReadiness`) rather than only draft-metadata validation, keeping launch eligibility and blocked reasons aligned with the execution pipeline.
- Story 4.14 rebalances wizard mode for authoring focus: active page content renders directly under page buttons, wizard focus/progress text sits directly beneath those page buttons, Back/Next controls are on the page-nav rail (plus an additional inline Trigger-page Back/Next row), and readiness diagnostics remain in a bottom-of-stack disclosure collapsed by default.
- Stories 5–6 now route Workflow Studio wizard rendering through a reusable wizard asset definition seam (`src/ui/studio-shell/experience-assets/ConfigurableWizardSurfaceContracts.ts` + `WizardExperienceAssetDefinition` contracts) and a workflow-specific adapter (`src/ui/studio-shell/workflow/WorkflowWizardExperienceAdapter.tsx`) that maps workflow sections, readiness/progress, issues, page renderers, and terminal behavior into the generic configurable wizard surface.
- Navigation/progression concerns remain UI-only orchestration; all section edits still mutate only shared canonical `WorkflowStudioModeStateStore.sharedDraft`.
- Phase 9.12 (stories 3.7â€“3.8) now routes Context Bundle Studio through that same shell renderer (`src/ui/pages/ContextBundleStudioPage.tsx` -> `StudioShellPage` with `contextBundleStudioRegistration`) so composite context-bundle input-preparer authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Context-bundle-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.13 (stories 3.9â€“3.10) now routes Dataset Pipeline Studio through that same shell renderer (`src/ui/pages/DatasetPipelineStudioPage.tsx` -> `StudioShellPage` with `datasetPipelineStudioRegistration`) so composite dataset-pipeline authoring uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Dataset-pipeline renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.14 (stories 3.11â€“3.12) now routes Training Recipe Studio through that same shell renderer (`src/ui/pages/TrainingRecipeStudioPage.tsx` -> `StudioShellPage` with `trainingRecipeStudioRegistration`) so composite training-recipe authoring uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Training-recipe renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.15 (stories 3.13â€“3.14) now routes Tool Chain Studio through that same shell renderer (`src/ui/pages/ToolChainStudioPage.tsx` -> `StudioShellPage` with `toolChainStudioRegistration`) so composite tool-chain authoring also uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Tool-chain renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.16 (stories 3.17â€“3.18) extends composite consistency/interop coverage through shared integration tests over the real renderer-to-persistence path, including all implemented composite studios and composite-to-atomic dependency reuse checks (`src/ui/services/tests/StudioShellService.integration.test.ts`).

Current Direction 5 UI status:
- Fully implemented now in renderer: atomic studios + composite studios (Workflow, Context Bundle, Dataset Pipeline, Training Recipe, Tool Chain) on one shared `StudioShellPage` architecture.
- Registry is now a first-class Studio Shell surface (`/studio-shell/registry`) routed through the same app shell/navigation and implemented as a thin renderer page over bridge contracts (`RegistryService`) with desktop-preload-first and browser-fallback behavior, not a parallel UI system.
- In browser development mode, registry calls now resolve through `BrowserRegistryBridgeFallback` instead of throwing on missing preload bridge contracts; this keeps `/explore` operational while preserving the same backend API response shape.
- The registry fallback reuses the same in-memory workflow-persistence fallback repository as `StudioShellService`, so persisted-workflow discovery in Explore stays aligned with browser-hosted Workflow Studio authoring flows.
- Registry browsing/filtering is API-driven and taxonomy-aligned (structural kind + progressive advanced semantic-role/behavior filters), keeping filter/business semantics backend-authoritative while reusing shared page/card/layout patterns.
- Registry list/detail terminology is now normalized around **Structure / Role / Behavior** labels across list cards, summary badges, and filter groups.
- Search + filter interaction is intentionally coherent: both inputs are active together, context is preserved in URL query params, and detail navigation retains return-context (`registryContext`) for list -> detail -> list continuity.
- Registry cross-studio handoffs are now URL-driven and taxonomy-derived (`semanticRole -> studio route`) so list/detail/graph surfaces can deep-link to the correct studio editor without introducing a second navigation model.
- Registry asset detail now surfaces backend-projected validation/compatibility summaries (for example incompatible dependencies and behavior-mismatch signals) from registry API payloads instead of duplicating validation logic in UI.
- Dependency and lineage panel rendering remains read-model-driven, with minor UX refinements (stable node ordering, node counts, and consistent "Back to results"/"Open in studio" actions) rather than new graph architecture.
- Direction 5 stories 5.7â€“5.8 now add a bounded System Studio registration/page route (`/studio-shell/system`) on the same shared `StudioShellPage` architecture (no parallel shell/registration/validation lifecycle).
- System Studio registration explicitly declares system-level composition capabilities (atomic + composite + system, including nested system composition) and participates in shared default metadata/taxonomy/contract + validation/publish-gating seams.
- Direction 5 stories 5.11â€“5.12 now add a bounded System Composition editor surface inside System Studio (`SystemCompositionEditor`) with backend-authoritative add/remove/reorder child orchestration, registry-backed candidate discovery, and explicit nested-system summaries over real draft content/dependency state.
- Direction 5 stories 5.13â€“5.14 now extend that same System Studio registration with bounded interface/config authoring panels (`SystemInterfaceEditor`, `SystemParameterConfigEditor`) that persist authored system inputs/outputs/parameters/defaults through system-specific backend operations (`updateSystemInterfaces`, `updateSystemParameters`) rather than UI-only state.
- Direction 5 story 5.17 now extends shared route/handoff seams so system assets participate as first-class navigation targets across registry list/detail and System Studio composition surfaces, including context-preserving query handoffs (`assetId`, `versionId`, `registryContext`, parent/selected-component context) and explicit nested-system traversal.
- Direction 5 story 5.18 now adds a bounded System Studio compatibility insights surface (`SystemCompatibilityInsightsPanel`) driven by backend-authoritative system validation outputs (`getSystemCompatibilityInsights`) with recursive issue summaries (child/nested/binding/interface/config mismatch counts) instead of UI-side heuristics.
- Direction 5 story 5.21 now adds end-to-end System Studio consistency coverage over the real service -> bridge -> backend -> application -> SQLite seam, including child-component operations, system interface/parameter/execution-metadata authoring, publish, and reload consistency.
- Direction 5 story 5.22 now adds explicit atomic/composite/system interop coverage for System Studio through the same real seam, validating pinned dependency propagation, mixed child-kind composition, clean compatibility-insights reporting, and persisted upstream lineage after publish/reload.
- Direction 5 story 5.23 now extends registry integration validation coverage for system assets so registry list/detail/dependency-graph/lineage views stay consistent for nested system-of-systems and versioned system lineage scenarios over the real API + SQLite-backed seams.
- Direction 5 stories 7â€“8 now complete the four-step System Studio wizard flow as `Pages`, `Interface Design`, `Inputs & Outputs`, and `Settings` through the same reusable wizard/canvas experience-asset boundaries.
- Wizard page 2 now embeds the reusable canvas surface in-flow and renders page-switch controls directly above the canvas; active page selection stays synchronized to `systemSpec.pages` + `canvasAuthoring.pageLayouts` so each page keeps independent panel layout state while switching.
- System Studio page authoring now includes a dedicated screen list + creation flow (`SystemPageSetupEditor`) backed by reusable page-model templates (`SystemPageModel`), so new pages are first-class draft assets (title/description/layout/navigation defaults) persisted through shared draft serialization (`systemSpec.pages` + `canvasAuthoring.pageLayouts`) instead of local-only UI state.
- System Studio canvas authoring now explicitly treats panel nodes as high-level page sections (`SystemCanvasExperienceAdapter`), keeps page-region context visible in the canvas palette, and reinforces that detailed panel internals are authored in panel-specific studios to preserve future embedded panel-design handoffs.
- System Studio page-canvas sections are now intentionally clickable design targets (separate from page-level focus), and selecting a section opens a bounded embedded panel-design studio host in the inspector with graceful fallback states for missing/unsupported panel studio definitions.
- Direction 5 stories 9-10 now project authored System Studio page layouts into runtime-facing interface preview composition (`SystemRuntimeInterfacePreview`), so selected runtime pages and panel placement come from persisted `systemSpec.pages` + `canvasAuthoring.pageLayouts` (including empty-page fallback states) rather than decorative canvas-only metadata.
- Workflow Studio and Dataset Studio now both declare and consume shared wizard/canvas experience assets (`loom-wizard`, `loom-canvas`) through studio-bounded authoring boundaries (`WorkflowStudioDraftAuthoringBoundary`, `DatasetStudioDraftAuthoringBoundary`) while keeping domain mapping/orchestration inside studio-specific adapters.
- Wizard pages 3 and 4 now host bounded `SystemInterfaceEditor` and `SystemParameterConfigEditor` surfaces as user-facing `Inputs & Outputs` and `Settings`, keeping advanced behavior within existing editor seams while maintaining plain top-level wizard language.
- Direction 5 stories 6.15â€“6.16 now keep runtime monitoring/result UX inside the existing System Studio run-trigger extension: `SystemRuntimeRunPanel` composes bounded API-driven monitoring/result sections (`ExecutionMonitorPanel`, `ExecutionResultPanel`) to render execution status/progress/node+nested state, bounded trace/log and recovery indicators, plus execution output/node+nested summaries and diagnostics from `getSystemExecutionStatus/getSystemExecutionTrace/getSystemExecutionResult` without renderer-side runtime model reimplementation.
- Still intentionally out of scope in renderer: speculative rich visual graph tooling and runtime execution-binding authoring beyond current structural composition/editing + shared shell lifecycle/publish flows.

- Data Studio preview UI now includes a reusable `DataPreviewPanel` surface (`src/ui/components/assets/DataPreviewPanel.tsx`) that is fed by data-layer execution results (preview model + diagnostics + validation issues + lineage summary) rather than UI-local data parsing/render branching.
- Dataset Studio integrates this through a registration-bounded extension (`dataset-studio-data-preview-panel` in `DatasetStudioRegistration.ts`) using a thin draft-content adapter (`DatasetStudioDraftPreviewPanel.tsx`) that executes existing converter/execution seams and renders empty/loading/error/ready states without introducing a parallel page architecture.
- Dataset Studio preview authoring now includes a reusable schema-driven `AssetConfigurationPanel` (`src/ui/components/assets/AssetConfigurationPanel.tsx`) consumed by the same draft adapter surface (`DatasetStudioDraftPreviewPanel.tsx`) so configuration editing is not a bespoke asset-specific form.
- Configuration controls are rendered from registered data-asset config schema contracts (`DataAssetConfigSchema`) resolved through the data-layer registry seam (`src/application/dataset-studio/DataAssetRegistry.ts`) and applied back into execution requests via existing execution-framework orchestration.
- Field-level config diagnostics now project from the shared Data Studio validation framework (`validateDataAssetConfigValues` in `DataStudioValidation.ts`) instead of UI-local validation rules.
- The Dataset Studio panel keeps lifecycle behavior bounded and architecture-aligned:
  - deterministic defaults from schema + asset config,
  - local edit/apply/reset controls in one reusable panel,
  - apply-triggered execution/preview refresh through `DefaultDataAssetExecutionFramework`,
  - empty/loading/error/ready states rendered through existing preview panel patterns.

- Dataset Studio ingestion authoring now uses shared registry discovery metadata in the same preview panel:
  - ingestion asset selection is registry-driven (CSV/JSON/document/PDF/image/batch),
  - source input mode controls (`in-memory`, `local-file`, `local-directory`) are rendered through shared field/form classes,
  - schema-driven config remains in `AssetConfigurationPanel`,
  - preview rendering reuses `DataPreviewPanel` / `DataPreviewSurface`,
  - structured ingestion warnings/errors render from normalized ingestion issue contracts instead of raw exception text.
- Dataset Studio ingestion configuration now defaults to a simple mode in `AssetConfigurationPanel` and reveals advanced fields only through an explicit mode toggle, driven by config-schema visibility metadata (`simple`/`advanced`) rather than UI-local field lists.
- Dataset Studio source-input authoring now also includes a bounded advanced-source toggle for directory patterns and optional source filtering limits, while keeping default source entry minimal for common flows.
- Data Studio navigation/language now makes schema vs flow responsibilities explicit: Dataset Studio presents side-by-side entry cards for `Schema Studio` (structure definitions) and `Pipeline Studio` (data movement/transformation flow definitions), while technical graph internals remain secondary disclosures in the same authoring surface.

Direction 5 Epic 11 final hardening status (stories 11.23-11.24):
- UX consistency hardening now has shared policy/regression seams in `src/ui/routes/UxConsistencyPolicy.ts` and `src/ui/routes/IntentUxRegressionSuite.ts`, focused on intent-first terminology, taxonomy suppression in primary UX, and cross-surface route/origin continuity across Build/Explore/Run plus shell-adjacent surfaces.
- Legacy UX cleanup policy artifacts were removed after sunset; active routing uses canonical path redirects directly in `src/ui/routes/AppRouter.tsx`.
- Explore is the user-facing library term in page-level hero copy (`src/ui/pages/RegistryPage.tsx`), while internal registry route naming remains implementation detail.
- Legacy compatibility feature-flag gating is now disconnected from active runtime routing; canonical Build/Explore/Run redirects are always enforced for deprecated entry paths.

Intent UX documentation alignment checklist (implemented scope):
- Implemented now: Build/Explore/Run primary navigation shell, intent-based Build entry/routing, contextual breadcrumbs/return paths, unified Run launch model, command palette onboarding/recommendations/recents integration, and legacy-route sunset controls.
- Build now includes a dedicated intent-first automation entry route (`/build/automate`) where users describe automation goals in plain language (`What do you want to automate?`) before launching the existing workflow studio path; intent text is carried forward via build-routing prefill context and URL handoff metadata.
- Primary route switching is now command-palette-driven in the app shell header; the legacy header link strip is removed, and Home remains accessible through the AI Loom Studio logo link.
- Implemented now: deprecated studio-era entry paths are always redirected to canonical Build/Explore/Run routes in active runtime; old compatibility policy code is retained only as deprecated reference files.
- Future work (not implemented here): full removal of legacy feature-flag compatibility paths after rollout criteria are complete.

Workflow persistence reuse hardening (stories 11.11-11.14):
- Build and Run entry surfaces now include persisted-workflow reuse cards driven by shared Explore/registry query seams (`PersistedWorkflowEntryService`) instead of workflow-only side channels.
- Run interface routing now supports a workflow context (`context=workflow` plus workflow id/status) and resolves into canonical Workflow Studio open/resume entry paths for run-oriented handoff.
- Workflow persistence error mapping now distinguishes persistence adapter failures (`persistence-failed`) from not-found/conflict/invalid-request outcomes, and persisted-workflow loading now rejects malformed serialized workflow definitions with safe invalid-request responses.
- Explore library aggregation now tolerates persisted-workflow listing failures by degrading to registry-backed assets instead of failing the entire mixed-asset listing flow.
- Workflow Studio entry initialization remains explicit and route-driven (`workflowEntry=new|open-existing|resume-draft|duplicate`) and reuses the same backend persistence contracts for opening/resuming persisted definitions.
- Wizard and Canvas authoring continue to share one canonical draft state/persistence path (`WorkflowStudioModeStateStore` + shared save), so mode switches do not create persistence forks or parallel draft representations.
- Workflow metadata editing (name/summary/tags) remains in the same unsaved/save-state contract as draft content and persists through the same save orchestration path into persistence/read-model surfaces.
- Browser-hosted development now keeps Explore workflow-persistence reuse flows available by resolving registry queries through a bounded browser fallback bridge when desktop registry contracts are unavailable, using the same in-memory workflow-persistence fallback repository as Studio Shell.
- Automated coverage now includes persistence contracts and SQLite adapter list-query behavior, persisted workflow discovery filtering for Explore/Build/Run entry cards, and existing studio/runtime integration coverage across create/open/resume/duplicate/readiness/run flows.

## Direction 5 UX update: Main menu Data entry

- The global header command palette/navigation menu now includes a first-class `Data` entry (`src/ui/routes/CommandPalette.ts`) that routes to Dataset Studio (`/studio-shell/dataset`).
- Top-level menu order is now: `Build`, `Run`, `Explore`, `Data`, `Manage`.
- This extends existing shell navigation patterns without adding a parallel navigation system.

## Direction 5 UI update: Unified ingestion simple/advanced UX (stories 15.5-15.6)

- Dataset Studio ingestion preview now defaults to the unified ingestion asset surface, with low-level ingestors hidden unless users explicitly opt in to inspect them.
- The configuration panel keeps simple mode primary and exposes advanced options through the existing mode toggle pattern; mode changes preserve relevant values while reusing shared schema/config surfaces.
- Detection and route summaries are rendered as bounded UI disclosures so advanced users can inspect routing decisions without exposing raw infrastructure internals or duplicating orchestration logic in UI components.

## Direction 5 UI update: Unified ingestion failure/fallback surfacing + wrapper usage (stories 15.9-15.10)

- Dataset Studio preview now invokes unified ingestion through the high-level wrapper (`UnifiedIngestionAssetExecutionWrapper`) instead of calling orchestration internals directly.
- Unified fallback state is rendered as concise summary badges (fallback route, degraded preview) plus existing issue lists, so users can inspect deterministic fallback behavior without seeing raw stack/library internals.
- UI error/warning rendering remains contract-driven (`code`, `severity`, `message`, optional path/details) and now includes degraded-preview warnings from the shared unified preview contract.

## Direction 5 UI update: unified-first discoverability + unified batch preview (stories 15.11-15.12)

- Ingestion asset discoverability is now centralized in data-asset registry metadata (`descriptor.discoverability`) and catalog queries (`listIngestionDataAssets`), so default UI flows surface only the unified ingestion entrypoint while advanced inspection can reveal low-level ingestors.
- Dataset Studio preview now reads ingestion options from that shared catalog visibility seam (`default` vs `advanced`) instead of ad hoc UI-only filtering.
- Unified ingestion now supports directory/file batch preview through batch wrapper entrypoints (`previewBatch`/`executeBatch`) while still reusing per-item unified single-ingestion orchestration.
- Batch preview UX remains concise by default (aggregate counts and badges) and uses expandable per-item status details for route/detection inspection and failed-item visibility.

## Direction 5 UI extension update: Stage-based Dataset Studio wizard shell (story 15E.10)

- Dataset Studio draft authoring now includes a stage-based wizard panel (`src/ui/components/assets/DatasetStageWizardPanel.tsx`) rendered through the existing registration-based shell extension path (`DatasetStudioRegistration`).
- Wizard UI state/orchestration stays out of React components through a dedicated adapter seam (`src/ui/studio-shell/dataset/DatasetStageWizardStateAdapter.ts`) that wraps `WizardFlowEngine` for snapshot/read/update/navigation behavior.
- Stage progress/navigation UI is now reusable in `src/ui/components/wizard/StageWizardProgressNavigator.tsx`, with explicit current/completed/skipped/pending/disabled stage cues.
- Stage rendering uses progressive disclosure:
  - simple stage-specific config renderers for source/ingestion stages,
  - fallback stage summary renderer for non-customized stages,
  - optional advanced metadata disclosure for inspectability/lineage-focused details.
- Styling reuses existing wizard/card/field classes and extends shared wizard styles (`src/ui/styles/components/wizard.css`) with reusable stage-wizard classes (no stage-specific element selectors).


## Direction 5 UI extension update: Stage-aware dataset canvas graph + editing foundations (stories 15E.11-15E.12)

- Dataset Studio now has a dedicated stage-canvas projection seam in `src/application/dataset-studio/StageCanvasGraphProjectionService.ts` that projects canonical stage flow/runtime state into a canvas graph model (stage groups, underlying asset nodes, and stage-flow edges) without introducing a parallel domain graph.
- Projection supports wizard-backed runtime state, template-instantiated stage flows, and saved stage-flow definitions through one contract path, preserving stage ordering/dependency semantics and inspectable stage/node metadata.
- Stage grouping metadata now includes stage name/description/status, execution mode, asset-count/shape summaries, runtime config/output payloads, and runtime-tracking hooks for later inspection/editor expansion.
- Stage-aware editing is now centralized in `src/application/dataset-studio/StageCanvasEditingService.ts` (reorder validation, optional stage add/remove validation, stage config updates, compatibility checks, and graph regeneration) instead of UI-local domain mutations.
- Dataset stage authoring UI now exposes a shared Wizard/Canvas surface (`src/ui/components/assets/DatasetStageAuthoringPanel.tsx`) with one adapter-backed source of truth (`DatasetStageWizardStateAdapter` wrapping `WizardFlowEngine`) so wizard and canvas remain synchronized.
- Canvas rendering for dataset stages now uses `@xyflow/react` (`src/ui/components/assets/DatasetStageCanvasReactFlow.tsx`) and keeps business rules in adapter/service seams; UI handles selection and minimal edit affordances only.

## Direction 5 UI extension update: Stage inspection + persistence reload surfaces (stories 15E.13-15E.14)

- Dataset stage wizard/canvas views now render normalized stage inspection summaries produced by shared application adapters (not component-local derivation), including:
  - stage output summaries,
  - contract/type summaries,
  - preview availability/reference/fallback status,
  - propagated upstream lineage/storage metadata.
- Wizard now surfaces current-stage inspection plus previously completed/skipped stage inspection cards using the same adapter snapshot source used for navigation/configuration.
- Canvas inspector now renders stage-group inspection from the same projected model used by node/edge graph rendering, preserving wizard/canvas consistency.
- Dataset stage adapter (`src/ui/studio-shell/dataset/DatasetStageWizardStateAdapter.ts`) now supports persistence export/import via a thin bridge to application persistence service, and reconstructed wizard/canvas state remains synchronized through one rehydrated `WizardFlowEngine`.
- UI persistence controls in dataset stage authoring remain bounded to adapter-level save/reload actions; persistence mechanics stay outside React component business logic.

## Direction 5 UI extension update: Data Studio preparation wizard framework + stage rendering (stories 18.3-18.4)

- Data Studio now has a dedicated renderer adapter seam in `src/ui/studio-shell/data/DataStudioPreparationWizardStateAdapter.ts` over the application wizard engine (`src/application/data-studio/DataStudioPreparationWizard.ts`), keeping navigation/state/validation orchestration out of React components.
- A new stage-based authoring surface now renders in Data Studio via `src/ui/components/assets/DataStudioPreparationWizardPanel.tsx`:
  - metadata-driven stage navigation/progress rendering,
  - dynamic stage body rendering (stage-id keyed renderers + fallback renderer),
  - conditional/optional stage availability behavior from wizard snapshots,
  - simple/advanced presentation mode toggles,
  - wizard-to-canvas handoff summary from canonical authoring graph projection.
- Data Studio now includes toolbar alignment through shared shell toolbar contracts in `DatasetStudioRegistration` (`save-draft`, `run-validation`, `refresh-snapshot`) rather than bespoke per-panel toolbar logic.
- Stage progress status contracts are now shared through `src/ui/studio-shell/wizard/WizardStageContracts.ts` so stage-based wizard surfaces can reuse one status vocabulary (`current/completed/skipped/pending/disabled`) without dataset-specific type coupling.
- Data Studio node-palette behavior now uses a left-drawer pattern aligned with Workflow Canvas semantics (search + stage-focused selection), but mapped to Data Studio stage/assets context instead of workflow trigger/input/step/output node semantics.

## Direction 5 UI extension update: Data Studio intent templates + progressive disclosure (stories 18.5-18.6)

- Data Studio preparation now initializes from an intent-based template registry (`src/application/data-studio/DataStudioPreparationTemplates.ts`) with built-in ELT, analytics, document, and image templates.
- Template contracts are explicit and inspectable (id/version/intent/stage defaults/default asset-group bindings/conditional evaluators/field-visibility overrides), and template instantiation produces validated unified-preparation assets through existing stage/pipeline seams.
- Wizard initialization now supports template selection/reselection through the existing state adapter seam (`DataStudioPreparationWizard` + `DataStudioPreparationWizardStateAdapter`) without bypassing the canonical preparation asset model.
- Progressive disclosure is now metadata-driven at stage and field level:
  - stage availability still honors simple/advanced visibility + activation conditions,
  - field visibility uses descriptor metadata with simple/advanced flags, template targeting, and prior-input dependency conditions.
- Wizard-to-canvas compatibility is preserved: simplified wizard views hide complexity, but canonical stage/asset graph state remains available in the underlying unified-preparation definition and handoff projection.

## Direction 5 UI extension update: Data Studio persistent pipeline state + prepared storage integration (stories 18.7-18.8)

- Data Studio wizard state now supports export/import as a canonical persistent pipeline-state document through `src/application/data-studio/DataStudioPipelineState.ts` and `DataStudioPreparationWizard` state methods (`exportPipelineState`, `importPipelineState`), including stage state, asset-group bindings, transitions, navigation/progression metadata, and wizard/canvas compatibility projection hooks.
- Renderer adapter and panel wiring now consume that persistent contract (`DataStudioPreparationWizardStateAdapter`) and persist/reload authoring state via local storage (`DataStudioPreparationWizardPanel`), keeping wizard interactions aligned with non-UI-only draft/session behavior.
- Prepared output storage integration now has a dedicated application seam in `src/application/dataset-studio/PreparedStorageStageService.ts` and stage contracts in `StageIntegrationContracts.ts` (`PreparedStorageStageOutput`), with explicit prepared dataset identity/version, storage target/reference, upstream linkage, and lineage capture suitable for reuse across registry/canvas/read-model surfaces.

## Direction 5 UI extension update: Data Studio lineage/reuse + wizard-canvas handoff (stories 18.9-18.10)

- Data Studio prepared dataset lineage/reuse is now structured through explicit contracts in `src/domain/dataset-studio/PreparedDatasetLineage.ts` and application orchestration in `src/application/data-studio/DataStudioLineageAndReuseService.ts` (upstream source/asset/pipeline references, stage structure/dependencies, preparation context, and reusable prepared-dataset references).
- Persistent Data Studio pipeline state now carries first-class prepared lineage + reuse records (`preparedDatasetLineage`, `preparedDatasetReuse`) in `src/application/data-studio/DataStudioPipelineState.ts` rather than freeform provenance metadata.
- Prepared storage output contracts now include stage-structure and preparation-context lineage fields (`src/application/dataset-studio/StageIntegrationContracts.ts`, `PreparedStorageStageService.ts`) so prepared outputs remain inspectable and reusable across downstream systems.
- Wizard-to-Canvas handoff now projects stage-aware canvas metadata through `src/application/data-studio/DataStudioWizardCanvasProjectionService.ts` and `DataStudioPreparationWizardStateAdapter.toCanvasProjection()`, while preserving one shared underlying authoring graph from the wizard state.
- Data Studio authoring UI now exposes explicit Wizard/Canvas mode switching in `src/ui/components/assets/DataStudioPreparationWizardPanel.tsx` with a canvas projection surface (`DataStudioPreparationCanvasReactFlow.tsx`) over the same underlying wizard/pipeline state and stage-node palette semantics.

## Direction 5 UI extension update: Data Studio reusable stage UX + advanced editing entry points (stories 18.11-18.12)

- Data Studio stage authoring now uses reusable stage UX components in `src/ui/components/assets/data-studio/DataStudioStageUxComponents.tsx` (stage metadata/status surface, advanced editing actions, internals panel, and stage-aware node palette drawer) instead of one large panel-local implementation.
- Wizard-mode stage configuration now renders through those reusable shells while preserving progressive disclosure (`simple` vs `advanced`) and canonical stage updates through `DataStudioPreparationWizardStateAdapter`.
- Advanced entry points are now explicit and stateful (`Inspect internals`, `Edit in Canvas`): wizard- and stage-level actions are wired to shared wizard/canvas state in `DataStudioPreparationWizardPanel.tsx`, with stage-specific canvas focus and internals inspection backed by real authoring-graph projection data.
- Stage-level internals are now adapter-owned read models (`findCanvasNodeIdForStage`, `getStageInternals` on `DataStudioPreparationWizardStateAdapter`) so UI rendering remains contract-driven and does not derive graph internals ad hoc.

## Direction 5 UI extension update: Data Studio validation and pipeline-run toolbar integration (stories 18.13-18.14)
- Data Studio wizard/canvas state adapter now uses canonical pipeline-validation seams for navigation/readiness (`assessPipelineValidation`, `assessExecutionReadiness`, transition guards in `goNext`/`goToStage`) instead of UI-local transition rules.
- Studio Shell toolbar now includes a Data Studio run action kind (`run-data-pipeline`) and routes validation/run operations through backend-authoritative Studio Shell contracts (`assessDataStudioExecutionReadiness`, `runDataStudioPipeline`) rather than client-side execution logic.
- Data Studio execution/readiness feedback remains bounded in the shared Studio Shell page surface, preserving Workflow Studio toolbar/run patterns while keeping dataset-pipeline semantics distinct.

## Direction 5 UI extension update: Data Studio pipeline save/load/versioning (story 18.15)
- Data Studio draft authoring now synchronizes canonical pipeline-state content with the shared Studio Shell draft content path (`DataStudioPreparationWizardPanel` -> `StudioShellPage` extension operations), so toolbar `Save` persists the same wizard/canvas authoring graph state that execution/readiness consume.
- Data Studio wizard initialization now prefers persisted draft content from Studio Shell snapshots (with local storage fallback), preserving load fidelity across refresh/reopen while keeping Wizard and Canvas as two views over one canonical pipeline state.
- Studio Shell backend now exposes Data Studio version-aware retrieval seams (`listDataStudioPipelines`, `loadDataStudioPipeline`) and enriches published asset-version metadata with inspectable Data Studio pipeline summaries plus serialized canonical pipeline state.
- Snapshot/version read models now include optional Data Studio pipeline version summary metadata for inspection without introducing a dedicated history UI surface.

## Direction 5 UI update: Image system component contracts + shared rendering utilities (stories 4.1.1-4.1.2)

- Image UI component seams now have explicit internal contracts in `src/ui/components/assets/image-system/ImageUiContracts.ts` covering upload panel, image viewer, parameter form, output gallery, and comparison view props/events/state/context references.
- Shared image rendering helpers now live in `src/ui/components/assets/image-system/ImageRenderingUtils.ts` with reusable metadata normalization, fit/layout sizing, placeholder behavior, loading-state/lazy-load helpers, and selection-friendly rendering checks.
- Reusable renderer primitive `ImageRenderFrame` (`src/ui/components/assets/image-system/ImageRenderFrame.tsx`) now applies these contracts/utilities as a bounded image-display surface, and existing image-heavy UI surfaces (`AssetViewer`, `DataPreviewSurface`) now reuse that shared seam instead of ad hoc image rendering branches.

## Direction 5 UI update: Image upload panel + single-image viewer (stories 4.1.3-4.1.4)

- Added reusable image-system upload and viewer components in `src/ui/components/assets/image-system`:
  - `ImageUploadPanel` supports drag/drop + file selection with validation feedback and preview-friendly local thumbnails.
  - `ImageViewer` supports single-image display with fit mode controls, bounded zoom interactions, selection state, metadata overlay, and loading/empty/error states.
- Upload validation remains contract-driven and ingestion-implementation agnostic:
  - `ImageUiContracts` now defines `ImageUploadValidationResult`, `ImageUploadValidationIssue`, and an `ImageUploadIngestionAdapter` seam.
  - `BrowserImageUploadIngestionAdapter` bridges browser `File` objects into existing ingestion policy contracts (`FileIngestionPolicyService`) for reusable pre-ingestion validation without hardwiring a specific ingestion pipeline.
- Shared rendering utilities from stories 4.1.1-4.1.2 remain the rendering foundation:
  - `ImageViewer` composes `ImageRenderFrame` + metadata normalization/selection helpers.
  - Upload/viewer exports are surfaced through the same `image-system/index.ts` barrel for reuse across system result/history/comparison/gallery/detail surfaces.

## Direction 5 UI update: Image parameter form + output gallery (stories 4.1.5-4.1.6)

- Added a reusable schema-driven image parameter form component in `src/ui/components/assets/image-system/ImageParameterForm.tsx` that renders from shared internal parameter contracts (`ImageParameterDefinition`) rather than hardcoded workflow-engine forms.
- `ImageParameterForm` supports text/number/boolean/select/range controls, default values, required/optional semantics, bounded validation feedback, and change events that include both value snapshots and validation issues.
- Added a bounded adapter seam in `src/ui/components/assets/image-system/ImageParameterMappers.ts` (`mapAssetContractParametersToImageParameters`) so shared asset-contract parameter descriptors can be projected into UI-friendly form definitions without coupling to any single workflow runtime/library schema.
- Added a reusable output gallery component in `src/ui/components/assets/image-system/ImageOutputGallery.tsx` with:
  - shared image rendering via `ImageRenderFrame`,
  - selection state + selection change events,
  - item-open events,
  - loading/empty/error states,
  - bounded paging (`pageSize`) for incremental display,
  - optional dataset context display for dataset-bound usage.
- Updated `src/ui/components/assets/image-system/index.ts` to export parameter-form/gallery/mapper seams together with upload/viewer components for reuse in future output datasets, result/history views, and comparison flows.

## Direction 5 UI update: Image comparison view + state integration (stories 4.1.7-4.1.8)

- Added a reusable comparison surface (`src/ui/components/assets/image-system/ImageComparisonView.tsx`) with bounded side-by-side and overlay modes, internal image view-model contracts, synchronized zoom/pan interactions, selection/focus behavior, and explicit loading/empty/error state rendering.
- Added a reusable synchronized viewport hook (`src/ui/components/assets/image-system/useSynchronizedImageViewport.ts`) so comparison and future image surfaces can share one zoom/pan state seam instead of per-component interaction logic.
- Added explicit state integration/mapping seams in `src/ui/components/assets/image-system/ImageSystemStateIntegration.ts` so selected image, image collections, parameter values, dataset/system refs, and interaction/loading/error component state can be propagated coherently into upload/viewer/parameter/gallery/comparison component props without introducing a parallel state architecture.

## AI Loom image manipulation update: output gallery contract + dataset-backed interface composition (stories 4.4.1-4.4.2)

- Interface-asset composition guidance is now explicit for the image slice:
  - **atomic interface assets** stay bounded/reusable (`ImageOutputGallery`, output detail/viewer pane, metadata summary panel, parameter summary panel),
  - **higher-level composed interface assets** bind those atomic assets to system context, workflow/runtime context, and system-owned dataset state.
- Added a canonical output gallery data contract in `src/application/system-runtime/OutputGalleryDataContract.ts` for persisted gallery rows with:
  - image reference + dataset instance linkage,
  - workflow/run linkage,
  - optional source-image linkage,
  - timestamps,
  - generation/transform parameter summary,
  - image metadata summary,
  - tags + derived attributes.
- Added dataset integration orchestration in `src/application/system-runtime/OutputGalleryDatasetIntegrationService.ts`:
  - retrieves image outputs from system-owned dataset instances through `SystemDatasetInstanceService`,
  - maps persisted records into the new gallery contract (no ad hoc renderer-local output state),
  - preserves inspectability/paging semantics for future media/document/system interface reuse.
- Added UI adapter seam `src/ui/components/assets/image-system/ImageOutputGalleryDataAdapter.ts`:
  - maps contract-backed gallery listings into reusable image interface state/view-models,
  - keeps UI components runtime/storage agnostic while grounding output gallery display in persisted dataset-backed state.

## AI Loom image manipulation update: run history model + persisted retrieval seams (stories 4.4.3-4.4.4)

- Added canonical run-history contracts in `src/application/system-runtime/ImageRunHistoryDataContract.ts`:
  - run/workflow execution references,
  - system/workflow asset references,
  - input/output image references,
  - output dataset-instance linkage,
  - parameter summary and execution status,
  - timestamps and bounded lineage fields (`parentRunId`, trigger linkage, output grouping).
- Added storage-agnostic run-history repository seams in `src/application/system-runtime/ImageRunHistoryRepository.ts` with in-memory implementation for application-layer orchestration/tests.
- Added `src/application/system-runtime/ImageRunHistoryService.ts` retrieval APIs for System Studio interface assets:
  - list prior runs (`listRuns`) with paging,
  - fetch a run plus linked outputs (`getRunWithLinkedOutputs`) by joining persisted run history and output-gallery dataset-backed records.
- Runtime output persistence now records run-history entries through the same image-output pipeline (`src/application/workflow-studio/WorkflowRuntimeOutputPersistenceService.ts`) when a run-history service is composed:
  - no renderer-local/transient history arrays,
  - no parallel output/history model detached from dataset-backed output records.
- Added SQLite persistence adapter `src/infrastructure/filesystem/system-runtime/SqliteImageRunHistoryRepository.ts` for durable run-history storage aligned with existing repository/migration patterns.

## AI Loom image manipulation update: output gallery + run history interface assets (stories 4.4.5-4.4.6)

- Added explicit atomic image interface assets in `src/ui/components/assets/image-system` for persisted output/history rendering:
  - `ImageOutputGalleryCollection` (grid/list presentation),
  - `ImageRunHistoryList`,
  - `ImageSummaryPanels` (parameter + metadata summaries reused by gallery/history items).
- Added higher-level composed interface assets that bind atomic components to persisted internal contracts (no UI-only parallel models):
  - `ImageOutputGalleryAsset` consumes `OutputGalleryListing` via `ImageOutputGalleryDataAdapter`,
  - `ImageRunHistoryAsset` consumes `ImageRunHistoryListing` via `ImageRunHistoryDataAdapter`.
- Output gallery item rendering now surfaces persisted preview information from the dataset-backed gallery contract:
  - image preview/thumbnail,
  - timestamp,
  - workflow/run summary,
  - parameter and metadata summaries.
- Run history rendering now surfaces persisted run contract fields:
  - run status,
  - timestamp,
  - workflow summary,
  - input/output summary,
  - parameter summary.
- Styling remains aligned with shared image-surface primitives in `src/ui/styles/components/assets.css` and extends reusable class-based variants for list presentation and summary panels.

## AI Loom image manipulation update: output selection + history/output interaction composition (stories 4.4.7-4.4.8)

- Output gallery composition now supports bounded selection/inspection interactions through reusable atomic assets and composed state wiring:
  - output selection action bar (`selected`, `active result`, `prepared reuse-as-input`),
  - output detail pane with persisted metadata/parameter summaries,
  - composed gallery asset state that remains grounded in dataset-backed output records (no ad hoc UI-only output model).
- Run history list now supports explicit run selection semantics (`onRunSelected`, selected run id) while remaining reusable as an atomic list surface.
- Added a higher-level composed `ImageHistoryLinkedOutputInspectorAsset` that binds run-history selection to linked output gallery rendering using persisted run-history -> output contracts.
- Linkage reads remain system-owned data: `ImageRunHistoryService.listRunsWithLinkedOutputs` composes persisted run-history retrieval with output-gallery dataset retrieval instead of fragile renderer-local joins.
- These seams provide a direct foundation for later lineage and result/history interactions while keeping the current slice image-focused and contract-driven.

## Direction 5 UI update: Image component event contracts + style reuse alignment (stories 4.1.9-4.1.10)

- Epic 4.1 image components now emit one standardized UI event envelope (`ImageUiEvent`) with typed event names/payloads in `src/ui/components/assets/image-system/ImageUiContracts.ts`, covering upload lifecycle, image selection/deselection, parameter change/submit/reset, gallery interactions, comparison target/mode changes, and viewer interactions.
- Component-side event emission is centralized through a reusable adapter seam (`src/ui/components/assets/image-system/ImageUiEventAdapters.ts`) so upload/viewer/form/gallery/comparison components remain workflow-runtime agnostic while still exposing structured context-rich events for later trigger mapping.
- Image component styling now reuses shared image-surface primitives in `src/ui/styles/components/assets.css` (`ui-image-surface*`, `ui-image-item-card*`, `ui-image-control-group`) to reduce duplicated panel/status/item/control styling across upload panel, viewer, parameter form, output gallery, and comparison view.

## Direction 5 UI update: UI trigger event contract + workflow adapter seam (stories 4.2.1-4.2.2)

- Workflow execution now has a reusable internal UI trigger contract in `src/application/workflow-studio/UiTriggerEventContract.ts`:
  - framework-agnostic event shape (`click`/`submit`/`selection`) with explicit source/context references and structured payload support,
  - normalization + validation helpers (`createUiTriggerEvent`, `validateUiTriggerEvent`) that reject malformed timestamps and reserved framework event keys (`nativeEvent`, `target`, `currentTarget`),
  - trigger-kind mapping (`mapUiTriggerKindToWorkflowSourceKind`) aligned with existing execution trigger source kinds.
- Trigger-to-workflow translation is now bounded in `src/application/workflow-studio/WorkflowUiTriggerEventAdapter.ts`:
  - matches normalized UI events against existing workflow manual trigger plans (`userButtonClick`, `userManual`, `userInitiatedRun`) without changing workflow trigger semantics,
  - emits normalized `WorkflowExecutionTriggerEntry` records for downstream validation/execution path reuse.
- Image-system UI surfaces now use a thin adapter seam in `src/ui/components/assets/image-system/ImageUiTriggerEventAdapter.ts`:
  - translates image component events into the shared UI trigger contract for bounded use cases (button-like gallery open, parameter submit, image selection),
  - keeps React/browser event details out of workflow-facing contracts, preserving easy library/component swap paths.

## Direction 5 UI update: Trigger binding extension + declarative UI trigger config (stories 4.2.3-4.2.4)

- Trigger execution entry contracts now include explicit UI-ready trigger metadata in `src/application/workflow-studio/WorkflowTriggerExecutionEntryService.ts`:
  - existing source kinds remain unchanged (`manual-user`, `temporal`, `state-data`),
  - entries can now carry `contextReferences` and `bindingMetadata` so runtime context preserves trigger source/type/payload plus binding lineage without adding a parallel trigger model.
- Declarative UI-to-workflow binding configuration is now an asset-level contract in `src/application/contracts/ImageWorkflowUiTriggerBindingConfiguration.ts`:
  - bindings are versioned/typed/validated and reference normalized UI event kinds (`click`, `submit`, `selection`) rather than raw browser/React events,
  - selectors cover `sourceComponentId` and optional `actionId`/`eventName`, then target workflow trigger ids/types.
- Image workflow assets now include `uiTriggerBindings` beside existing input/output binding configs (`ImageToImageWorkflowAsset`, `RestyleWorkflowAsset`, `EnhanceUpscaleWorkflowAsset`, `BatchTransformWorkflowAsset`), keeping UI-trigger wiring inspectable, versionable, and reusable.
- `src/application/workflow-studio/WorkflowUiTriggerEventAdapter.ts` now consumes declarative binding configs when provided and falls back to existing manual-trigger matching when absent, preserving compatibility with prior dataset/system/manual trigger semantics.

## Direction 5 UI update: Runtime UI-event dispatch + parameter passing (stories 4.2.5-4.2.6)

- Runtime dispatch is now implemented as an application-layer seam (`src/application/workflow-studio/WorkflowUiEventRuntimeDispatcher.ts`) that consumes normalized UI events, resolves declarative UI trigger bindings, and dispatches into the existing `WorkflowStudioApplicationService.runWorkflowDraftTriggered` path without replacing the trigger/runtime pipeline.
- Dispatch remains boundary-clean and asynchronous:
  - UI event normalization stays in `UiTriggerEventContract`/UI adapters,
  - binding lookup stays in `WorkflowUiTriggerEventAdapter`,
  - runtime handoff stays in the existing workflow execution service.
- UI-derived parameter passing now maps into workflow-facing contracts (runtime parameters, form values, selected image context, dataset references) via context patching in the dispatcher, so raw React/browser event objects do not leak into workflow execution.
- Trigger payload mapping now carries both normalized UI metadata and top-level event payload fields, enabling trigger-payload input bindings to resolve business keys directly.
- Dispatcher results now return structured dispatch records and inspectable issue codes (including blocking validation codes) for invalid/missing UI-derived parameters.
- Added tests cover dispatch behavior, no-match/error outcomes, payload normalization/mapping, and invalid input handling.

## AI Loom image manipulation update: lineage mini-view + system interaction space composition (stories 4.4.9-4.4.10)

- Added a minimal persisted lineage contract for image runs in `src/application/system-runtime/ImageRunLineageDataContract.ts`.
  - Scope is intentionally bounded for this slice: input image refs -> workflow/run -> output image refs -> output dataset instance.
  - Lineage is built from persisted run-history and output-gallery relationships (`ImageRunHistoryWithOutputs`) using stable identifiers.
- `ImageRunHistoryService` now exposes `getRunLineage(...)` as a retrieval seam over persisted state rather than UI-only graph assembly.
- Added a lightweight reusable atomic interface asset `ImageLineageMiniView` (`src/ui/components/assets/image-system/ImageLineageMiniView.tsx`) that renders inspectable lineage edges/nodes without introducing a graph-library-specific domain contract.
- Extended composed image interface assets for cohesive System Studio experience:
  - `ImageHistoryLinkedOutputInspectorAsset` now includes lineage inspection for the selected persisted run/output linkage.
  - `ImageResultHistoryInteractionSpaceAsset` composes run history, output gallery selection/inspection, history->output linking, and lineage mini-view into one system interaction space.
- Composition remains contract-first and reusable:
  - atomic assets keep narrow rendering contracts,
  - higher-level composed assets bind those atomics to persisted system-owned output/run relationships.

## Direction 5 UI extension update: configurable editing-surface canvas contract (systems stories 1-2)

- The reusable canvas experience contract now supports a neutral editing-surface model (`resolveEditingModel`) and generic event callbacks (`onEditingEvent`) for node selection, create requests, movement, resize, and canvas commands.
- The shared configurable canvas renderer now includes a reusable rectangular layout-node surface (position + size + min size + resize handles + selection affordances) while remaining prop-driven and callback-driven for studio adapters.
- System Studio canvas now consumes that reusable editing contract through adapter boundaries, with local layout frame state handled at the authoring boundary and composition orchestration still owned by existing system services/components.
- Canvas command controls now render in a reusable control bar above the interactive canvas frame (instead of overlaying the frame), and command events can include a viewport snapshot so add-section actions can place new sections at the visual center of the active canvas.

## Direction 5 UI extension update: viewport-ratio framed canvas + panel asset model (systems stories 3-4)

- The reusable canvas contract now supports a bounded design-frame mode (`CanvasSurfaceDesignFrameModel`) with explicit width:height ratio/dimension configuration and bounded editing area hints, so authoring can target viewport-like proportions instead of an unbounded plane.
- Editing models can now declare coordinate-space semantics (`absolute` or `normalized`) and the shared configurable renderer scales node placement/resizing against a rendered design frame while emitting normalized coordinates for persistence when configured.
- System Studio draft parsing/serialization now persists canvas authoring metadata (`systemSpec.canvasAuthoring`) including design-frame settings and normalized panel layout bounds, so authored layout remains reusable across different rendered viewport sizes.
- Added a reusable panel asset contract layer (`PanelAssetContract`, runtime instance mapping) that models stable panel identity, page association, persisted bounds, user-facing metadata, content slots, and preview/runtime representation boundaries.
- System canvas adapter now maps authored layout nodes into reusable panel assets and runtime panel instances through shared contracts rather than studio-local ad hoc panel structures.

- Direction 5 stories 5-6 now route System Studio interface design through a dedicated adapter boundary (`SystemCanvasExperienceAdapter`) that translates page-scoped draft document state into the reusable editable canvas contract (selection, create/remove/update panel nodes, move/resize persistence, and normalized bounded-frame coordinates) without leaking system-specific behavior into shared canvas assets.
- Cleanup stories 5-6 now harden page-structure drag/resize interactions on that same reusable canvas contract (`ConfigurableCanvasSurface`) with a unified pointer-interaction session (selection vs drag vs resize), pointer-capture-safe move/resize handling, and direct persistence through existing `node.position.change` / `node.resize.change` flows so section bounds survive rerender and reload without introducing a parallel interaction model.
- Page-structure canvas improvements stories 3-4 now extend that same reusable canvas contract with an **optional snap model** (`CanvasSurfaceSnapModel`) that any canvas can opt into through `CanvasSurfaceEditingModel.snap` (axis divisions, drag/release timing, and position/size targets) without adding a second interaction stack.
- Stories 5-6 now extend that shared snap contract with release-time **bounds normalization** (`top/bottom/left/right`) so drag/resize completion snaps both position and size to nearest valid tenth-aligned bounds and persists the normalized frame through the existing selection/persistence path.
- Page-structure canvas improvements stories 7-8 now complete placement guardrails through the same reusable canvas + validation seams: overlap is tolerated only while a newly added section is in initial placement, while drag/resize release commits validate snapped normalized bounds against occupied viewport regions and reject persisted overlaps with explicit user-facing guidance.
- System Studio page-structure bounds are now interpreted as normalized **viewport occupancy intent below the page header**; runtime preview applies those saved percentages inside a header-offset viewport with consistent system spacing between sections instead of treating bounds as literal absolute coordinates.
- System Studio wizard authoring now starts with a non-technical multi-page setup step (`SystemPageSetupEditor`) and stores page heading/description definitions directly in draft content (`systemSpec.pages`) with page-scoped panel layouts (`canvasAuthoring.pageLayouts`) so each page keeps independent layout state across wizard/canvas mode switches.
- System Studio now also orchestrates embedded studio assets directly inside wizard flow:
  - the `Inputs & Outputs` step embeds Dataset Studio through `StudioAssetHostBoundary` and host-managed studio intents/events,
  - embedded Dataset Studio runs in constrained wizard mode (`embeddedVariant: "inputs-outputs"`) with standalone chrome/advanced canvasing suppressed by default,
  - Dataset draft state is persisted as shared System draft context (`systemSpec.embeddedStudios.dataset.draftContent`) so the host owns document flow and lifecycle.
- Inputs/outputs host responsibilities stay explicit:
  - System Studio remains the orchestration host and event manager,
  - embedded studios do not own routing/shell navigation/lifecycle in System Studio,
  - deeper interface JSON editing remains available as a collapsed advanced section (`SystemInterfaceEditor`) to keep default UX plain-language and goal-oriented.

## Direction 5 extension update: studio surfaces as assetized hostable boundaries (stories 1-2)

- Studio authoring surfaces now expose a reusable host contract seam in `src/ui/studio-shell/studio-assets/StudioAssetContracts.ts`:
  - `StudioAssetContract`
  - `StudioAssetDefinition`
  - `StudioHostContext`
  - `StudioSessionState`
  - explicit render modes: `full`, `embedded`, `inline`, `readonly`.
- A reusable host renderer boundary now exists in `src/ui/components/studio-shell/studio-assets/StudioAssetHostBoundary.tsx`, and checks contract-supported modes before rendering a studio surface.
- System/Workflow/Dataset studio surfaces now map through studio-specific adapter definitions in `src/ui/studio-shell/studio-assets/StudioSurfaceAssetDefinitions.tsx`, separating:
  - studio definition metadata/contracts,
  - host/rendering orchestration,
  - studio-specific adapter wiring.
- `StudioShellPage` now consumes those asset definitions through the shared host boundary instead of directly coupling to surface components, preserving standalone shell behavior while enabling embeddable studio-host usage.
- Embedded-mode behavior now suppresses standalone-oriented controls in the reusable surfaces:
  - Workflow surface hides standalone route/validation notices in non-`full` modes.
  - System and Dataset surfaces disable mode-switch chrome in non-`full` modes and keep scoped authoring content.

## Direction 5 extension update: embedded studio host rendering + event intent contract (stories 3-4)

- Studio host context now supports host-provided embedding constraints and injection seams in `src/ui/studio-shell/studio-assets/StudioAssetContracts.ts`:
  - `layout` constraints for hosted surfaces (`min/max/width/height`),
  - `documentAccess` and `injectedContext` for host-provided document/context boundaries,
  - explicit host capability projection carried into embedded rendering.
- `StudioAssetHostBoundary` now acts as a reusable embedding boundary for wizard/canvas/panel/system surfaces by:
  - enforcing mode support checks,
  - applying host sizing constraints,
  - bridging embedded events through one host-owned callback path,
  - guarding host-disallowed navigation/full-view intents by capability.
- Embedded studio events are now standardized in `src/ui/studio-shell/studio-assets/StudioEmbeddedEventContracts.ts` as host-manageable intents rather than direct routing/shell ownership:
  - open related resource requests,
  - request full studio view,
  - selection/focus changes,
  - apply/commit requests.
- Workflow/System/Dataset studio asset definitions now emit typed embedded intents through the shared host boundary, and `StudioShellPage` wires host handling through a single `onEvent` seam.
- Embedded-mode rendering remains shell-neutral: hosted surfaces do not assume top-level routing, shell lifecycle, or global navigation ownership.

## Direction 5 extension update: system wizard behavior embedding + panel studio-host content (stories 7-8)

- System Studio wizard now embeds a constrained Workflow Studio surface for **Behavior & Automation** authoring through the shared studio-asset host boundary (`StudioAssetHostBoundary` + `workflowStudioSurfaceAssetDefinition`) instead of launching a separate standalone studio route.
- Embedded Workflow Studio in that step is host-constrained (`embedded` mode, no shell chrome/routing controls), wizard-scoped, and event-routed via shared `studio.intent` contracts so System Studio remains the orchestration owner.
- System draft content now includes embedded workflow draft persistence (`systemSpec.embeddedStudios.workflow.draftContent`) to keep behavior authoring in the same system-backed document boundary as other wizard data.
- Panel asset contracts now support embedded studio-backed content (`PanelAssetContract.content`) without hardcoding studio implementations in the panel layer.
- Runtime panel rendering resolves embedded studio panels through host-provided studio-asset mappings (`SystemRuntimeInterfacePreview` `studioAssetHosts`), preserving clean boundaries:
  - panel assets define layout/content intent,
  - studio assets define embedded surface behavior,
  - host wiring resolves permissions/context/session + event handling.

## Direction 5 extension update: shared system document synchronization + guided flow polish (stories 9-10)

- System Studio now treats one system-backed draft document as the synchronization boundary for embedded authoring surfaces:
  - `systemSpec.pages` remains the source of truth for page definitions.
  - `systemSpec.canvasAuthoring.pageLayouts` remains the source of truth for panel layouts.
  - `systemSpec.sharedDocument.datasetDraftContent` and `systemSpec.sharedDocument.workflowDraftContent` now hold shared embedded Dataset/Workflow authoring state.
  - legacy `systemSpec.embeddedStudios.*.draftContent` remains mirrored for compatibility.
- Embedded Dataset and Workflow updates now synchronize through shared serializers in `SystemStudioDraftDocument` so panel-hosted embedded studio content stays aligned with the same shared document state (no parallel panel-local draft truth).
- Embedded studio host contexts now carry explicit host-provided document/context boundaries (`documentAccess`, `injectedContext`) so embedded surfaces can remain routing-neutral while still operating against shared host-owned draft context.
- Guided System Studio flow continuity was polished to reduce stitched-tool seams:
  - page copy was simplified for non-technical users,
  - duplicated in-page headings were reduced in embedded steps,
  - Inputs & Outputs readiness now reflects authored embedded data setup content in addition to explicit interface fields,
  - advanced options remain collapsed under lower-priority disclosures.

## Direction 5 extension update: narrowed System Studio responsibilities cleanup (stories 2.1.9-2.1.10)

- System Studio is now explicitly scoped to system/page structure and settings:
  - what pages/screens exist,
  - what major sections/panels exist on each page,
  - high-level navigation structure,
  - system-level defaults/settings.
- Wizard flow was narrowed to `Pages`, `Page layout`, and `Settings` in `SystemStudioDraftAuthoringBoundary`; legacy embedded data/workflow authoring steps were removed from the core System Studio flow.
- Canvas behavior was narrowed to structure editing in `SystemCanvasExperienceAdapter`; legacy composition/parameter inspector responsibilities were removed and replaced with structure-only guidance.
- Persistence remains canonical and unchanged:
  - `systemSpec.pages` for page model,
  - `systemSpec.canvasAuthoring.pageLayouts` for page canvas layout,
  - `systemSpec.settings` for navigation/system settings,
  with parse/serialize ownership still in `SystemStudioDraftDocument` and `SystemSettingsModel`.
- This keeps System Studio aligned with the intended handoff direction: panel-internal UI composition is authored through dedicated embedded panel design workflows, not directly inside System Studio.

## Direction 5 UI extension update: panel composed-asset slots + child insertion (systems stories 2.2.3-2.2.4)

- Panel assets now persist as first-class composed UI assets (`ui-composed:panel`) with explicit slot definitions, identity metadata, configuration defaults, and serialization-compatible composition payloads (`asset-composition`) in `PanelAssetContract`.
- The shared studio-asset registry now includes panel in composed-asset registration (`defaultComposedStudioUiContracts`) so panel composition flows through the existing taxonomy/discovery/validation/renderer seams.
- System Studio canvas inspector now hosts a focused Panel Design Studio (`PanelDesignStudio`) that inserts child assets through the existing library/insertion/selection pipeline (`StudioAssetLibraryPanel`, `resolveDefaultInsertionTarget`, `insertStudioAssetIntoCompositionTree`) instead of page-canvas structure commands.
- Panel Design Studio now keeps Asset Library and Asset Inspector integrated in the same embedded surface:
  - library results are contextual to the currently selected panel/child insertion target and remain bounded by existing slot + composition validation rules,
  - users can select the panel root or nested child assets from one in-panel selection context and inspect/edit them through the shared schema-driven Asset Inspector binding,
  - invalid target/no-compatible/empty-result states are explicit and non-destructive so System Studio remains structurally focused while panel internals are authored in-place.


## Direction 5 UI extension update: atomic and composed UI asset contract foundation (stories 1.1.1-1.1.2)

- Studio UI asset contracts now explicitly distinguish leaf and container assets in `src/ui/studio-shell/studio-assets/StudioAssetContracts.ts`:
  - `StudioUiAssetKinds` (`atomic` | `composed`),
  - `AtomicStudioAssetContract` with leaf-only constraints (`allowsChildren: false`) and bounded capabilities,
  - `ComposedStudioAssetContract` with explicit child-slot contracts and composition rules.
- Shared contract metadata now includes reusable authoring/runtime descriptors for both kinds:
  - metadata (`displayName`, `description`, tags),
  - props schema descriptor (`schemaId`, `schemaVersion`),
  - rendering resolution descriptor (`react` + `definition-render`),
  - persistence descriptor (`documentType`, JSON serialization).
- Reusable atomic UI primitive contracts now exist in `src/ui/studio-shell/studio-assets/StudioUiPrimitiveAssetContracts.ts` for leaf families (`text-input`, `number-input`, `toggle`, `button`, `viewer`) so future interface assets can reuse one contract shape without creating a second taxonomy.
- Existing studio surface assets are now explicitly composed contracts in `src/ui/studio-shell/studio-assets/StudioSurfaceAssetDefinitions.tsx`, with slot/composition rules that support nested embeddable studio usage through existing host boundaries.
- Studio asset definition discovery now includes shared listing/lookup helpers (`studioSurfaceAssetDefinitions`, `resolveStudioSurfaceAssetDefinitionById`, `listStudioSurfaceAssetDefinitionsByKind`) so registration/discovery flows can resolve contracts by identity and kind.

## Direction 5 UI extension update: composition validation + serialization model (stories 1.1.7-1.1.8)

- Studio asset composition now has one shared validation/serialization seam in `src/ui/studio-shell/studio-assets/StudioAssetComposition.ts` rather than per-surface ad hoc checks.
- Validation is registry-backed and taxonomy-aware across atomic/composed/system-page contracts:
  - atomic assets fail when any child slot/region payload is present,
  - composed assets validate declared slots, allowed child kinds/types/categories, required-slot presence, and slot cardinality,
  - system-page assets validate declared regions, required-region presence, allowed child kinds/types/categories, and region cardinality.
- Invalid nesting is explicitly denied through the same rules (for example composed assets cannot host `system-page` children unless their own contract allows it).
- `StudioAssetRegistry` now integrates this seam directly (`validateCompositionTree`, `serializeCompositionTree`, `deserializeCompositionTree`) so future studio surfaces/design tools can reuse one registry-authoritative flow.
- Composition persistence now uses a versioned document shape (`schemaVersion=1.0.0`) carrying node identity, asset/registry identity, config payloads, metadata references, and recursive slot/region child relationships.

## Direction 5 UI extension update: System page-canvas layout behavior + settings model (stories 2.1.5-2.1.6)

- System Studio page-canvas authoring now preserves high-level section placement metadata in page layouts (`panel.regionId`) so sections can be intentionally assigned to page regions while still using the existing panel/system asset taxonomy.
- Page-canvas interactions now support quick layout allocation presets (compact/balanced/featured) in addition to drag/resize, and all panel bounds are normalized/clamped within the bounded design frame before persistence.
- The persisted page layout source of truth remains unchanged (`systemSpec.canvasAuthoring.pageLayouts`) and still round-trips through `SystemStudioDraftDocument` parse/serialize seams (no parallel persistence model).
- System Studio now includes an explicit top-level settings model at `systemSpec.settings` for user-facing runtime/system concerns:
  - system name/description
  - default landing page
  - high-level navigation mode
  - theme/design-token hooks
  - global runtime behavior toggles.
- System Studio settings now also persist a normalized navigation structure model (`systemSpec.settings.navigation.structure.items`) aligned to `systemSpec.pages` ordering:
  - ordered page participation entries,
  - user-facing navigation labels,
  - visibility/inclusion controls,
  - grouping and placement hints (`group`, `placement`) for future runtime shell rendering.
- Navigation structure reconciliation and default landing-page validation are now document-authoritative in the same parse/serialize seams (`SystemStudioDraftDocument` + `SystemSettingsModel`), so deleted/invalid page references fall back gracefully to the first valid visible page.
- The Settings step now foregrounds this non-technical settings UI and keeps technical parameter editing in a collapsed advanced section, preserving clear separation between page structure authoring, panel-internal authoring, and system-level runtime settings.

## Direction 5 UI extension update: Schema Studio canvas + entity authoring slice (stories 3.1.5-3.1.6)

- Schema Studio now has a dedicated composed studio surface contract (`schema-studio`) in `src/ui/studio-shell/studio-assets/StudioSurfaceAssetDefinitions.tsx`, aligned to existing studio-shell renderer, host-context, and persistence contracts (`schema-draft-json` over JSON serialization).
- Authoring now runs through a dedicated Schema Studio boundary (`src/ui/components/studio-shell/schema/SchemaStudioDraftAuthoringBoundary.tsx`) instead of falling back to workflow metaphors:
  - schema-level context is presented as a schema canvas,
  - entities/tables render as selectable modeling units,
  - relationships render as a bounded summary/placeholder for future edge-authoring flows.
- Entity create/edit flows now use canonical schema-domain helpers (`src/domain/schema-studio/SchemaStudioDomain.ts`) rather than ad hoc UI-only state:
  - `createEmptySchemaAssetDocument`,
  - `addSchemaEntityToDocument`,
  - `updateSchemaEntityInDocument`.
- Schema entity updates persist through existing studio-shell draft content mutation (`onChangeContent`) and embedded-intent event signaling (`studio.intent` apply/selection), preserving existing host-owned save/validation/session infrastructure.
- Schema Studio is now routed and registered as a first-class atomic studio (`src/ui/studio-shell/registrations/SchemaStudioRegistration.ts`, `src/ui/pages/SchemaStudioPage.tsx`, route mapping updates), keeping taxonomy and registration patterns aligned with existing model/dataset/tool studios.

## Direction 5 UI extension update: Schema Studio relationships + field inspector slice (stories 3.1.7-3.1.8)

- Schema Studio authoring now includes first-pass relationship creation UX in the existing schema boundary (`src/ui/components/studio-shell/schema/SchemaStudioDraftAuthoringBoundary.tsx`) without introducing a parallel graph editor stack.
- Relationship creation persists directly through canonical schema-domain helpers (`addSchemaRelationshipToDocument`) and existing draft mutation flow (`onChangeContent` + schema serialization), so links are validated and saved as schema asset structure instead of UI-local state.
- Relationship authoring supports source/target table selection, optional source/target field binding, cardinality hints, optional labels/descriptions, and an optional technical `type` in a secondary advanced-details area to keep primary UI language approachable.
- Duplicate/incomplete/invalid relationship definitions are denied through shared domain validation (missing entities/fields, duplicate relationship shape) with user-facing error messaging in the authoring panel.
- Schema Studio now includes a field inspector panel bound to the currently selected table:
  - field list + selection,
  - add/remove actions,
  - edit controls for name/key/type/required/default/description.
- Field edits persist through canonical schema-domain helpers (`addSchemaFieldToEntityInDocument`, `updateSchemaFieldInEntityInDocument`, `removeSchemaFieldFromEntityInDocument`) and the same host-owned draft persistence/event infrastructure.
- Removing a field clears dangling relationship field refs for relationships targeting that field, preserving document validity while keeping relationship records intact for follow-up edits.
- Scope remains intentionally bounded to schema-structure authoring: pipelines/execution semantics remain outside Schema Studio and continue to be authored in their dedicated studios.

## Direction 5 UI extension update: Schema Studio persistence hardening + validation feedback (stories 3.1.9-3.1.10)

- Schema Studio editing remains bound to the host-owned draft content string (`content` + `onChangeContent`) and canonical schema-domain serialization (`serializeSchemaAssetDocument`), so table/field/relationship edits mutate the persisted schema asset draft payload directly instead of maintaining a parallel transient model.
- Schema draft loading now supports a bounded safe-edit parse path (`deserializeSchemaAssetDocumentForEditing`) that keeps authoring available for malformed/legacy draft payloads by normalizing recoverable sections and surfacing a clear warning state instead of hard-failing the editor.
- Authoring UI now surfaces lightweight schema validation feedback (`validateSchemaAssetDocument`) in-context for creation/edit/inspector flows, including:
  - duplicate table names,
  - duplicate field names within a table,
  - missing table/field relationship references,
  - obviously incomplete relationship bindings.
- Validation intentionally stays structural and persistence-aligned: it does not attempt full database constraint semantics, query-plan checks, or pipeline execution validation.
- Responsibility boundaries remain explicit:
  - **Schema Studio** owns structural schema authoring (tables, fields, relationships, canvas-oriented structure metadata).
  - **Pipeline Studio/Data Studio** own transformation/execution authoring and runtime validation semantics.

## Direction 5 extension update: Data Studio schema authoring separation + Schema Studio handoff entry (stories 3.2.1-3.2.2)

- Data Studio now treats pipeline authoring and schema authoring as separate workflows:
  - Data Studio wizard/canvas surfaces remain focused on ingestion, mapping, transformation, enrichment, and execution-readiness concerns.
  - Schema definition and structural modeling are no longer presented as pipeline-stage authoring responsibilities inside Data Studio.
- Dataset Studio default draft content now initializes from canonical Data Studio pipeline-state serialization (via `DataStudioPreparationWizardStateAdapter`) rather than legacy schema-shaped draft placeholders.
- Data Studio now includes a first-class Schema Studio entry panel in the primary wizard surface that supports:
  - creating a new schema via existing inline studio-launch patterns,
  - opening existing schema assets discovered through the shared registry/query path,
  - user-facing guidance that clarifies structural schema work vs execution-oriented data-pipeline work.
- Entry/transition behavior reuses existing shared seams (`InlineAssetCreationService`, `StudioEntryService`, registry semantic-role filtering) rather than adding ad hoc studio-routing state.


## Direction 5 UI update: Dataset Pipeline Studio responsibility focus + schema linkage foundation (stories 3.2.3-3.2.4)

- Dataset Pipeline Studio now renders through a dedicated dataset-pipeline authoring boundary (`DatasetPipelineStudioDraftAuthoringBoundary`) instead of falling back to workflow authoring surfaces.
- The pipeline authoring surface now emphasizes ingestion/transformation/execution flow setup and explicitly positions schema authoring in Schema Studio.
- Pipeline draft content now has a formalized schema-linkage shape (`datasetPipelineSpec.schemas.input|output`) for referencing input/output schemas via asset references and optional inline structural definitions.
- Schema linkage remains persistence-aligned with existing Studio Shell draft/version flows by staying inside canonical draft content serialization rather than introducing local-only UI state.
- Unresolved or invalid schema links are surfaced as non-blocking authoring warnings, preserving forward compatibility for future schema-aware mapping/validation enhancements.

## Direction 5 update: Data-definition compatibility cleanup + studio responsibility documentation (stories 3.2.9-3.2.10)

- Data Studio now includes bounded load-time compatibility for legacy persisted draft shapes:
  - `DataStudioPreparationWizard.importPipelineState` first attempts canonical `DataStudioPipelineState` deserialization,
  - if deserialization fails, legacy `datasetSpec` or mixed `datasetPipelineSpec` payloads are translated in place into current stage options (source reference/kind, output target, schema-link hints) instead of hard-failing authoring.
- Dataset Pipeline Studio draft parsing now includes a lightweight migration seam in `deserializeDatasetPipelineAssetDocumentForEditing`:
  - legacy `datasetSpec` payloads are translated into `datasetPipelineSpec`,
  - legacy `datasetPipelineSpec.schema` is normalized into `datasetPipelineSpec.schemas.input.inlineDefinition`,
  - recoverable migrations surface concise warning text in the authoring panel instead of silently dropping structure.
- Responsibility split is now explicit and stable:
  - **Data Studio** is the high-level workspace and organizer across data authoring flows,
  - **Schema Studio** is dedicated to structural schema definition and editing,
  - **Pipeline Studio** is dedicated to ingestion/mapping/transformation/enrichment/execution flow authoring and schema linkage.
- Schema references remain first-class links in pipeline definitions (`datasetPipelineSpec.schemas` and `datasetPipelineSpec.sources[].schema`) so structural assets and execution assets stay distinct while still connected.

- Stories 5–6 now make Data Studio’s dataset authoring path asset-native under the Studio Shell: `DatasetStudioDraftAuthoringBoundary` owns the canonical `DataStudioPreparationWizardStateAdapter` state, renders wizard/canvas surfaces directly from that shared state, and no longer mounts the legacy nested intermediary authoring panels in active runtime.
- Legacy Data Studio intermediary panel implementations were disconnected from active runtime and have now been deleted as part of cleanup.

## AI Loom image manipulation update: runtime editor page asset + schema-driven settings surface (stories 7.1-7.2)

- System runtime preview now supports a dedicated image editor runtime page asset (`src/ui/studio-shell/studio-assets/ImageManipulationEditorPageAsset.tsx`) bound to the image manipulation template page binding id (`system-page:image-manipulation`).
- The build-template seed now includes a default page panel wired to that embedded runtime page asset (`src/application/system-studio/SystemBuildTemplateCatalog.ts`), so image manipulation systems open with a ready-to-run editor surface by default.
- The runtime editor UI is now rendered through a dedicated panel (`src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`) with the required layout:
  - left: schema-driven settings editor,
  - right top: image preview,
  - right bottom: horizontal results gallery strip.
- Settings are rendered from the existing Comfy image manipulation property schema (`ComfyImageManipulationPropertySchema`) through a reusable editor component (`src/ui/components/assets/image-system/ComfyImageManipulationPropertyEditor.tsx`) with grouped non-technical sections and collapsed advanced controls.

## AI Loom image manipulation update: primary preview + gallery slider runtime panels (stories 7.3-7.4)

- The runtime editor now uses reusable image-system primitives for right-side runtime browsing:
  - `src/ui/components/assets/image-system/ImagePreviewPanel.tsx`
  - `src/ui/components/assets/image-system/ImageGallerySlider.tsx`
- `ImageManipulationRuntimeEditorPanel` now loads dataset-bound image collections for:
  - source input dataset (`input-image-dataset`)
  - generated output dataset (`output-image-dataset`)
  - optional FaceID/reference dataset (`reference-image-dataset`)
- Preview selection is now explicit and context-aware (`source` / `output` / `reference`) and updates from runtime page selection state without exposing filesystem paths or storage internals.
- Empty/loading/unavailable/error states are now explicit in both preview and gallery surfaces, keeping runtime UX user-facing while preserving storage-instance/dataset-instance boundaries.

## AI Loom image manipulation update: runtime state UX + advanced disclosure polish (stories 7.7-7.8)

- Runtime editor state handling now uses one reusable status surface component (`ImageStatusNotice`) across page-level and panel-level UX for loading, empty, warning, success, and failure states.
- `ImageManipulationRuntimeEditorPanel` now renders explicit user-facing state handling for:
  - initial runtime hydration/loading,
  - dataset/image collection loading failures,
  - no-source-photo and no-selection empty states,
  - run-readiness validation summaries that explain why run is blocked,
  - execution status and failure messaging with diagnostics kept in collapsed advanced details.
- Dataset/image retrieval errors are surfaced with plain-language product copy in default UI; technical diagnostics remain in separate advanced disclosure areas where already supported.
- `ImagePreviewPanel` and `ImageGallerySlider` now share consistent state rendering language/patterns through the reusable status component instead of one-off inline messages.
- Advanced settings disclosure in `ComfyImageManipulationPropertyEditor` remains schema-driven:
  - advanced-field placement is derived from schema metadata/grouping (including model controls and explicitly tagged advanced fields),
  - advanced controls are collapsed near the bottom by default with user-facing section labels (`Model choices`, `Generation tuning`, `Identity timing and model controls`),
  - primary beginner-facing controls remain prominent in top sections.

## AI Loom image manipulation update: runtime-ready default initialization + UI coverage hardening (stories 7.9-7.10)

- Reference-image template draft creation now provisions all runtime image-editor dataset bindings by default (`input-image-dataset`, `output-image-dataset`, `reference-image-dataset`) through existing storage-instance/dataset-instance seams, so first-load runtime reads no longer depend on user-triggered setup.
- The image editor runtime page asset (`system-page:image-manipulation`) is now part of the default studio-asset registry path, keeping page-asset lookup/renderer resolution aligned with shared registry contracts instead of panel-local wiring only.
- UI/runtime coverage now includes:
  - default image-editor runtime composition from seeded build-template content,
  - page-asset registry/renderer resolution assertions,
  - runtime editor default-state assertions (property editor defaults, preview/gallery empty-ready states, run-action gating cues),
  - run lifecycle transition assertions through the reusable execution-flow service.

## AI Loom image manipulation update: runtime window shell rendering flow (stories 8.1-8.2)

- App layout now supports a contract-driven runtime-window host mode when `runtimeWindowLaunch` is present in query params.
- Runtime window rendering resolves a normalized launch contract and routes to registered runtime page assets (initially the image manipulation page binding) without reopening full Studio Shell authoring chrome.
- System runtime panel launch UX now composes launch requests through the shared resolver and sends them via desktop bridge operation (`launchRuntimeWindow`) instead of directly constructing host/window details in UI components.

## AI Loom image manipulation update: runtime hydration + dataset/selection binding (stories 8.3-8.4)

- Runtime-window rendering now hydrates a normalized runtime state model from launch contract + studio snapshot draft serialization via a dedicated runtime hydration service (`src/ui/runtime/SystemRuntimeWindowHydrationService.ts`), instead of page-local ad hoc initialization.
- Hydration now carries resolved system/workflow/page identities, schema default config, execution metadata, dataset/storage logical references, and normalized initial selection state, with explicit warning/error issue projection for invalid/incomplete payloads.
- Image runtime dataset/selection wiring now flows through a dedicated binding seam (`src/ui/runtime/ImageManipulationRuntimeDatasetBindingService.ts`) that resolves role bindings (input/output/reference), reconciles selections against loaded dataset windows, and maintains a serializable selection snapshot suitable for future persistence/restore.
- Runtime editor page behavior now consumes hydrated dataset/workflow/system references and avoids hardcoded ownership assumptions so shared storage-instance-backed datasets and embedded-subsystem launches remain compatible with the existing host/application contracts.

## AI Loom image manipulation update: runtime-window backend run wiring + session persistence (stories 8.5-8.6)

- Runtime-window run mapping now routes through an explicit mapper seam (`src/ui/runtime/ImageManipulationRuntimeExecutionRequestMapper.ts`) so the UI submits resolved config/selection + logical dataset/storage references on the same backend execution start path (`startSystemExecution`) and shared output persistence/refresh flow.
- Run-request preparation now enforces normalized preflight failures for missing required runtime selections (source dataset/input image and FaceID reference when enabled) before backend launch, while preserving default-template runnability with no extra setup.
- Runtime-window execution request construction is now shared in a non-component seam (`src/ui/runtime/ReferenceImageExecutionRequestBuilder.ts`) so runtime panels do not own workflow-input mapping internals.
- Runtime-window session overrides now persist through a dedicated persistence seam (`src/ui/runtime/SystemRuntimeWindowSessionPersistenceService.ts`) that stores serializable logical state only (property config/preset, selection snapshot, preview/gallery focus, advanced-panel disclosure, launch/session/page context references).
- Runtime editor startup now layers persisted runtime-window overrides on top of hydrated defaults and continues to refresh output collections in-place after execution, so reopen/restore keeps in-progress context without raw-path leakage.

## AI Loom image manipulation update: runtime-window reopen/restore orchestration + lifecycle tests (stories 8.7-8.8)

- Runtime-window restore now uses a single orchestrator (`src/ui/runtime/SystemRuntimeWindowRestoreService.ts`) that composes launch contract input, hydration, persisted-session lookup, and stale-reference normalization.
- Runtime host boot (`SystemRuntimeWindowHost`) now surfaces restore issues with explicit source tags (`launch`, `hydration`, `session-restore`) while preserving non-fatal startup continuity.
- Runtime-window relaunch from System Runtime Run panel now routes through reopen-aware launch preparation (`buildReopenRequest`) so existing runtime session identity and persisted logical runtime state are carried forward on relaunch.
- `ImageManipulationRuntimeEditorPanel` now accepts host-resolved restored session context while keeping the established session persistence seam for ongoing updates.
- Runtime lifecycle tests now cover launch payload normalization, hydration defaults + dataset/storage binding establishment, reopen restore success, stale-reference degradation, and invalid launch-query normalization (`src/ui/runtime/tests/SystemRuntimeWindowLifecycle.test.ts`).

## Workspace administration UI update (story 3.4.2)

- Added a dedicated authenticated renderer surface for workspace administration in `src/ui/pages/WorkspaceAdministrationPage.tsx`.
- Renderer integration remains thin and contract-driven:
  - transport client seam in `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`,
  - page-facing service seam in `src/ui/services/WorkspaceAdministrationService.ts`,
  - no UI-side tenancy business-rule reimplementation beyond basic form-shape validation.
- Route/navigation integration now includes `ROUTE_PATHS.workspaceAdmin` (`/settings/workspaces`) with settings-entry discoverability:
  - `src/ui/routes/RouteConfig.ts`,
  - `src/ui/routes/AppRouter.tsx`,
  - `src/ui/pages/SettingsPage.tsx`.

## Workspace thin-client administration UI update (story 3.4.3)

- Added focused thin-client workspace surfaces for web/mobile contexts:
  - `src/ui/pages/WorkspaceMembershipThinClientPage.tsx`
  - `src/ui/pages/WorkspaceInvitationOnboardingPage.tsx`
- Added web-specific route helper in `src/ui/web/workspaces/WorkspaceThinClientRoutes.ts` for invite acceptance link path composition.
- Renderer integration remains thin and contract-driven over existing backend endpoints:
  - workspace client/service seams in `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts` and `src/ui/services/WorkspaceAdministrationService.ts` now include invitation onboarding acceptance.
- Thin-client route coverage now includes:
  - `ROUTE_PATHS.workspaceThinMembership` (`/settings/workspaces/thin`) for compact membership/invitation management,
  - `ROUTE_PATHS.workspaceInvitationAccept` (`/workspaces/:workspaceId/invitations/:invitationToken/accept`) for invite acceptance onboarding.
- Responsive surface behavior for these pages is implemented in shared app styles (`src/ui/styles/app.css`) using dedicated thin-page layout classes to keep operations usable on smaller screens.

## Authorization sharing management UI update (story 4.4.2)

- Added shared renderer authorization-management transport + service seams:
  - `src/ui/shared/authorization/AuthorizationManagementClient.ts`
  - `src/ui/services/AuthorizationManagementService.ts`
- Added reusable sharing/visibility management UI in `src/ui/components/authorization/AuthorizationSharingManagementPanel.tsx` that now supports:
  - loading current access state,
  - updating visibility and sharing policy,
  - listing/revoking current sharing grants,
  - adding per-user/per-workspace-role/per-workspace/public grants,
  - rendering effective permission feedback and validation errors from backend API responses.
- Added dedicated desktop and thin-client sharing management pages:
  - `src/ui/pages/AuthorizationSharingManagementPage.tsx` at `ROUTE_PATHS.authorizationSharing` (`/settings/sharing`)
  - `src/ui/pages/AuthorizationSharingThinClientPage.tsx` at `ROUTE_PATHS.authorizationSharingThin` (`/settings/sharing/thin`)
- Added web route helpers in `src/ui/web/authorization/AuthorizationSharingRoutes.ts` to build deep links into desktop/thin sharing surfaces.
- Added representative resource-surface integration in `src/ui/pages/AssetDetailPage.tsx` so asset detail now exposes working sharing and visibility controls backed by authorization management APIs.

## Authorization access review inspection UI update (story 4.4.3)

- `AuthorizationSharingManagementPanel` now supports optional target-actor effective-access inspection through a dedicated inspected-actor user-id input.
- Access-state read results now expose and display both inspector and inspected actor identities to make review context explicit in admin/user workflows.
- Permission feedback now surfaces concise contribution summaries per permission (owner, role, direct grant, sharing, visibility) backed by structured server explanation fields.
- The renderer authorization client now forwards `inspectedActorUserIdentityId` on `/access-state` requests, preserving end-to-end inspection context between UI and backend API.

## Authorization reporting UI update (story 4.4.6)

- Added an authenticated admin reporting page: `src/ui/pages/AuthorizationReportingPage.tsx`.
- Renderer seams stay contract-driven and backend-authoritative:
  - reporting read support in `src/ui/shared/authorization/AuthorizationManagementClient.ts`,
  - service passthrough in `src/ui/services/AuthorizationManagementService.ts`,
  - no UI-side policy evaluation or persistence lookups.
- Route/settings integration now includes:
  - `ROUTE_PATHS.authorizationReporting` (`/settings/sharing/reporting`) in `src/ui/routes/RouteConfig.ts`,
  - route wiring in `src/ui/routes/AppRouter.tsx`,
  - settings quick-link in `src/ui/pages/SettingsPage.tsx`.
- The reporting surface renders concrete admin tables for:
  - role assignments,
  - unusual visibility/sharing-policy patterns,
  - recent sharing mutations.

## Trusted node inventory UI update (story 5.3.5)

- Added authenticated admin node inventory inspection page:
  - `src/ui/pages/NodeInventoryPage.tsx`
  - route: `ROUTE_PATHS.nodeInventory` -> `/settings/node-inventory`
  - settings quick-link integration in `src/ui/pages/SettingsPage.tsx`.
- Renderer integration remains thin and backend-contract driven:
  - transport client seam: `src/ui/shared/nodes/NodeInventoryClient.ts`
  - page-facing service seam: `src/ui/services/NodeInventoryService.ts`
  - contracts consumed as-is from inventory list/detail endpoints (`/api/v1/nodes/inventory`, `/api/v1/nodes/inventory/:nodeId`).
- Inventory UI behavior:
  - filter controls for trust/presence/approval/enrollment/node-type/capability/deployment-tag/last-seen range,
  - explicit pending/active/offline/revoked state labels via badge treatment in list/detail,
  - explicit loading, empty, and error states without placeholder node data.

## Asset workflow UI integration update (story 10.3.4)

- Added a shared renderer asset workflow transport seam in `src/ui/shared/assets/AssetWorkflowClient.ts` and a page-facing adapter in `src/ui/services/AssetWorkflowService.ts`.
- `/assets` now renders a contract-driven logical asset workflow page (`src/ui/pages/AssetsPage.tsx`) instead of redirect-only behavior.
- The page is intentionally bounded and backend-authoritative, covering:
  - list/query,
  - detail lookup,
  - upload initiation,
  - download authorization,
  - preview resolution.
- UI state remains logical-id focused and path-free for this workflow (`workspaceId`, `assetId`, `storageInstanceId`, `versionId`), aligned with protected asset governance boundaries.

## Multi-surface shell primitives update (story 15.1.2)

- Shared shell primitives and responsive region containers now live in src/ui/shared/components/shell/SurfaceShellPrimitives.tsx and are documented in docs/architecture/multi-surface-ui-shell-primitives.md.
- Desktop and thin-client assembly wrappers now live in src/ui/desktop/shell/DesktopAdminSurfaceFrame.tsx and src/ui/web/shell/ThinClientOperationalSurfaceFrame.tsx so production pages can share layout vocabulary without duplicating host-neutral shell logic.

## Multi-surface presentation-state update (story 15.1.4)

- Shared presentation-state primitives now live in `src/ui/shared/components/presentation-state/`.
- Shared state boundaries now provide canonical handling for `loading`, `empty`, `not-found`, `disconnected`, `error`, and `permission-denied` via `SurfaceStateBoundary` and `SurfaceStatePanel`.
- API error normalization for these states is centralized via `toSurfacePresentationStateFromApiError`, aligned to shared API error semantics (`sharedCode`/`domainCode`) so converged screens do not duplicate error-to-UI mapping logic.
- Foundational converged admin pages (`NodeInventoryPage`, `StorageAdministrationPage`) now consume these shared state seams for list/detail loading and error rendering.


## Operational workspace dashboard foundation update (story 15.2.1)

- Run entry now composes a shared operational workspace dashboard foundation using shared dashboard widgets under `src/ui/shared/operations/OperationalWorkspaceDashboard.tsx` and a presenter seam in `src/ui/presenters/OperationalWorkspaceDashboardPresenter.ts`.
- Desktop and thin-client operational pages now share the same dashboard content model and widget composition while rendering through surface-specific shell wrappers:
  - `src/ui/pages/RunDesktopOperationalDashboardPage.tsx`
  - `src/ui/pages/RunThinClientOperationalDashboardPage.tsx`
- Dashboard content is API-driven from existing authoritative contracts/services (runtime queue + run inspection + execution history + trusted node inventory) and realtime status updates via `RuntimeRealtimeSubscriptionService`.
- The foundation now provides a coherent workspace-level operational entry point for queue state, recent run/output review, node availability summary, actionable alerts, and approved run initiation controls.

## Approved operational run launch update (story 15.2.4)

- `RunPage` now composes approved run launch UX through a shared panel (`src/ui/shared/operations/OperationalApprovedRunLaunchPanel.tsx`) instead of page-local JSON textarea handling.
- The shared panel provides reusable section structure for target identifiers, allowed parameter adjustments, input payload JSON, submission actions, and immediate submission-state feedback.
- Allowed parameter handling is now bounded through explicit field definitions and deterministic validation (`validateOperationalApprovedRunLaunchDraft`) before API submission, while authoritative API responses remain source-of-truth for validation/denial outcomes.
- Submission feedback now maps authoritative runtime response semantics into converged launch states (`accepted`, `validation-error`, `denied`, `failed`) through `mapRuntimeStartResponseToSubmissionState`.
- Desktop and thin-client layouts now share this same launch component using responsive form conventions (`SurfaceResponsiveFormLayout`) with surface-appropriate copy and behavior.

## Realtime operational indicators update (story 15.2.6)

- Shared operational realtime indicator components now live in `src/ui/shared/operations/OperationalRealtimeIndicators.tsx` and are reused across dashboard/run/queue surfaces.
- `RunPage` now keeps reconnect handling centralized as page-level orchestration around `RuntimeRealtimeSubscriptionService` and shared panel props, rather than panel-local websocket behavior.
- Dashboard/run/queue components now consume one consistent connection snapshot model for live vs stale marker rendering and refresh/reconnect affordances.

## Workspace management and membership administration update (story 15.3.2)

- Workspace administration and admin-lite membership pages now compose shared workspace list/detail/action panels in:
  - `src/ui/shared/workspaces/WorkspaceAdministrationPanels.tsx`
- Shared panels now provide:
  - workspace list selection composition for desktop and thin-client views,
  - workspace-scoped operational context summaries with explicit permission-denied and partial-visibility messaging,
  - membership and role administration actions through shared action descriptors (`SurfaceActionButtonStrip`, `SurfaceActionMenu`, `SurfaceActionList`) rather than page-local action branching.
- Desktop and thin-client pages now reuse the same shared membership/role components and contracts:
  - `src/ui/pages/WorkspaceAdministrationPage.tsx`
  - `src/ui/pages/WorkspaceMembershipThinClientPage.tsx`
- Added/updated renderer coverage for membership-management flow composition and capability-state rendering:
  - `src/ui/shared/workspaces/tests/WorkspaceAdministrationPanels.test.tsx`
  - `src/ui/pages/tests/WorkspaceAdministrationPage.test.tsx`
  - `src/ui/pages/tests/WorkspaceMembershipThinClientPage.test.tsx`
