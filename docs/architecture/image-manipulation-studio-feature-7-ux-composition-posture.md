# Feature 7 / Epic 7.1 Story 7.1.4: Studio Architecture and UX Composition Posture

## Story alignment

- Feature 7: Image Manipulation Studio UX and End-to-End Vertical Flow
- Epic 7.1: Studio Flow Architecture, View Models, and UX Contracts
- Story 7.1.4: Document the studio architecture and UX-composition posture for Feature 7

## Purpose

Document the implementation-truth architecture posture for the image manipulation studio vertical slice so future UX refinements keep one authoritative end-to-end flow and do not reintroduce local shortcuts or duplicate truth sources.

This note composes Story 7.1.1 (interaction model), Story 7.1.2 (presenter contracts), and Story 7.1.3 (UX language) with the authoritative platform services delivered in Features 1-6.

## Canonical seams in this slice

Shared UX contracts and state:

- `src/ui/shared/images/ImageStudioInteractionModel.ts`
- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- `src/ui/shared/images/ImageStudioUxCopy.ts`

Runtime composition and state-mapping helpers:

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/studio-shell/image-manipulation/ImageManipulationSelectionState.ts`
- `src/ui/components/studio-shell/image-manipulation/ImageManipulationRunLifecycleState.ts`
- `src/ui/runtime/ImageManipulationRuntimeExecutionRequestMapper.ts`
- `src/ui/runtime/ImageManipulationRuntimeDatasetBindingService.ts`

Authoritative UI-to-platform service seam:

- `src/ui/services/StudioShellService.ts`
- `src/ui/services/RuntimeOperationsService.ts`

## Feature 7 composition over Features 1-6

Feature 7 is a UX-composition layer over already-authoritative service capabilities:

1. Feature 1 (`image-asset`) provides authoritative upload/list/retrieval identity and protected access semantics for user-provided images.
2. Feature 2 (`image-workflow` and `image-system`) provides authoritative workflow/system definition and parameter contracts.
3. Feature 3 (`execution adapter`) provides normalized readiness/execution capability and provider-boundary translation.
4. Feature 4 (`run orchestration`) provides authoritative run lifecycle, queue/dispatch lifecycle truth, and run status/history APIs.
5. Feature 5 (`execution nodes`) provides readiness and eligibility context for where runs can execute.
6. Feature 6 (`generated results`) provides authoritative output persistence, preview-safe retrieval, and lineage records.

Feature 7 must not replace these truths. It composes them into a product-ready studio journey.

## End-to-end UX flow ownership model

The canonical journey remains:

1. Choose image
2. Choose edit
3. Adjust settings
4. Check readiness
5. Start edit
6. Track progress
7. Review results

For each stage, UI behavior is derived from authoritative data plus bounded transient draft state:

- Authoritative state: selected input/workflow, committed parameters, readiness snapshots, active run/history, persisted results.
- Transient state: draft edits, in-flight request flags, focused step, local selection emphasis.
- Derived state: step gates, current step, launch/review eligibility, run monitor posture.

`ImageStudioInteractionModel` remains the canonical split and transition/invalidation authority.

## Responsibility boundaries

### Shared UI state (`ImageStudioInteractionModel`)

Owns:

- canonical flow sequence and gating logic
- reducer transitions and downstream invalidation rules
- authoritative vs transient vs derived state partition
- continuation/reopen step resolution behavior

Does not own:

- transport mapping
- network calls
- component rendering

### Presenters and view models (`ImageStudioPresenterContracts`, `ImageStudioUxCopy`)

Own:

- mapping interaction state + authoritative snapshots into stable surface view models
- centralized `loading|empty|error|ready|degraded` state vocabulary
- blocker-code to user-message translation
- primary action derivation and advanced-diagnostics projection

Do not own:

- API call orchestration
- persistence mutations
- low-level component event wiring

### Components (`ImageManipulationRuntimeEditorPanel` and related UI surfaces)

Own:

- layout and interaction controls (upload, selection, parameter input, run actions, preview/gallery rendering)
- dispatching user intents to services
- rendering presenter/state outputs and advanced details

Do not own:

- authoritative domain truth
- cross-service identity semantics
- raw provider protocol logic

### API hooks/services (`StudioShellService`, `RuntimeOperationsService`, and future hook wrappers)

Own:

- authoritative API invocation boundaries and response decoding
- transport-level request/response plumbing into UI-safe return types
- host bridge routing (desktop bridge vs browser fallback bridge adapter)

Do not own:

- feature-step gating logic
- UI copy policy
- component-local interaction decisions

When React hooks are added for these services, hooks should remain thin wrappers around service seams and should not duplicate interaction-model or presenter logic.

## Authoritative-orchestration posture

Required posture:

- All run launch, status, cancel, history, and output retrieval operations route through authoritative runtime/studio APIs.
- Readiness checks come from authoritative readiness endpoints/use cases.
- Output reuse and continuation route through authoritative dataset/output/run records.
- Result identity is logical asset/result identity, not filesystem/provider-local handles.

Prohibited shortcuts:

- direct UI-to-provider execution/status probing
- local-only run lifecycle state treated as canonical truth
- path-based input/output identity promoted over logical asset/result identity
- per-component ad hoc gate/state-machine logic that diverges from shared interaction model

## User-facing terminology posture

Primary non-technical terms are fixed in `ImageStudioUxCopy` and should remain the default rendering language:

- Choose image
- Choose edit
- Adjust settings
- Check readiness
- Start edit
- Track progress
- Review results

Technical vocabulary (`workflowId`, `systemId`, `runId`, node/adapter/backend details) stays available in advanced diagnostics, hidden by default.

## Continuation, reuse, and prior-work posture

Feature 7 continuation behavior depends on authoritative persisted context:

- reopening a prior session uses authoritative run/result history, not reconstructed local guesses
- completed runs with persisted outputs resolve directly into review/reuse behavior
- "reuse as input" operates on authoritative result/dataset records and lineage, not temporary preview data

## References (do not duplicate)

Feature and foundation notes referenced by this posture:

- `docs/architecture/image-asset-feature-1-final-baseline.md`
- `docs/architecture/image-workflow-system-persistence-and-repositories.md`
- `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`
- `docs/architecture/execution-readiness-node-availability-checks.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- `docs/architecture/image-manipulation-studio-interaction-model.md`
- `docs/architecture/image-manipulation-studio-presenter-contracts.md`
- `docs/architecture/image-manipulation-studio-ux-language-guidelines.md`

## Downstream refinement checklist

- Extend shared interaction/presenter seams first when adding new step behavior.
- Keep component changes composition-focused and avoid embedding business validation rules.
- Add API service methods for new authoritative operations instead of calling transport adapters directly from components.
- Preserve user-language consistency by extending `ImageStudioUxCopy` rather than adding ad hoc strings.

## Epic 7.2 Story 7.2.1: Primary image entry and selection experience

Story 7.2.1 hardens the "Choose image" phase into a production-backed entry flow by composing authoritative image-asset APIs with explicit UI states for upload, library discovery, and selection confirmation.

Implemented seams:

- `src/ui/services/ImageAssetManagementService.ts`
- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
- `src/ui/services/tests/ImageAssetManagementService.test.ts`

Entry-flow behavior:

- Users can start from either path:
  - upload a new source image through authoritative create-upload-finalize APIs, or
  - browse and reuse authorized existing image assets from recent history and a searchable/paged image library.
- The editor now shows explicit image-entry states:
  - upload in progress (`uploading`, `processing`),
  - library loading,
  - library empty,
  - library error,
  - selection confirmed.
- Selection confirmation is rendered with user-facing copy while preserving canonical identity under the hood (asset ids and metadata stay in service and runtime state, not raw storage paths).

Architecture and boundary notes:

- Library/recent listing continues to use `GET /api/v1/image-assets` with workspace/owner/status/origin filters through shared transport query conventions.
- UI does not expose backend-local paths or storage internals; users interact with filenames, timestamps, and actions ("Use as source"/"Use as face reference").
- Source/reference selection remains compatible with existing dataset-binding and run-request seams, so downstream workflow/readiness/result flows can extend without entry-flow rework.

## Epic 7.2 Story 7.2.2: Supported edit-type and workflow/system selection experience

Story 7.2.2 upgrades the "Choose edit" phase to present supported image manipulations as user-facing edit types while preserving authoritative workflow/system identity and reopening behavior.

Implemented seams:

- `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`
- `src/ui/components/studio-shell/SystemWorkflowSelectionPresenter.ts`
- `src/ui/components/studio-shell/tests/SystemWorkflowSelectionPresenter.test.ts`
- `src/ui/components/studio-shell/tests/SystemStudioWorkManagementPanel.test.tsx`

Selection-flow behavior:

- Users can start from supported edit types sourced from authoritative workflow-definition APIs.
- Edit-type options are rendered with user-friendly names/summaries from supported-template metadata; technical workflow jargon is no longer primary copy.
- Reopening saved systems remains first-class and is no longer constrained to the currently selected edit type filter, so prior work can always be resumed.
- Selected workflow/system identity continues to propagate through authoritative IDs (`workflowId`, `systemId`, version tags) and runtime-state updates; UI does not redefine template contracts locally.

UX-language and advanced-detail posture:

- Default surface language uses "edit type" terminology and guided summaries.
- Technical metadata (workflow IDs, operation kind, version tags) remains available only under explicit advanced details.
- Parameter defaults and configuration continue to hydrate from authoritative workflow definition metadata after selection/reopen.

## Epic 7.2 Story 7.2.3: Typed settings editor and saveable configuration UX

Story 7.2.3 hardens the "Adjust settings" phase into a typed, saveable, and reopen-safe configuration experience for image manipulation systems.

Implemented seams:

- `src/ui/components/studio-shell/SystemWorkflowParameterForm.tsx`
- `src/ui/components/studio-shell/SystemWorkflowParameterFormPresenter.ts`
- `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`
- `src/ui/components/studio-shell/tests/SystemWorkflowParameterForm.test.tsx`
- `src/ui/components/studio-shell/tests/SystemWorkflowParameterFormPresenter.test.ts`
- `src/ui/components/studio-shell/tests/SystemStudioWorkManagementPanel.test.tsx`

Settings UX behavior:

- Parameter controls are rendered from authoritative workflow parameter specifications (typed value kinds, validation bounds, options, defaults, required flags).
- Settings are grouped by section metadata (`ui.group`) and advanced groups are progressively disclosed (`ui.advanced`) instead of always-on technical clutter.
- Required indicators, help text, descriptions, and inline validation feedback are displayed in-place; default values are surfaced to reduce guesswork.
- Validation and persisted baseline shaping are constrained to declared workflow parameters so unsupported ad hoc keys are not treated as canonical configuration.

Save/reopen behavior:

- Save-as-new, update-existing, and reopen all update one canonical in-panel map of workflow parameter baselines keyed by workflow id.
- Draft runtime patches and image-system save/update calls reuse that same map, preventing stale draft-content snapshots from becoming a second configuration truth source.
- Reopen applies authoritative saved system workflow/version/parameter baselines and then synchronizes the active draft through the same authoritative mutation seam (`modifySystemDefinition`).

## Epic 7.2 Story 7.2.4: Readiness and launch-precheck UX for image runs

Story 7.2.4 hardens "Check readiness" and "Start edit" by surfacing authoritative launch-precheck information before run submission and clearly separating setup correctness from backend execution availability.

Implemented seams:

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/services/RuntimeOperationsService.ts`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
- `src/ui/services/tests/RuntimeOperationsService.test.ts`

Readiness/precheck behavior:

- The editor renders two readiness summaries:
  - setup precheck (input/configuration readiness),
  - execution-environment precheck (backend and node availability readiness).
- Setup blocking issues include missing source selection, missing source dataset binding, empty prompt, and authoritative config validation failures.
- Execution-environment readiness is loaded through the authoritative runtime readiness endpoint (`getExecutionReadiness`) using authenticated workspace context.
- Backend readiness issues are split into:
  - blocking issues (readiness errors, unavailable readiness, non-ready execution environment),
  - advisories (warning/degraded but still runnable conditions).
- Users can manually refresh execution precheck and see the latest authoritative `checkedAt` timestamp in friendly form.

Launch gating behavior:

- "Create image" is disabled while an active run is in progress.
- "Create image" is disabled while execution readiness is actively being checked.
- "Create image" is disabled whenever setup or backend precheck has blocking issues.
- "Create image" remains enabled when only advisories exist and readiness is otherwise launchable.

Architecture posture preserved:

- UI does not infer backend availability using local heuristics.
- Readiness truth stays in authoritative run/node readiness services (Features 4 and 5), with UI acting as presenter and gate consumer.

