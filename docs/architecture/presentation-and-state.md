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

Workflow Studio run-history list/detail follows the same boundary style: `WorkflowStudioRunHistoryPanel` renders workflow-scoped run summaries and detail sections, while data is loaded through `StudioShellService` (`listWorkflowRuns`, `getWorkflowRunDetail`) from backend-owned run-history projections instead of UI-layer repository access.
The panel now keeps disclosure bounded in that same seam: run-level summary first, expandable step-by-step inspection second, and structured diagnostics/failure-location cues rendered from backend read models rather than UI-side parsing/inference.
The same panel now also hosts rerun UX on those backend contracts: `Rerun as-is` and `Edit and rerun` both route through `StudioShellService.startWorkflowRunRerun`, start from canonical persisted execution context, and navigate to the newly created derived run detail.
Edit-and-rerun stays structured and user-facing (target/parameters/execution-metadata/property-overrides fields) rather than exposing raw log parsing or debug-only controls.
Observability entry points now also appear on adjacent workflow surfaces (persisted workflow list cards, workflow draft status, and workflow execution feedback), so run history/run detail navigation is embedded in the normal build -> run -> inspect loop rather than hidden behind one panel.
Workflow execution feedback now links directly to the current run detail and workflow run history when backend run-history persistence returns a durable run id.
Run-history rerun controls now surface explicit unsupported-state UX for non-terminal runs or missing structured historical execution input context.

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
- Phase 9.2 adds a bounded Studio Shell extension seam in the renderer (`ui/studio-shell/StudioShellExtensions.ts`) with typed `StudioRegistration` (`kind`, semantic role, allowed behavior options, defaults, shell presentation hints, slot contributions) so atomic and composite studios register through the same shell model.
- Extension composition remains typed and intentionally small (slot + title/subtitle + order + render callback); this is not a generic plugin runtime.
- Phase 9.3 now validates the initial authoring/publish vertical slice through the real renderer service boundary (`ui/services/tests/StudioShellService.integration.test.ts`), including publish and persistence reload behavior through the desktop/backend/application/repository stack.

## TODO

- The renderer composition root is effective but very large. It may eventually need sub-composition modules per feature or per bounded capability area to stay comprehensible.
- The startup logic in `AppProviders.tsx` mixes dependency provisioning with operational bootstrapping. If initialization behavior grows further, a dedicated application startup coordinator could make the architecture clearer.

- Phase 9.4 (story 2.7) now routes Model Studio through the same shell renderer (`ui/pages/ModelStudioPage.tsx` -> `StudioShellPage` with `modelStudioRegistration`) so model authoring uses shared draft/session, validation, dependency, lifecycle, and publish/version surfaces instead of a parallel page stack.
- Model-specific UI behavior is bounded to registration slot contributions (`draft-authoring`, `metadata`) and registration defaults; no model business rules were moved into renderer logic.

- Phase 9.5 (story 2.9) now routes Dataset Studio through the same shell renderer (`ui/pages/DatasetStudioPage.tsx` -> `StudioShellPage` with `datasetStudioRegistration`) so dataset authoring inherits shared draft/session, validation, dependency, lifecycle, and publish/version surfaces.
- Dataset-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots); no dataset business rules were moved into UI logic.
- Phase 9.6 (story 2.11) now routes Tool Studio through that same shell renderer (`ui/pages/ToolStudioPage.tsx` -> `StudioShellPage` with `toolStudioRegistration`) so atomic MCP/API tool authoring uses the same session/draft/validation/lifecycle/publish path.
- Tool-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) with MCP/API-oriented defaults; no tool business rules were moved into UI logic.
- Phase 9.7 (story 2.12) keeps validation projection backend-authoritative while standardizing atomic defaults: model/dataset/tool registration metadata now includes taxonomy-driven contract defaults and empty dependency defaults, and shared validation issue projection is centralized behind the backend contract.
- Phase 9.8 (story 2.15) adds a cross-atomic end-to-end consistency test (`ui/services/tests/StudioShellService.integration.test.ts`) that runs the same create -> edit -> validate -> publish -> reload flow for Model, Dataset, and Tool studios over the real shared seams (renderer service, desktop bridge, backend API, application service, SQLite persistence).
- This keeps studio UI integration truthful: atomic studios remain thin registration variants of `StudioShellPage`, and composite studios can onboard through the same registration seam without parallel page/business-rule stacks.
- Phase 9.9 (story 2.18) now routes Prompt Template Studio through the same shell renderer (`ui/pages/PromptTemplateStudioPage.tsx` -> `StudioShellPage` with `promptTemplateStudioRegistration`) so prompt-template authoring uses shared draft/session, validation, dependency, lifecycle, and publish/version surfaces.
- Prompt-template-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots), and cross-atomic shell integration coverage now includes Prompt Template Studio in `ui/services/tests/StudioShellService.integration.test.ts`.
- Phase 9.10 (stories 2.21â€“2.22) now routes Config Profile Studio through that same shell renderer (`ui/pages/ConfigProfileStudioPage.tsx` -> `StudioShellPage` with `configProfileStudioRegistration`) so config-profile authoring uses shared draft/session, validation, dependency, lifecycle, publish/version, and persistence-backed consistency seams.
- Phase 9.11 (stories 3.5â€“3.6) now routes Workflow Studio through that same shell renderer (`ui/pages/WorkflowStudioPage.tsx` -> `StudioShellPage` with `workflowStudioRegistration`) so composite workflow-orchestrator authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Workflow-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Story 4.13 promotes draft authoring as the primary shell surface: `StudioShellPage` now renders draft authoring above/outside the card grid, and shell toolbar configuration is now registration-driven (`shell.toolbar`) with optional typed actions (refresh/save/validate/workflow-mode) that execute through existing shell orchestration seams.
- Studio shell authoring now also supports optional registration-driven side drawers (`shell.drawers.left/right`) with toolbar-bound open/close toggles (left toggle rendered as the leftmost control, right toggle rendered as the rightmost control) so studio-specific authoring cards can be moved into closable side rails without creating a second shell pattern.
- Workflow Studio draft authoring now includes an explicit mode abstraction (`wizard`, `canvas`) plus a centralized renderer-side mode/draft state manager (`ui/studio-shell/workflow/WorkflowStudioModes.ts`, `WorkflowStudioModeStateStore.ts`) so mode selection and canonical workflow draft state are shared instead of mode-local.
- Workflow Studio now exposes an explicit mode switch control in the draft-authoring shell and routes mode changes through canonical Workflow Studio mode paths (wizard/canvas) so in-app and direct URL navigation stay aligned.
- Workflow Studio shell toolbar mode switching now renders as a single context-aware toggle action (`Wizard`/`Canvas`) that routes through the same mode-state + route synchronization seam.
- Workflow Studio shell `Nodes` drawer toggle is now mode-aware: it is visible only in Canvas mode and hidden in Wizard mode to avoid non-applicable toolbar controls, and Canvas mode loads with that drawer closed by default.
- Workflow Studio shell toolbar now renders `Nodes` immediately after the mode toggle in Canvas mode and keeps `Save` as the rightmost toolbar action.
- Workflow Studio registration no longer contributes the prior `Workflow draft guidance` draft-authoring card; workflow authoring guidance now lives in the mode surface and shared readiness disclosures.
- Workflow Studio mode state now treats canonical `WorkflowDraft` content as the single source of truth for both modes, with explicit shared section support for `triggers`, `inputs`, `steps`, and `outputs` and no per-mode draft shape.
- Mode switching synchronization is now state-driven: wizard and canvas both mutate/read the same `WorkflowStudioModeStateStore` canonical draft, so switching modes preserves current draft data without shadow transfer logic.
- Canvas mode now uses a bounded projection/sync adapter (`ui/studio-shell/workflow/WorkflowStudioCanvasViewModel.ts`) that derives section/node view state from canonical `WorkflowDraft` and applies typed canvas actions back into that same draft (no canvas-only workflow model).
- Workflow Studio Canvas Mode now renders that projection through React Flow (`ui/components/studio-shell/workflow/WorkflowStudioCanvasReactFlow.tsx`) as the canonical canvas primitive layer (nodes, edges, controls, viewport).
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
- Workflow Studio draft authoring now has explicit mode-aware renderer boundaries: shared shell orchestration stays in `StudioShellPage`, while mode-specific surfaces are isolated in `WorkflowStudioDraftAuthoringBoundary` + `WorkflowStudioWizardModeSurface` + `WorkflowStudioCanvasModeSurface`.
- Workflow Studio mode surfaces now render through explicit mode-specific layout containers (`WorkflowStudioWizardModeLayout`, `WorkflowStudioCanvasModeLayout`) so Wizard and Canvas UI structure can evolve independently without copying shared shell/session/draft logic.
- Wizard Mode now provides a structured section framework via reusable section components (`WizardSection`, `SectionHeader`, `SectionBody`) and always renders Trigger, Inputs, Steps, and Outputs in top-to-bottom order.
- Wizard Trigger section now uses a registry-backed interactive authoring editor (`WorkflowStudioTriggerSectionEditor` + `ui/studio-shell/workflow/WorkflowWizardTriggers.ts`) that enumerates supported trigger types from `WorkflowTriggerTypeRegistry`, adds trigger instances from registry defaults, and binds add/edit/remove/type-switch actions directly to canonical `WorkflowDraft.triggers` in `WorkflowStudioModeStateStore`.
- Trigger authoring now supports multi-trigger management in wizard mode (add/select/edit/reorder/remove) with id-based operations, stable display ordering, and safe selected-trigger fallback after deletion.
- Trigger configuration editing now uses type-specific form surfaces for user/manual, temporal, and state triggers, with shared utility-level config patching and validation-message projection from shared trigger validation seams.
- Trigger validation feedback now stays canonical-projection-driven (`WorkflowStudioModeStateStore` + `validateWorkflowDraft`) without renderer-local trigger-rule duplication.
- Trigger UX language/config now remains continuation-ready: user scope authoring exposes both `workflow-start` and `workflow-continuation` semantics so later intermediate resume/human-approval trigger behavior is not blocked by start-only assumptions.
- Wizard Inputs now include an interactive dataset selector (`WorkflowStudioInputSectionEditor`) that queries registry dataset assets (`atomic/dataset/none`), supports search + multi-select, writes directly to canonical `WorkflowDraft.inputs[]`, and preserves mode-shared draft truth.
- Wizard Inputs now also support inline dataset creation handoff through shared route-based inline creation semantics (`InlineAssetCreationService`): launch Dataset Studio, return to Wizard Inputs, and auto-attach returned dataset assets when handoff status is `created` (while `cancelled` returns without side effects).
- Wizard Steps now include an interactive ordered step builder (`WorkflowStudioStepSectionEditor`) over canonical `WorkflowDraft.steps[]` with add/remove, up/down reorder, stable step identity preservation, and explicit empty-state first-step CTA.
- Wizard Steps now include an extensible step-type selector over canonical `WorkflowDraft.steps[]`, supporting both asset-backed and built-in action step categories.
- Wizard step selection now uses one registry-backed authoring flow for both asset-backed and built-in options, with built-in actions clearly labeled by canonical category (`control-flow`, `temporal`, `human-interaction`) and no page-local hardcoded built-in list.
- Built-in wizard actions now include `if-then`, `loop-iteration`, `delay-wait`, and `manual-approval`, with per-step type switching that clears incompatible stale config/asset references.
- Wizard built-in step configuration is now structured and draft-bound for all initial built-ins: conditional expression + branch labels/step-ids (`if-then`), loop mode/source/body/limits (`loop-iteration`), duration vs until-time with note (`delay-wait`), and prompt/mode/outcomes/roles/timeout policy (`manual-approval`).
- Wizard Steps now expose a placement-aware insertion control (`Insertion point`) and control-flow-aware move guards: reorders that would place referenced branch/body/outcome steps before their control-flow parent are blocked in authoring operations, and move buttons only enable when the resulting order stays valid.
- Wizard Outputs now include an interactive output editor (`WorkflowStudioOutputSectionEditor`) over canonical `WorkflowDraft.outputs[]` with multi-output list management (view/select/edit/remove/reorder), destination-type selection (`file-export`, `web-viewer`, `system-entry`, `prompt-response-chat`), canonical output ordering (`order`) preservation, and metadata-driven type-specific configuration forms (required/optional field semantics plus type-switch resets that clear stale destination-specific options).
- Output add/config UI now composes a reusable registry-driven selector seam (`WorkflowOutputSelector` + `ui/studio-shell/workflow/WorkflowWizardOutputs.ts` + `WorkflowOutputTypeRegistry`) so wizard and future authoring surfaces reuse one metadata contract instead of hardcoded per-type add flows.
- Output reload hardening now preserves unknown/stale output destination types as explicit unknown entries in authoring/review summaries (instead of silently coercing to a default type), so malformed persisted output payloads remain visible and recoverable.
- Output configuration remains draft-bound and mode-shared: file export format/delivery/path/name, web viewer title/presentation mode, and system-record destination fields (entity, collection path, write mode, record shape, metadata inclusion) persist through Wizard/Canvas mode switches using `WorkflowStudioModeStateStore`.
- Wizard review/overview surfaces now render registry-driven output summaries (type label + key configuration details) from canonical `WorkflowDraft.outputs[]`, including the workflow readiness review and mode overview cards, so summaries stay current after add/edit/remove/reorder operations.
- Workflow execution now has a bounded conversational continuation seam in the renderer (`ui/workflow-conversation/*` + `WorkflowConversationSessionService`): eligible prompt-response workflow runs create canonical chat sessions linked to workflow + execution ids and persisted through local UI storage.
- Conversational sessions now route through a dedicated chat surface (`/run/workflow-chat/:sessionId`, `ui/pages/WorkflowConversationPage.tsx`) that rehydrates persisted session state, renders seeded initial prompt/assistant messages from execution output truth, and appends continued turns through the existing workflow execution service path.
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
- Story 2.13 now adds focused mode-system regression coverage at renderer/application seams (`ui/studio-shell/workflow/tests/WorkflowStudioModeSystem.integration.test.tsx` + expanded routing tests), covering default/direct/invalid route resolution, mode-switch UI state transitions, wizard/canvas shared-draft synchronization, mode-layout rendering, and validation-hook safety checks.
- Wizard progression/readiness is now derived from canonical draft + shared validation via `ui/studio-shell/workflow/WorkflowStudioWizardProgress.ts` (section completeness/readiness, previous/current/next section targets, and workflow-ready summary) rather than persisted draft fields.
- Wizard mode now uses explicit page routing and linear progression in `WorkflowStudioWizardModeSurface`: one page is visible at a time (`trigger`, `inputs`, `steps`, `outputs`) with route-backed page buttons plus Back/Next controls.
- Wizard page-routing contracts are now reusable at the shell level (`ui/studio-shell/wizard/WizardPageRouting.ts`), and Workflow Studio binds that contract through `ui/studio-shell/workflow/WorkflowStudioWizardRouting.ts` + `/studio-shell/workflow/wizard/:wizardPageId` routes.
- Story 3.15 now adds a unified wizard readiness summary surface (per-section status + workflow-level blocking issues + explicit required-input policy) and an explicit terminal handoff action (`Prepare for Run`) that blocks invalid completion while linking ready flows into lifecycle/publish controls.
- Workflow Studio manual run now routes through backend/application orchestration from the shell toolbar (`Run Workflow`) and renders backend-authoritative pre-execution validation + launch outcome feedback in the same shell surface (no UI-local execution rule path).
- Workflow Studio execution feedback is now presented through a dedicated reusable renderer panel (`ui/components/studio-shell/workflow/WorkflowStudioExecutionFeedbackPanel.tsx`) that combines canonical readiness checks, launch lifecycle status, failure summaries, and bounded output handoff summaries from backend read models.
- Toolbar `Run Validation` in Workflow Studio now uses canonical execution-readiness validation (`StudioShellService.assessWorkflowExecutionReadiness`) rather than only draft-metadata validation, keeping launch eligibility and blocked reasons aligned with the execution pipeline.
- Story 4.14 rebalances wizard mode for authoring focus: active page content renders directly under page buttons, wizard focus/progress text sits directly beneath those page buttons, Back/Next controls are on the page-nav rail (plus an additional inline Trigger-page Back/Next row), and readiness diagnostics remain in a bottom-of-stack disclosure collapsed by default.
- Navigation/progression concerns remain UI-only orchestration; all section edits still mutate only shared canonical `WorkflowStudioModeStateStore.sharedDraft`.
- Phase 9.12 (stories 3.7â€“3.8) now routes Context Bundle Studio through that same shell renderer (`ui/pages/ContextBundleStudioPage.tsx` -> `StudioShellPage` with `contextBundleStudioRegistration`) so composite context-bundle input-preparer authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Context-bundle-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.13 (stories 3.9â€“3.10) now routes Dataset Pipeline Studio through that same shell renderer (`ui/pages/DatasetPipelineStudioPage.tsx` -> `StudioShellPage` with `datasetPipelineStudioRegistration`) so composite dataset-pipeline authoring uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Dataset-pipeline renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.14 (stories 3.11â€“3.12) now routes Training Recipe Studio through that same shell renderer (`ui/pages/TrainingRecipeStudioPage.tsx` -> `StudioShellPage` with `trainingRecipeStudioRegistration`) so composite training-recipe authoring uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Training-recipe renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.15 (stories 3.13â€“3.14) now routes Tool Chain Studio through that same shell renderer (`ui/pages/ToolChainStudioPage.tsx` -> `StudioShellPage` with `toolChainStudioRegistration`) so composite tool-chain authoring also uses the same shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Tool-chain renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Phase 9.16 (stories 3.17â€“3.18) extends composite consistency/interop coverage through shared integration tests over the real renderer-to-persistence path, including all implemented composite studios and composite-to-atomic dependency reuse checks (`ui/services/tests/StudioShellService.integration.test.ts`).

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
- Direction 5 stories 6.15â€“6.16 now keep runtime monitoring/result UX inside the existing System Studio run-trigger extension: `SystemRuntimeRunPanel` composes bounded API-driven monitoring/result sections (`ExecutionMonitorPanel`, `ExecutionResultPanel`) to render execution status/progress/node+nested state, bounded trace/log and recovery indicators, plus execution output/node+nested summaries and diagnostics from `getSystemExecutionStatus/getSystemExecutionTrace/getSystemExecutionResult` without renderer-side runtime model reimplementation.
- Still intentionally out of scope in renderer: speculative rich visual graph tooling and runtime execution-binding authoring beyond current structural composition/editing + shared shell lifecycle/publish flows.

- Data Studio preview UI now includes a reusable `DataPreviewPanel` surface (`ui/components/assets/DataPreviewPanel.tsx`) that is fed by data-layer execution results (preview model + diagnostics + validation issues + lineage summary) rather than UI-local data parsing/render branching.
- Dataset Studio integrates this through a registration-bounded extension (`dataset-studio-data-preview-panel` in `DatasetStudioRegistration.ts`) using a thin draft-content adapter (`DatasetStudioDraftPreviewPanel.tsx`) that executes existing converter/execution seams and renders empty/loading/error/ready states without introducing a parallel page architecture.
- Dataset Studio preview authoring now includes a reusable schema-driven `AssetConfigurationPanel` (`ui/components/assets/AssetConfigurationPanel.tsx`) consumed by the same draft adapter surface (`DatasetStudioDraftPreviewPanel.tsx`) so configuration editing is not a bespoke asset-specific form.
- Configuration controls are rendered from registered data-asset config schema contracts (`DataAssetConfigSchema`) resolved through the data-layer registry seam (`application/dataset-studio/DataAssetRegistry.ts`) and applied back into execution requests via existing execution-framework orchestration.
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

Direction 5 Epic 11 final hardening status (stories 11.23-11.24):
- UX consistency hardening now has shared policy/regression seams in `ui/routes/UxConsistencyPolicy.ts` and `ui/routes/IntentUxRegressionSuite.ts`, focused on intent-first terminology, taxonomy suppression in primary UX, and cross-surface route/origin continuity across Build/Explore/Run plus shell-adjacent surfaces.
- Legacy UX cleanup is now explicitly policy-driven through `LegacyUxCleanupPlanner` in `ui/routes/LegacyNavigationSunset.ts`, keeping compatibility behavior tied to existing sunset controls instead of ad hoc route handling.
- Explore is the user-facing library term in page-level hero copy (`ui/pages/RegistryPage.tsx`), while internal registry route naming remains implementation detail.
- Remaining bounded compatibility paths are intentional and controlled by feature flags (`VITE_FEATURE_INTENT_NAVIGATION`, `VITE_FEATURE_LEGACY_NAVIGATION`) rather than accidental parallel navigation models.

Intent UX documentation alignment checklist (implemented scope):
- Implemented now: Build/Explore/Run primary navigation shell, intent-based Build entry/routing, contextual breadcrumbs/return paths, unified Run launch model, command palette onboarding/recommendations/recents integration, and legacy-route sunset controls.
- Build now includes a dedicated intent-first automation entry route (`/build/automate`) where users describe automation goals in plain language (`What do you want to automate?`) before launching the existing workflow studio path; intent text is carried forward via build-routing prefill context and URL handoff metadata.
- Primary route switching is now command-palette-driven in the app shell header; the legacy header link strip is removed, and Home remains accessible through the AI Loom Studio logo link.
- Partially implemented / bounded: legacy route compatibility remains available behind sunset mode for staged rollout; legacy screens are redirected/hidden by policy rather than fully deleted.
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

- The global header command palette/navigation menu now includes a first-class `Data` entry (`ui/routes/CommandPalette.ts`) that routes to Dataset Studio (`/studio-shell/dataset`).
- Top-level menu order is now: `Build`, `Run`, `Explore`, `Data`, `Manage`.
- This extends existing shell navigation patterns without adding a parallel navigation system.
