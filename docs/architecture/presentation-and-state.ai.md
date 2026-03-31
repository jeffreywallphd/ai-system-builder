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
