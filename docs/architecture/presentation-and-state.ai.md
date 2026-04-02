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
Workflow Studio observability now also uses the same thin renderer -> backend-service approach: run-history list/detail views are rendered via `WorkflowStudioRunHistoryPanel` and loaded through `ui/services/StudioShellService.ts` (`listWorkflowRuns`, `getWorkflowRunDetail`) rather than UI-owned persistence/query logic.
Workflow Studio run observability now keeps hierarchy and disclosure bounded in that same surface: run-level summary first, step-by-step expandable inspection second, and structured diagnostics/failure-location cues rendered from backend read models (no UI-side diagnostic inference/parsing).
Workflow Studio run detail now also exposes rerun actions on the same surface: `Rerun as-is` and `Edit and rerun` both submit to the studio-shell backend contract, start from canonical persisted execution context, and then navigate to the newly created derived run detail record.
Edit-and-rerun stays user-facing and structured (target/parameters/execution-metadata/property-overrides JSON fields) rather than raw log parsing or ad hoc debug-only controls.
Related-run lineage navigation now also uses that same execution-history service seam (related-run cluster projection + detail-panel navigation) instead of page-level custom grouping logic.
Workflow observability entry points now also appear on adjacent workflow surfaces (persisted workflow list cards, workflow draft status, and workflow execution feedback), so navigation to run history/run detail is part of the normal build/run/editor flow rather than an isolated panel-only path.
Execution feedback now includes direct links to the just-recorded run detail and workflow-scoped run history when backend run-history persistence is available.
Run-history rerun controls now render explicit unsupported-state UX (for non-terminal runs or missing structured historical input context) instead of relying on implicit button behavior.
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
- Phase 9.10 (stories 2.21â€“2.22) now routes Config Profile Studio through that same shell renderer (`ui/pages/ConfigProfileStudioPage.tsx` -> `StudioShellPage` with `configProfileStudioRegistration`) so config-profile authoring uses the same draft/session/validation/dependency/lifecycle/publish/version flow and shared persistence-backed consistency coverage.
- Phase 9.11 (stories 3.5â€“3.6) now routes Workflow Studio through that same shell renderer (`ui/pages/WorkflowStudioPage.tsx` -> `StudioShellPage` with `workflowStudioRegistration`) so composite workflow-orchestrator authoring uses the shared session/draft/metadata/dependency/validation/lifecycle/publish/version surfaces.
- Workflow-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots) while business rules stay backend/application-owned via shared composite validation and enforcement seams.
- Story 4.13 promotes draft authoring as the primary shell surface: `StudioShellPage` now renders draft authoring above/outside the card grid, and shell toolbar configuration is now registration-driven (`shell.toolbar`) with optional typed actions (refresh/save/validate/workflow-mode) executed through existing shell orchestration seams.
- Studio shell authoring now also supports optional registration-driven side drawers (`shell.drawers.left/right`) with toolbar-bound open/close toggles (leftmost for left drawer, rightmost for right drawer) so studios can move selected authoring cards into closable side rails without introducing a second shell architecture.
- Workflow Studio draft authoring now includes an explicit mode abstraction (`wizard`, `canvas`) plus a centralized renderer-side mode/draft state manager (`ui/studio-shell/workflow/WorkflowStudioModes.ts`, `WorkflowStudioModeStateStore.ts`) so mode selection and canonical workflow draft state are shared instead of mode-local.
- Workflow Studio now exposes an explicit mode switch control in the draft-authoring shell and routes mode changes through canonical Workflow Studio mode paths (wizard/canvas) so in-app and direct URL navigation stay aligned.
- Workflow Studio shell toolbar mode switching now renders as a single context-aware toggle action (`Wizard`/`Canvas`) that routes through the same mode-state + route synchronization seam.
- Workflow Studio shell `Nodes` drawer toggle is now mode-aware: it is visible only in Canvas mode and hidden in Wizard mode to avoid non-applicable toolbar controls, and Canvas mode loads with that drawer closed by default.
- Workflow Studio shell toolbar now renders `Nodes` immediately after the mode toggle in Canvas mode and keeps `Save` as the rightmost toolbar action.
- Workflow Studio registration no longer contributes the prior `Workflow draft guidance` draft-authoring card; workflow authoring guidance now lives in the mode surface and shared readiness disclosures.
- Workflow Studio mode state now keeps canonical `WorkflowDraft` as one shared source of truth for both modes, including explicit shared section handling for `triggers`, `inputs`, `steps`, and `outputs` (no per-mode draft schema).
- Mode synchronization is now store-driven: wizard and canvas both read/write through `WorkflowStudioModeStateStore`, so switching modes preserves draft data without copy/transfer shims.
- Canvas mode now uses a bounded projection/sync adapter (`ui/studio-shell/workflow/WorkflowStudioCanvasViewModel.ts`) that derives section/node view state from canonical `WorkflowDraft` and applies typed canvas actions back into that same draft (no canvas-only workflow model).
- Workflow Studio Canvas Mode now renders that projection through React Flow (`ui/components/studio-shell/workflow/WorkflowStudioCanvasReactFlow.tsx`) as the canonical canvas primitive layer (nodes, edges, controls, viewport behavior).
- React Flow graph projection remains adapter-owned and deterministic: section/item nodes plus section-flow/entry/sequence edges and stable initial placement are derived in `WorkflowStudioCanvasViewModel` from shared draft truth (not canvas-local workflow state).
- Canvas graph projection now calculates per-node heights from projected node content and applies deterministic cumulative y-axis spacing per section column in `WorkflowStudioCanvasViewModel`, so section/item nodes do not touch or overlap.
- Canvas node reposition updates now use gentle transform transitions on React Flow nodes so spacing corrections move smoothly.
- Canvas wheel interaction now prefers zoom (`zoomOnScroll`) and disables scroll-wheel panning in this authoring surface.
- Workflow Studio Canvas Mode now adds a registry-derived palette for trigger/input/step/output node creation, with each add path routed through typed canvas actions against canonical draft state, and Workflow Studio configures this palette as a searchable left `Nodes` drawer over the same shared draft state.
- Canvas item nodes now support inline edit/remove controls plus selected-node inspector editing; all mutations remain shared-draft writes and React Flow is still only the projection/interaction layer.
- Canvas step sequencing now supports visual reorder interactions in Canvas Mode (drag reorder plus inline move controls), while canonical order remains `WorkflowDraft.steps[]` via typed canvas actions and reorder guardrails.
- Canvas edge management now includes explicit editable connections for supported relationships (`step -> step` dependencies and `step -> output` source links), with create/reconnect/remove operations routed through React Flow callbacks and reconciled back into canonical draft fields (`dependsOnStepIds`, `sourceStepId`).
- Unsupported connection attempts are rejected in the workflow canvas adapter/action seam (not in ad hoc UI state), preserving shared-draft source-of-truth behavior.
- Canvas branching now projects canonical if-then config as explicit React Flow branch edges (`then` / `else`) and reconciles branch create/reconnect/remove through typed canvas actions into canonical `WorkflowDraft.steps[].config.branches` fields.
- Canvas step editing now includes first-pass conditional controls (condition expression, branch labels, branch step-id lists) within the shared step editor surface, keeping conditional semantics out of canvas-only component state.
- Canvas input/step node editors now include selector-backed dataset + agent linkage through shared asset-selector session/adapter/shell seams, writing canonical references into `inputs[].asset` and `steps[].assetRef` while preserving wizard/canvas shared-draft synchronization.
- Workflow Studio Canvas Mode now renders the left `Nodes` drawer as a real overlay drawer: fixed beneath the app header, anchored far-left on tablet/desktop, full-width on mobile, with a fixed close affordance and scrollable node section content.
- Workflow Studio canvas layout now renders the React Flow canvas surface directly (without the prior layout container card wrapper) while keeping inspector/details within the same mode boundary.
- Workflow Studio draft authoring now has explicit mode-aware renderer boundaries: shared shell orchestration stays in `StudioShellPage`, while mode-specific surfaces are isolated in `WorkflowStudioDraftAuthoringBoundary` + `WorkflowStudioWizardModeSurface` + `WorkflowStudioCanvasModeSurface`.
- Experience-asset authoring now has a reusable UI-neutral contract seam (`ui/studio-shell/experience-assets/ExperienceAssetContracts.ts`) plus a generic mode boundary renderer (`ui/components/studio-shell/experience-assets/ExperienceAssetAuthoringBoundary.tsx`) so wizard/canvas switching can be shared across studios without workflow-specific route/store/domain coupling.

- Experience-asset presentation now also has a compact neutral vocabulary layer (`ui/studio-shell/experience-assets/ExperiencePresentationVocabulary.ts`) covering document/issue/page/mode/action ids plus reusable action/progress/issue summary models for cross-studio authoring surfaces.
- Wizard engine mechanics are now extracted into a workflow-neutral renderer (`ui/components/studio-shell/experience-assets/ConfigurableWizardSurface.tsx`) with narrow contracts (`ui/studio-shell/experience-assets/ConfigurableWizardSurfaceContracts.ts`) for ordered page navigation, current-page hosting, progress summary, terminal actions, and readiness summary rendering without workflow-editor imports.
- Canvas engine mechanics are now extracted into a workflow-neutral renderer (`ui/components/studio-shell/experience-assets/ConfigurableCanvasSurface.tsx`) with narrow contracts (`ui/studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts.ts`) for graph shell hosting, focused-target handling, palette/inspector regions, interaction messaging, and optional drawer orchestration without workflow-editor imports.
- Studio-shell orchestration remains host-owned around these reusable surfaces: save/run/validate/lifecycle orchestration and backend persistence/execution calls stay in `StudioShellPage` + `StudioShellService`/backend contracts, while wizard/canvas experience surfaces consume document/mode/issue state plus host-provided callbacks.
- Wizard and canvas are now first-class registered experience assets (`loom-wizard`, `loom-canvas`) via `ui/studio-shell/experience-assets/ExperienceSurfaceAssets.ts`, and Workflow Studio declares usage through registration configuration (`workflowStudioRegistration.shell.experienceAssets`) rather than hardcoded mode metadata.
- Experience-asset canvas definition format now exists as a bounded contract (`CanvasExperienceAssetDefinition`) so studios can map document-to-graph summaries, palette/inspector hooks, and graph interaction hosts into the reusable canvas surface without embedding workflow-specific domain semantics.
- Workflow Studio Canvas now binds through an explicit workflow adapter seam (`ui/studio-shell/workflow/WorkflowCanvasExperienceAdapter.tsx`) that maps workflow draft/view-model semantics into `CanvasExperienceAssetDefinition` for the reusable canvas engine, while keeping workflow-specific editing behavior outside generic canvas contracts.
- Reusable experience surfaces now expose route-neutral state/callback contracts (`currentModeId`/`onModeChange`, `currentPageId`/`onPageChange`) so workflow route parsing/synchronization stays in workflow-host integration layers rather than inside generic wizard/canvas boundary components.
- Workflow Studio mode surfaces now render through explicit mode-specific layout containers (`WorkflowStudioWizardModeLayout`, `WorkflowStudioCanvasModeLayout`) so Wizard and Canvas UI structure can evolve independently without copying shared shell/session/draft logic.
- Wizard Mode now uses reusable section framework primitives (`WizardSection`, `SectionHeader`, `SectionBody`) and always renders Trigger, Inputs, Steps, and Outputs sections in top-to-bottom order.
- Wizard Trigger now uses a registry-backed interactive editor (`WorkflowStudioTriggerSectionEditor` + `ui/studio-shell/workflow/WorkflowWizardTriggers.ts`) that enumerates supported trigger types from `WorkflowTriggerTypeRegistry` metadata, adds trigger instances from registry defaults, and supports type switching/removal while writing directly to canonical `WorkflowDraft.triggers` in shared mode state.
- Wizard trigger editing now includes multi-trigger management (add/select/edit/reorder/remove) through id-based operations with stable ordering and safe selected-trigger fallback when rows are removed.
- Trigger config authoring now renders type-specific forms for user/manual, temporal, and state trigger contracts while reusing shared trigger utilities for patch/update operations and validation-message projection.
- Trigger issue rendering now stays fully aligned with canonical draft validation projection (`WorkflowStudioModeStateStore` + `validateWorkflowDraft`) without duplicating trigger-specific validation rules in renderer-local logic.
- Wizard trigger UX now explicitly preserves forward compatibility for intermediate continuation semantics: user trigger scope editing exposes both `workflow-start` and `workflow-continuation` values and avoids hardcoding trigger language to start-only behavior.
- Wizard Inputs now include an interactive dataset selector (`WorkflowStudioInputSectionEditor`) over canonical `WorkflowDraft.inputs[]`: registry-backed dataset querying (`atomic/dataset/none`), basic search, multi-select, explicit selected-state rendering, and empty-state CTA.
- Wizard Inputs now also consume shared inline creation return semantics (`InlineAssetCreationService`) for Dataset Studio handoff: launch from Wizard Inputs, return to workflow wizard route context, auto-attach returned dataset assets on `created`, and no-op on `cancelled`.
- Wizard Steps now include an interactive ordered step builder (`WorkflowStudioStepSectionEditor`) over canonical `WorkflowDraft.steps[]`: add/remove, up/down reorder, stable step identity preservation, and explicit empty-state first-step CTA.
- Wizard Steps now include an extensible step-type selector over canonical `WorkflowDraft.steps[]`, supporting both asset-backed and built-in action categories.
- Wizard step selection now uses one registry-backed authoring flow for both asset-backed and built-in options, with built-ins explicitly labeled by canonical category (`control-flow`, `temporal`, `human-interaction`) and no page-local hardcoded list.
- Built-in wizard actions now include `if-then`, `loop-iteration`, `delay-wait`, and `manual-approval`, with per-step type switching that clears incompatible stale config/asset references.
- Wizard built-in configuration editors are now structured and shared-draft-bound for all initial built-ins: condition + branch labels/step IDs (`if-then`), loop mode/source/body/limits (`loop-iteration`), duration vs until-time (`delay-wait`), and prompt/mode/outcomes/roles/timeout policy (`manual-approval`).
- Wizard Steps now expose a placement-aware insertion control (`Insertion point`) and control-flow-aware move guards: reorders that would place referenced branch/body/outcome steps before their control-flow parent are blocked in authoring operations, and move buttons only enable when the resulting order stays valid.
- Wizard Outputs now use an interactive editor (`WorkflowStudioOutputSectionEditor`) over canonical `WorkflowDraft.outputs[]`: multi-output list management (view/select/edit/remove/reorder), destination-type selection (`file-export`, `web-viewer`, `system-entry`, `prompt-response-chat`), canonical output ordering (`order`) preservation, and metadata-driven type-specific configuration forms with required/optional field semantics and clean type-switch resets.
- Output add/config UI now composes a reusable registry-driven selector seam (`WorkflowOutputSelector` + `ui/studio-shell/workflow/WorkflowWizardOutputs.ts` + `WorkflowOutputTypeRegistry`) so wizard and future authoring surfaces reuse one metadata contract instead of hardcoded per-type add flows.
- Output reload hardening now preserves unknown/stale output destination types as explicit unknown entries in authoring/review summaries (instead of silently coercing to a default type), so malformed persisted output payloads remain visible and recoverable.
- Output configuration remains shared-draft truth across Wizard/Canvas mode switches through `WorkflowStudioModeStateStore` (file export format/delivery/path/name, web viewer title/presentation mode, system-record destination fields for entity/collection/write mode/record shape/metadata inclusion, and prompt-response chat linkage/scope/session prompt fields).
- Wizard review/overview now includes registry-driven output summaries from canonical `WorkflowDraft.outputs[]` (type + key config details) in readiness and mode-overview surfaces, with live updates on add/edit/remove/reorder.
- Workflow execution now has a bounded conversational continuation seam in the renderer (`ui/workflow-conversation/*` + `WorkflowConversationSessionService`): eligible prompt-response workflow runs create canonical chat sessions linked to workflow + execution ids and persisted in UI storage.
- Conversational sessions now route through a dedicated chat surface (`/run/workflow-chat/:sessionId`, `ui/pages/WorkflowConversationPage.tsx`) that rehydrates persisted session state, renders seeded initial prompt/assistant messages from execution output truth, and appends continuation turns through the existing workflow execution service path.
- Workflow Studio mode state now exposes shared validation hooks (`WorkflowStudioModeValidation` + `WorkflowStudioModeStateStore` validation projection) so both Wizard and Canvas consume one canonical draft validation result path (including parse-safety and draft-integrity checks) with non-crashing feedback.
- Workflow Studio now supports direct mode deep links through `/studio-shell/workflow/:modeId` and `?mode=` parsing via `WorkflowStudioModeRouting`; resolved modes are synchronized into the centralized `WorkflowStudioModeStateStore` (no routing-local mode shadow state).
- Default mode behavior is now explicit and centralized: entering Workflow Studio without an explicit mode (or with an invalid mode) resolves deterministically to `wizard`, while valid explicit route/query modes are still respected.
- Invalid workflow mode routes are handled as safe fallbacks (default mode selected, warning surfaced) so unsupported mode URLs do not break draft authoring or shared save/lifecycle flows.
- Workflow mode/draft state is now persisted per studio through a shared store accessor (`getWorkflowStudioModeStateStore`) and snapshot-aware synchronization so normal mode-route transitions do not reset in-progress draft edits for the same authoring session.
- Workflow Studio hardening now keeps unsaved state explicit at shell level (`WorkflowStudioModeStateStore.hasLocalDraftEdits`) and projects that state in `StudioShellPage` with route-leave + browser-refresh guards (`useBlocker`, `useBeforeUnload`) that trigger only when exiting Workflow Studio routes.
- Workflow mode transitions stay mode-safe under unsaved edits: wizard/canvas toggles remain inside one shared draft store and do not trigger leave-guards, while save flows now return success/failure so guarded navigation can save-then-proceed safely.
- Workflow Studio save flows now also synchronize persisted workflow records through backend/application workflow-persistence use cases, so wizard-authored and canvas-authored shared-draft saves update the same persisted canonical workflow definition.
- Workflow Studio metadata authoring now keeps workflow name/summary/tags in the same save/dirty contract as shared draft content: save status projects `saving`/`saved`/`unsaved`/`failed`, route-leave guards include metadata edits, and metadata updates flow through the same studio save path into persistence and Explore listings.
- Canvas validation polish now projects canonical draft issues into React Flow-adjacent UI (`WorkflowStudioCanvasModeSurface`): section/node issue summaries, invalid-node styling, empty-state guidance, and actionable invalid-connection feedback from `WorkflowStudioCanvasViewModel.resolveWorkflowCanvasConnectionAction`.
- Story 2.13 now adds focused mode-system regression coverage at renderer/application seams (`ui/studio-shell/workflow/tests/WorkflowStudioModeSystem.integration.test.tsx` + expanded routing tests), covering default/direct/invalid route resolution, mode-switch UI state transitions, wizard/canvas shared-draft synchronization, mode-layout rendering, and validation-hook safety checks.
- Wizard progression/readiness is now derived from canonical draft + shared validation via `ui/studio-shell/workflow/WorkflowStudioWizardProgress.ts` (section completeness/readiness, previous/current/next section targets, and workflow-ready summary) rather than persisted draft fields.
- Wizard mode now uses explicit page routing and linear progression in `WorkflowStudioWizardModeSurface`: one page is visible at a time (`trigger`, `inputs`, `steps`, `outputs`) with route-backed page buttons plus Back/Next controls.
- Wizard page-routing contracts are now reusable at the shell level (`ui/studio-shell/wizard/WizardPageRouting.ts`), and Workflow Studio binds that contract through `ui/studio-shell/workflow/WorkflowStudioWizardRouting.ts` + `/studio-shell/workflow/wizard/:wizardPageId` routes.
- Story 3.15 now adds a unified wizard readiness summary surface (per-section status + workflow-level blocking issues + explicit required-input policy) and an explicit terminal handoff action (`Prepare for Run`) that blocks invalid completion while linking ready flows into lifecycle/publish controls.
- Workflow Studio manual run now routes through backend/application orchestration from the shell toolbar (`Run Workflow`) and renders backend-authoritative pre-execution validation + launch outcome feedback in the same shell surface (no UI-local execution rule path).
- Workflow Studio execution feedback now renders through one reusable panel (`ui/components/studio-shell/workflow/WorkflowStudioExecutionFeedbackPanel.tsx`) that projects canonical readiness, launch lifecycle, failure summary, and bounded result-handoff status from backend run/readiness contracts.
- Workflow Studio `Run Validation` now requests canonical execution-readiness checks through `StudioShellService.assessWorkflowExecutionReadiness` so launch eligibility/blocked semantics stay backend-authoritative.
- Story 4.14 now rebalances the wizard surface for authoring focus: active wizard page content renders directly under page buttons, wizard focus/progress text lives directly beneath those page buttons, Back/Next controls sit on the page-nav rail (with an additional inline Trigger-page Back/Next row), and readiness diagnostics remain in a bottom-of-stack collapsed disclosure.
- Stories 5–6 now drive Workflow Studio wizard mode through a reusable wizard asset definition contract (`ui/studio-shell/experience-assets/ConfigurableWizardSurfaceContracts.ts`) and a workflow-specific adapter (`ui/studio-shell/workflow/WorkflowWizardExperienceAdapter.tsx`) that maps workflow pages/progress/readiness/issues/renderers/terminal behavior into the generic configurable wizard surface.
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
- Registry is now a first-class Studio Shell surface (`/studio-shell/registry`) routed through the same app shell/navigation and powered by a thin bridge-backed `RegistryService` (desktop preload bridge first, browser fallback bridge second) plus shared page/card/layout primitives.
- Browser fallback registry behavior is intentionally contract-level, not page-local: `RegistryService` resolves `BrowserRegistryBridgeFallback` when preload contracts are unavailable, and that fallback reuses shared in-memory workflow-persistence fallback state so Explore persisted-workflow discovery stays coherent with Studio Shell authoring in browser-hosted development.
- Registry asset browsing uses API-driven taxonomy filters (structural kind, semantic role, behavior kind) with progressive disclosure (`Advanced filters`) so renderer state remains minimal and business filtering stays backend-authoritative.
- Registry terminology is normalized across list/filter/detail surfaces around `Structure`, `Role`, and `Behavior` labels.
- Search + filter coherence is URL-driven and combined (same request context), with preserved list-return context via `registryContext` in detail links.
- Registry cross-studio handoffs are now URL-driven and taxonomy-derived (`semanticRole -> studio route` mapping), so asset list/detail/graph interactions can deep-link to studio editors without introducing a second navigation model.
- Registry asset detail now renders backend-projected validation/compatibility summaries (including dependency incompatibilities and behavior mismatches) from the registry API payload instead of UI-side validation reimplementation.
- Dependency/lineage rendering remains read-model-driven with bounded UX refinements only (stable ordering, node counts, consistent action labels).
- Direction 5 stories 5.7â€“5.10 now provide bounded System Studio registration/page routing (`/studio-shell/system`) plus backend-authoritative system orchestration on the same shared `StudioShellPage` architecture (no parallel shell/registration/validation lifecycle).
- System Studio registration explicitly declares system-level composition capabilities (atomic + composite + system, including nested system composition) and participates in shared default metadata/taxonomy/contract + validation/publish-gating seams.
- Direction 5 stories 5.11â€“5.12 now add a bounded System Composition editor surface inside System Studio (`SystemCompositionEditor`) with backend-authoritative add/remove/reorder child orchestration, registry-backed candidate discovery, and explicit nested-system summaries over real draft content/dependency state.
- Direction 5 stories 5.13â€“5.14 now extend that same System Studio registration with bounded interface/config authoring panels (`SystemInterfaceEditor`, `SystemParameterConfigEditor`) that persist authored system inputs/outputs/parameters/defaults through system-specific backend operations (`updateSystemInterfaces`, `updateSystemParameters`) rather than UI-only state.
- Direction 5 story 5.17 now extends shared route/handoff seams so system assets participate as first-class navigation targets across registry list/detail and System Studio composition surfaces, including context-preserving query handoffs (`assetId`, `versionId`, `registryContext`, parent/selected-component context) and explicit nested-system traversal.
- Direction 5 story 5.18 now adds a bounded System Studio compatibility insights surface (`SystemCompatibilityInsightsPanel`) driven by backend-authoritative system validation outputs (`getSystemCompatibilityInsights`) with recursive issue summaries (child/nested/binding/interface/config mismatch counts) instead of UI-side heuristics.
- Direction 5 story 5.21 now adds end-to-end System Studio consistency coverage over the real service -> bridge -> backend -> application -> SQLite seam, including child-component operations, system interface/parameter/execution-metadata authoring, publish, and reload consistency.
- Direction 5 story 5.22 now adds explicit atomic/composite/system interop coverage for System Studio through the same real seam, validating pinned dependency propagation, mixed child-kind composition, clean compatibility-insights reporting, and persisted upstream lineage after publish/reload.
- Direction 5 story 5.23 now extends registry integration validation coverage for system assets so list/detail/graph/lineage views remain coherent for nested system-of-systems and versioned system lineage scenarios over real API + SQLite seams.
- Direction 5 stories 6.15â€“6.16 now keep System Studio runtime observability bounded and API-driven inside the existing run-trigger extension: `SystemRuntimeRunPanel` composes `ExecutionMonitorPanel` + `ExecutionResultPanel` (status/progress/node + nested-system state, bounded trace/log, recovery indicators, result/output/node/nested summaries, and diagnostics) sourced from `getSystemExecutionStatus/getSystemExecutionTrace/getSystemExecutionResult` without renderer-side runtime/result re-derivation.
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
- Run interface routing now supports a workflow context (`context=workflow` + workflow id/status) and resolves into canonical Workflow Studio open/resume entry paths for run-oriented handoff.
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

- Dataset Studio draft authoring now includes a stage-based wizard panel (`ui/components/assets/DatasetStageWizardPanel.tsx`) rendered through the existing registration-based shell extension path (`DatasetStudioRegistration`).
- Wizard UI state/orchestration stays out of React components through a dedicated adapter seam (`ui/studio-shell/dataset/DatasetStageWizardStateAdapter.ts`) that wraps `WizardFlowEngine` for snapshot/read/update/navigation behavior.
- Stage progress/navigation UI is now reusable in `ui/components/wizard/StageWizardProgressNavigator.tsx`, with explicit current/completed/skipped/pending/disabled stage cues.
- Stage rendering uses progressive disclosure:
  - simple stage-specific config renderers for source/ingestion stages,
  - fallback stage summary renderer for non-customized stages,
  - optional advanced metadata disclosure for inspectability/lineage-focused details.
- Styling reuses existing wizard/card/field classes and extends shared wizard styles (`ui/styles/components/wizard.css`) with reusable stage-wizard classes (no stage-specific element selectors).


## Direction 5 UI extension update: Stage-aware dataset canvas graph + editing foundations (stories 15E.11-15E.12)

- Dataset Studio now has a dedicated stage-canvas projection seam in `application/dataset-studio/StageCanvasGraphProjectionService.ts` that projects canonical stage flow/runtime state into a canvas graph model (stage groups, underlying asset nodes, and stage-flow edges) without introducing a parallel domain graph.
- Projection supports wizard-backed runtime state, template-instantiated stage flows, and saved stage-flow definitions through one contract path, preserving stage ordering/dependency semantics and inspectable stage/node metadata.
- Stage grouping metadata now includes stage name/description/status, execution mode, asset-count/shape summaries, runtime config/output payloads, and runtime-tracking hooks for later inspection/editor expansion.
- Stage-aware editing is now centralized in `application/dataset-studio/StageCanvasEditingService.ts` (reorder validation, optional stage add/remove validation, stage config updates, compatibility checks, and graph regeneration) instead of UI-local domain mutations.
- Dataset stage authoring UI now exposes a shared Wizard/Canvas surface (`ui/components/assets/DatasetStageAuthoringPanel.tsx`) with one adapter-backed source of truth (`DatasetStageWizardStateAdapter` wrapping `WizardFlowEngine`) so wizard and canvas remain synchronized.
- Canvas rendering for dataset stages now uses `@xyflow/react` (`ui/components/assets/DatasetStageCanvasReactFlow.tsx`) and keeps business rules in adapter/service seams; UI handles selection and minimal edit affordances only.

## Direction 5 UI extension update: Stage inspection + persistence reload surfaces (stories 15E.13-15E.14)

- Dataset stage wizard/canvas views now render normalized stage inspection summaries produced by shared application adapters (not component-local derivation), including:
  - stage output summaries,
  - contract/type summaries,
  - preview availability/reference/fallback status,
  - propagated upstream lineage/storage metadata.
- Wizard now surfaces current-stage inspection plus previously completed/skipped stage inspection cards using the same adapter snapshot source used for navigation/configuration.
- Canvas inspector now renders stage-group inspection from the same projected model used by node/edge graph rendering, preserving wizard/canvas consistency.
- Dataset stage adapter (`ui/studio-shell/dataset/DatasetStageWizardStateAdapter.ts`) now supports persistence export/import via a thin bridge to application persistence service, and reconstructed wizard/canvas state remains synchronized through one rehydrated `WizardFlowEngine`.
- UI persistence controls in dataset stage authoring remain bounded to adapter-level save/reload actions; persistence mechanics stay outside React component business logic.

## Direction 5 UI extension update: Data Studio preparation wizard framework + stage rendering (stories 18.3-18.4)

- Data Studio now has a dedicated renderer adapter seam in `ui/studio-shell/data/DataStudioPreparationWizardStateAdapter.ts` over the application wizard engine (`application/data-studio/DataStudioPreparationWizard.ts`), keeping navigation/state/validation orchestration out of React components.
- A new stage-based authoring surface now renders in Data Studio via `ui/components/assets/DataStudioPreparationWizardPanel.tsx`:
  - metadata-driven stage navigation/progress rendering,
  - dynamic stage body rendering (stage-id keyed renderers + fallback renderer),
  - conditional/optional stage availability behavior from wizard snapshots,
  - simple/advanced presentation mode toggles,
  - wizard-to-canvas handoff summary from canonical authoring graph projection.
- Data Studio now includes toolbar alignment through shared shell toolbar contracts in `DatasetStudioRegistration` (`save-draft`, `run-validation`, `refresh-snapshot`) rather than bespoke per-panel toolbar logic.
- Stage progress status contracts are now shared through `ui/studio-shell/wizard/WizardStageContracts.ts` so stage-based wizard surfaces can reuse one status vocabulary (`current/completed/skipped/pending/disabled`) without dataset-specific type coupling.
- Data Studio node-palette behavior now uses a left-drawer pattern aligned with Workflow Canvas semantics (search + stage-focused selection), but mapped to Data Studio stage/assets context instead of workflow trigger/input/step/output node semantics.

## Direction 5 UI extension update: Data Studio intent templates + progressive disclosure (stories 18.5-18.6)

- Data Studio preparation now initializes from an intent-based template registry (`application/data-studio/DataStudioPreparationTemplates.ts`) with built-in ELT, analytics, document, and image templates.
- Template contracts are explicit and inspectable (id/version/intent/stage defaults/default asset-group bindings/conditional evaluators/field-visibility overrides), and template instantiation produces validated unified-preparation assets through existing stage/pipeline seams.
- Wizard initialization now supports template selection/reselection through the existing state adapter seam (`DataStudioPreparationWizard` + `DataStudioPreparationWizardStateAdapter`) without bypassing the canonical preparation asset model.
- Progressive disclosure is now metadata-driven at stage and field level:
  - stage availability still honors simple/advanced visibility + activation conditions,
  - field visibility uses descriptor metadata with simple/advanced flags, template targeting, and prior-input dependency conditions.
- Wizard-to-canvas compatibility is preserved: simplified wizard views hide complexity, but canonical stage/asset graph state remains available in the underlying unified-preparation definition and handoff projection.

## Direction 5 UI extension update: Data Studio persistent pipeline state + prepared storage integration (stories 18.7-18.8)

- Data Studio wizard state now supports export/import as a canonical persistent pipeline-state document through `application/data-studio/DataStudioPipelineState.ts` and `DataStudioPreparationWizard` state methods (`exportPipelineState`, `importPipelineState`), including stage state, asset-group bindings, transitions, navigation/progression metadata, and wizard/canvas compatibility projection hooks.
- Renderer adapter and panel wiring now consume that persistent contract (`DataStudioPreparationWizardStateAdapter`) and persist/reload authoring state via local storage (`DataStudioPreparationWizardPanel`), keeping wizard interactions aligned with non-UI-only draft/session behavior.
- Prepared output storage integration now has a dedicated application seam in `application/dataset-studio/PreparedStorageStageService.ts` and stage contracts in `StageIntegrationContracts.ts` (`PreparedStorageStageOutput`), with explicit prepared dataset identity/version, storage target/reference, upstream linkage, and lineage capture suitable for reuse across registry/canvas/read-model surfaces.

## Direction 5 UI extension update: Data Studio lineage/reuse + wizard-canvas handoff (stories 18.9-18.10)

- Data Studio prepared dataset lineage/reuse is now structured through explicit contracts in `domain/dataset-studio/PreparedDatasetLineage.ts` and application orchestration in `application/data-studio/DataStudioLineageAndReuseService.ts` (upstream source/asset/pipeline references, stage structure/dependencies, preparation context, and reusable prepared-dataset references).
- Persistent Data Studio pipeline state now carries first-class prepared lineage + reuse records (`preparedDatasetLineage`, `preparedDatasetReuse`) in `application/data-studio/DataStudioPipelineState.ts` rather than freeform provenance metadata.
- Prepared storage output contracts now include stage-structure and preparation-context lineage fields (`application/dataset-studio/StageIntegrationContracts.ts`, `PreparedStorageStageService.ts`) so prepared outputs remain inspectable and reusable across downstream systems.
- Wizard-to-Canvas handoff now projects stage-aware canvas metadata through `application/data-studio/DataStudioWizardCanvasProjectionService.ts` and `DataStudioPreparationWizardStateAdapter.toCanvasProjection()`, while preserving one shared underlying authoring graph from the wizard state.
- Data Studio authoring UI now exposes explicit Wizard/Canvas mode switching in `ui/components/assets/DataStudioPreparationWizardPanel.tsx` with a canvas projection surface (`DataStudioPreparationCanvasReactFlow.tsx`) over the same underlying wizard/pipeline state and stage-node palette semantics.

## Direction 5 UI extension update: Data Studio reusable stage UX + advanced editing entry points (stories 18.11-18.12)

- Data Studio stage authoring now uses reusable stage UX components in `ui/components/assets/data-studio/DataStudioStageUxComponents.tsx` (stage metadata/status surface, advanced editing actions, internals panel, and stage-aware node palette drawer) instead of one large panel-local implementation.
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

## Direction 5 UI update: Image system contracts + shared rendering utilities (stories 4.1.1-4.1.2)

- Internal image UI contracts are now centralized in `ui/components/assets/image-system/ImageUiContracts.ts` for upload panel, image viewer, parameter form, output gallery, and comparison view props/events/state/context references.
- Shared rendering helpers now live in `ui/components/assets/image-system/ImageRenderingUtils.ts` and provide bounded metadata normalization, fit/layout sizing, placeholder behavior, loading/lazy-load helpers, and selection-friendly rendering checks.
- A reusable render primitive `ImageRenderFrame` (`ui/components/assets/image-system/ImageRenderFrame.tsx`) now composes that contract/util layer, and existing renderer surfaces (`ui/components/assets/AssetViewer.tsx`, `ui/components/assets/DataPreviewSurface.tsx`) reuse it rather than ad hoc image branches.

## Direction 5 UI update: Image upload panel + single-image viewer (stories 4.1.3-4.1.4)

- Reusable image upload/view components now live in `ui/components/assets/image-system`:
  - `ImageUploadPanel` (drag/drop + picker + validation feedback + preview-friendly thumbnails),
  - `ImageViewer` (single-image frame + fit controls + bounded zoom + metadata overlay + selection + loading/empty/error states).
- Upload validation stays adapter-bounded and ingestion-contract aligned:
  - `ImageUiContracts` adds explicit upload validation/result contracts plus `ImageUploadIngestionAdapter`.
  - `BrowserImageUploadIngestionAdapter` maps browser `File` payloads through existing ingestion policy contracts (`FileIngestionPolicyService`) without coupling UI to a concrete ingestion pipeline implementation.
- Rendering remains aligned with stories 4.1.1-4.1.2:
  - `ImageViewer` composes shared render utilities and `ImageRenderFrame`.
  - `image-system/index.ts` now exports upload/viewer components and adapter seams for reuse in future result/history/comparison/gallery/detail panes.

## Direction 5 UI update: Image parameter form + output gallery (stories 4.1.5-4.1.6)

- Image parameter authoring now has a reusable schema-driven form component (`ui/components/assets/image-system/ImageParameterForm.tsx`) that:
  - renders from internal parameter contracts (`ImageParameterDefinition`) instead of hardcoded workflow-engine forms,
  - supports text/number/boolean/select/range controls with default values, required semantics, and bounded validation feedback,
  - emits value + validation issues through one contract event path (`ImageParameterFormEventContract`) for clean system/workflow binding.
- Image/workflow parameter mapping remains adapter-bounded via `ImageParameterMappers.ts`:
  - `mapAssetContractParametersToImageParameters` projects shared asset contract parameter descriptors into UI form definitions without coupling UI to a specific workflow runtime schema.
- Image output presentation now has a reusable gallery surface (`ImageOutputGallery.tsx`) that provides:
  - image collection rendering via shared `ImageRenderFrame`,
  - selection state/events, item-open events, and bounded dataset-context display,
  - loading/empty/error status states and bounded pagination (`pageSize`) for incremental display.
- `image-system/index.ts` now exports parameter-form/gallery/mapper seams alongside prior upload/viewer primitives so remaining image-system slices can compose one shared contract/rendering stack.

## Direction 5 UI update: Image comparison view + state integration (stories 4.1.7-4.1.8)

- Image comparison now has a reusable view component (`ui/components/assets/image-system/ImageComparisonView.tsx`) with bounded side-by-side and overlay modes, shared internal image view models, synchronized zoom/pan through a reusable viewport hook (`useSynchronizedImageViewport.ts`), and explicit loading/empty/error/selection/focus handling.
- Epic 4.1 image components now have an explicit state-integration seam (`ImageSystemStateIntegration.ts`) that keeps selected image, image collections, parameter values, dataset/system context references, and component interaction/loading/error state in one mapper/reducer path while projecting component-specific props for upload/viewer/parameter/gallery/comparison surfaces.

## AI Loom image manipulation update: output gallery contract + dataset-backed interface composition (stories 4.4.1-4.4.2)

- Interface-asset composition guidance is now explicit for the image slice:
  - **atomic interface assets** stay bounded/reusable (`ImageOutputGallery`, output detail/viewer pane, metadata summary panel, parameter summary panel),
  - **higher-level composed interface assets** bind those atomic assets to system context, workflow/runtime context, and system-owned dataset state.
- Added a canonical output gallery data contract in `application/system-runtime/OutputGalleryDataContract.ts` for persisted gallery rows with:
  - image reference + dataset instance linkage,
  - workflow/run linkage,
  - optional source-image linkage,
  - timestamps,
  - generation/transform parameter summary,
  - image metadata summary,
  - tags + derived attributes.
- Added dataset integration orchestration in `application/system-runtime/OutputGalleryDatasetIntegrationService.ts`:
  - retrieves image outputs from system-owned dataset instances through `SystemDatasetInstanceService`,
  - maps persisted records into the new gallery contract (no ad hoc renderer-local output state),
  - preserves inspectability/paging semantics for future media/document/system interface reuse.
- Added UI adapter seam `ui/components/assets/image-system/ImageOutputGalleryDataAdapter.ts`:
  - maps contract-backed gallery listings into reusable image interface state/view-models,
  - keeps UI components runtime/storage agnostic while grounding output gallery display in persisted dataset-backed state.

## AI Loom image manipulation update: run history model + persisted retrieval seams (stories 4.4.3-4.4.4)

- Added canonical run-history contracts in `application/system-runtime/ImageRunHistoryDataContract.ts`:
  - run/workflow execution references,
  - system/workflow asset references,
  - input/output image references,
  - output dataset-instance linkage,
  - parameter summary and execution status,
  - timestamps and bounded lineage fields (`parentRunId`, trigger linkage, output grouping).
- Added storage-agnostic run-history repository seams in `application/system-runtime/ImageRunHistoryRepository.ts` with in-memory implementation for application-layer orchestration/tests.
- Added `application/system-runtime/ImageRunHistoryService.ts` retrieval APIs for System Studio interface assets:
  - list prior runs (`listRuns`) with paging,
  - fetch a run plus linked outputs (`getRunWithLinkedOutputs`) by joining persisted run history and output-gallery dataset-backed records.
- Runtime output persistence now records run-history entries through the same image-output pipeline (`application/workflow-studio/WorkflowRuntimeOutputPersistenceService.ts`) when a run-history service is composed:
  - no renderer-local/transient history arrays,
  - no parallel output/history model detached from dataset-backed output records.
- Added SQLite persistence adapter `infrastructure/filesystem/system-runtime/SqliteImageRunHistoryRepository.ts` for durable run-history storage aligned with existing repository/migration patterns.

## AI Loom image manipulation update: output gallery + run history interface assets (stories 4.4.5-4.4.6)

- Added explicit atomic image interface assets in `ui/components/assets/image-system` for persisted output/history rendering:
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
- Styling remains aligned with shared image-surface primitives in `ui/styles/components/assets.css` and extends reusable class-based variants for list presentation and summary panels.

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

- Epic 4.1 image components now emit one standardized UI event envelope (`ImageUiEvent`) with typed event names/payloads in `ui/components/assets/image-system/ImageUiContracts.ts`, covering upload lifecycle, image selection/deselection, parameter change/submit/reset, gallery interactions, comparison target/mode changes, and viewer interactions.
- Component-side event emission is centralized through a reusable adapter seam (`ui/components/assets/image-system/ImageUiEventAdapters.ts`) so upload/viewer/form/gallery/comparison components remain workflow-runtime agnostic while still exposing structured context-rich events for later trigger mapping.
- Image component styling now reuses shared image-surface primitives in `ui/styles/components/assets.css` (`ui-image-surface*`, `ui-image-item-card*`, `ui-image-control-group`) to reduce duplicated panel/status/item/control styling across upload panel, viewer, parameter form, output gallery, and comparison view.

## Direction 5 UI update: UI trigger event contract + workflow adapter seam (stories 4.2.1-4.2.2)

- Workflow execution now has a reusable internal UI trigger contract in `application/workflow-studio/UiTriggerEventContract.ts`:
  - framework-agnostic event shape (`click`/`submit`/`selection`) with explicit source/context references and structured payload support,
  - normalization + validation helpers (`createUiTriggerEvent`, `validateUiTriggerEvent`) that reject malformed timestamps and reserved framework event keys (`nativeEvent`, `target`, `currentTarget`),
  - trigger-kind mapping (`mapUiTriggerKindToWorkflowSourceKind`) aligned with existing execution trigger source kinds.
- Trigger-to-workflow translation is now bounded in `application/workflow-studio/WorkflowUiTriggerEventAdapter.ts`:
  - matches normalized UI events against existing workflow manual trigger plans (`userButtonClick`, `userManual`, `userInitiatedRun`) without changing workflow trigger semantics,
  - emits normalized `WorkflowExecutionTriggerEntry` records for downstream validation/execution path reuse.
- Image-system UI surfaces now use a thin adapter seam in `ui/components/assets/image-system/ImageUiTriggerEventAdapter.ts`:
  - translates image component events into the shared UI trigger contract for bounded use cases (button-like gallery open, parameter submit, image selection),
  - keeps React/browser event details out of workflow-facing contracts, preserving easy library/component swap paths.

## Direction 5 UI update: Trigger binding extension + declarative UI trigger config (stories 4.2.3-4.2.4)

- Trigger execution entry contracts now include explicit UI-ready trigger metadata in `application/workflow-studio/WorkflowTriggerExecutionEntryService.ts`:
  - existing source kinds remain unchanged (`manual-user`, `temporal`, `state-data`),
  - entries can now carry `contextReferences` and `bindingMetadata` so runtime context preserves trigger source/type/payload plus binding lineage without adding a parallel trigger model.
- Declarative UI-to-workflow binding configuration is now an asset-level contract in `application/contracts/ImageWorkflowUiTriggerBindingConfiguration.ts`:
  - bindings are versioned/typed/validated and reference normalized UI event kinds (`click`, `submit`, `selection`) rather than raw browser/React events,
  - selectors cover `sourceComponentId` and optional `actionId`/`eventName`, then target workflow trigger ids/types.
- Image workflow assets now include `uiTriggerBindings` beside existing input/output binding configs (`ImageToImageWorkflowAsset`, `RestyleWorkflowAsset`, `EnhanceUpscaleWorkflowAsset`, `BatchTransformWorkflowAsset`), keeping UI-trigger wiring inspectable, versionable, and reusable.
- `application/workflow-studio/WorkflowUiTriggerEventAdapter.ts` now consumes declarative binding configs when provided and falls back to existing manual-trigger matching when absent, preserving compatibility with prior dataset/system/manual trigger semantics.

## Direction 5 UI update: Runtime UI-event dispatch + parameter passing (stories 4.2.5-4.2.6)

- Runtime dispatch is now implemented as an application-layer seam (`application/workflow-studio/WorkflowUiEventRuntimeDispatcher.ts`) that consumes normalized UI events, resolves declarative UI trigger bindings, and dispatches into the existing `WorkflowStudioApplicationService.runWorkflowDraftTriggered` path without replacing the trigger/runtime pipeline.
- Dispatch remains boundary-clean and asynchronous:
  - UI event normalization stays in `UiTriggerEventContract`/UI adapters,
  - binding lookup stays in `WorkflowUiTriggerEventAdapter`,
  - runtime handoff stays in the existing workflow execution service.
- UI-derived parameter passing now maps into workflow-facing contracts (runtime parameters, form values, selected image context, dataset references) via context patching in the dispatcher, so raw React/browser event objects do not leak into workflow execution.
- Trigger payload mapping now carries both normalized UI metadata and top-level event payload fields, enabling trigger-payload input bindings to resolve business keys directly.
- Dispatcher results now return structured dispatch records and inspectable issue codes (including blocking validation codes) for invalid/missing UI-derived parameters.
- Added tests cover dispatch behavior, no-match/error outcomes, payload normalization/mapping, and invalid input handling.

## AI Loom image manipulation update: lineage mini-view + system interaction space composition (stories 4.4.9-4.4.10)

- Added a minimal persisted lineage contract for image runs in `application/system-runtime/ImageRunLineageDataContract.ts`.
  - Scope is intentionally bounded for this slice: input image refs -> workflow/run -> output image refs -> output dataset instance.
  - Lineage is built from persisted run-history and output-gallery relationships (`ImageRunHistoryWithOutputs`) using stable identifiers.
- `ImageRunHistoryService` now exposes `getRunLineage(...)` as a retrieval seam over persisted state rather than UI-only graph assembly.
- Added a lightweight reusable atomic interface asset `ImageLineageMiniView` (`ui/components/assets/image-system/ImageLineageMiniView.tsx`) that renders inspectable lineage edges/nodes without introducing a graph-library-specific domain contract.
- Extended composed image interface assets for cohesive System Studio experience:
  - `ImageHistoryLinkedOutputInspectorAsset` now includes lineage inspection for the selected persisted run/output linkage.
  - `ImageResultHistoryInteractionSpaceAsset` composes run history, output gallery selection/inspection, history->output linking, and lineage mini-view into one system interaction space.
- Composition remains contract-first and reusable:
  - atomic assets keep narrow rendering contracts,
  - higher-level composed assets bind those atomics to persisted system-owned output/run relationships.

## Direction 5 UI extension update: configurable editing-surface canvas contract (systems stories 1-2)

- The reusable canvas experience contract now supports a neutral editing-surface model (`resolveEditingModel`) plus generic event callbacks (`onEditingEvent`) for node selection, create requests, movement, resize, and canvas commands.
- The shared configurable canvas renderer now includes reusable rectangular layout-node primitives (x/y + width/height + minimum size + resize handles + selection affordances) while staying prop-driven and callback-driven for studio adapters.
- System Studio canvas now consumes that reusable editing contract at adapter boundaries, with layout frame state owned in the authoring boundary and composition orchestration still routed through existing system services/components.

## Direction 5 UI extension update: viewport-ratio framed canvas + panel asset model (systems stories 3-4)

- The reusable canvas contract now includes a bounded design-frame mode (`CanvasSurfaceDesignFrameModel`) with explicit ratio/dimension inputs and bounded editing-area hints so authoring can target viewport-like proportions.
- Editing models now expose coordinate-space configuration (`absolute` or `normalized`) and the shared configurable canvas renderer scales node placement/resizing against the rendered design frame while emitting normalized coordinates when configured.
- System Studio draft content now persists canvas authoring metadata (`systemSpec.canvasAuthoring`) including design-frame settings and normalized panel bounds, preserving authored layout intent across different render sizes.
- Added reusable panel asset contracts (`PanelAssetContract` + runtime instance mapping) that define stable panel identity, page association, persisted bounds, user-facing metadata, content slots, and preview/runtime representation boundaries.
- System canvas adapter now maps layout nodes to those reusable panel contracts/runtime panel instances through shared seams rather than ad hoc studio-specific panel shape.
