# AI Companion: Feature 7 Studio Architecture and UX Composition Posture (Story 7.1.4)

## Scope

Story 7.1.4 documents how Feature 7 composes the image-manipulation studio into a finished end-to-end UX using authoritative platform services from Features 1-6.

## Canonical seams

- Shared flow/state contracts: `src/ui/shared/images/ImageStudioInteractionModel.ts`
- Shared presenter/view-model + copy contracts: `src/ui/shared/images/ImageStudioPresenterContracts.ts`, `src/ui/shared/images/ImageStudioUxCopy.ts`
- Runtime/editor composition: `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- Selection/lifecycle state helpers: `src/ui/components/studio-shell/image-manipulation/ImageManipulationSelectionState.ts`, `src/ui/components/studio-shell/image-manipulation/ImageManipulationRunLifecycleState.ts`
- Runtime request/dataset mapping: `src/ui/runtime/ImageManipulationRuntimeExecutionRequestMapper.ts`, `src/ui/runtime/ImageManipulationRuntimeDatasetBindingService.ts`
- Authoritative API seam: `src/ui/services/StudioShellService.ts`, `src/ui/services/RuntimeOperationsService.ts`
- Human architecture note: `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`

## Feature-composition posture

Feature 7 is composition, not replacement:

- Feature 1 = image-asset authority
- Feature 2 = workflow/system authority
- Feature 3 = execution adapter/readiness normalization
- Feature 4 = authoritative run lifecycle
- Feature 5 = node readiness/eligibility context
- Feature 6 = persisted generated results + preview/lineage

Studio UX must orchestrate these authorities and avoid local truth forks.

## Responsibility split

- Shared interaction state: step sequence, gate logic, transition invalidation, continuation resolution.
- Presenter/view models: surface state mapping (`loading|empty|error|ready|degraded`), primary action mapping, blocker-message mapping, advanced diagnostics projection.
- Components: render and collect user intent; do not define authoritative lifecycle truth.
- API hooks/services: invoke authoritative APIs and map transport payloads; do not own UX gate logic or copy policy.

If hook wrappers are added later, keep them thin over service seams and avoid duplicating interaction/presenter logic.

## Authoritative guardrails

Required:

- launch/status/cancel/history/results via authoritative APIs
- readiness from authoritative readiness endpoints/use-cases
- continuation/reuse from authoritative run/result/dataset records

Prohibited:

- direct UI-to-provider execution/status paths
- path-based or local-only identity treated as canonical
- per-component ad hoc flow state machines

## UX-language posture

Primary flow terms remain:

1. Choose image
2. Choose edit
3. Adjust settings
4. Check readiness
5. Start edit
6. Track progress
7. Review results

Technical IDs/backend terms remain advanced-only and hidden by default.

## Epic 7.2 Story 7.2.1 implementation update

Story 7.2.1 adds production-backed primary image entry/selection behavior for the "Choose image" stage:

- authoritative upload + finalize flow remains in `ImageAssetManagementService.uploadStudioSourceImage(...)`,
- authoritative recent + library discovery now includes a searchable/paged library listing seam (`listImageLibraryImageAssets(...)`),
- editor composition (`ImageManipulationRuntimeEditorPanel`) now surfaces explicit entry states:
  - upload in progress (`uploading` / `processing`),
  - library loading/empty/error/ready,
  - selection confirmation after source/reference selection.

Guardrails preserved:

- no raw backend path exposure in entry UX,
- logical image asset ids and metadata remain canonical identity state,
- reuse actions continue routing through authoritative metadata/content retrieval and ingestion seams rather than local shortcuts.

## Epic 7.2 Story 7.2.2 implementation update

Story 7.2.2 upgrades "Choose edit" so supported image manipulations are presented as user-facing edit types backed by authoritative workflow/system definitions.

Added seams:

- `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`
- `src/ui/components/studio-shell/SystemWorkflowSelectionPresenter.ts`
- `src/ui/components/studio-shell/tests/SystemWorkflowSelectionPresenter.test.ts`
- `src/ui/components/studio-shell/tests/SystemStudioWorkManagementPanel.test.tsx`

Implementation posture:

- edit-type options come from authoritative workflow-definition APIs (supported-template metadata),
- default UX copy favors edit-type language (name + summary) over raw workflow jargon,
- saved-system reopen remains first-class and is not gated by currently selected edit type,
- authoritative IDs (`workflowId`, `systemId`, versions) remain the persisted/runtime truth,
- technical metadata is kept in advanced details instead of primary UX copy.

## Epic 7.2 Story 7.2.3 implementation update

Story 7.2.3 upgrades "Adjust settings" and saved-configuration actions so users edit typed workflow parameters with clearer defaults/validation and can save/reopen without local truth drift.

Updated seams:

- `src/ui/components/studio-shell/SystemWorkflowParameterForm.tsx`
- `src/ui/components/studio-shell/SystemWorkflowParameterFormPresenter.ts`
- `src/ui/components/studio-shell/SystemStudioWorkManagementPanel.tsx`
- `src/ui/components/studio-shell/tests/SystemWorkflowParameterForm.test.tsx`
- `src/ui/components/studio-shell/tests/SystemWorkflowParameterFormPresenter.test.ts`
- `src/ui/components/studio-shell/tests/SystemStudioWorkManagementPanel.test.tsx`

Implementation posture:

- typed controls are grouped into user-facing sections with progressive disclosure for advanced sections (`ui.group`, `ui.advanced` metadata),
- required indicators, default-value hints, help text, and validation feedback are rendered from authoritative workflow parameter contracts,
- validation and saved baselines are normalized to declared parameter specs (unknown ad hoc keys are excluded),
- save-as-new, update-existing, and reopen flows now reuse one in-panel workflow-parameter map synchronized through authoritative APIs to avoid draft-content/studio-state divergence.

## Epic 7.2 Story 7.2.4 implementation update

Story 7.2.4 hardens "Check readiness" and "Start edit" with authoritative launch prechecks that distinguish setup problems from execution-environment availability.

Updated seams:

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/services/RuntimeOperationsService.ts`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
- `src/ui/services/tests/RuntimeOperationsService.test.ts`

Precheck UX behavior:

- setup readiness and execution-environment readiness are rendered as separate precheck panels,
- setup issues are derived from authoritative config validation and required source/prompt state,
- backend readiness is fetched through the runtime execution-readiness API (workspace/session scoped),
- blocking issues and advisories are presented in separate lists for backend readiness,
- users can refresh precheck on demand and see the last authoritative check timestamp.

Launch gating posture:

- launch is blocked when setup has blocking issues,
- launch is blocked when backend readiness reports blocking issues or cannot be confirmed,
- launch is allowed when setup is valid and backend readiness is ready (including degraded-ready with advisories),
- no UI-local backend heuristics are used; gating honors authoritative readiness response semantics.

## Epic 7.3 Story 7.3.2 implementation update

Story 7.3.2 upgrades completed-run result handling into an in-context review workflow with before/after context and continuation quick actions.

Updated seams:

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/styles/components/assets.css`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageOutputPersistenceFlow.test.ts`

Result-review UX behavior:

- A dedicated `Result review` panel now appears in the runtime editor and keeps users in the same context after runs complete.
- The panel renders a before/after layout:
  - source preview ("Before"),
  - selected output preview ("After").
- Result/run status badges expose selected-result presence and linked authoritative run status.
- Lineage/settings details remain available behind a secondary details expander.

Authoritative quick-action behavior:

- `Use result as source` and `Use result as face reference` call authoritative dataset chaining (`chainReferenceImageDatasetItemToInput`) rather than local file/path shortcuts.
- `Refresh review` re-loads authoritative output collections and run history.
- `Rerun with changes` keeps the user in-context and guides directly back into launch flow without requiring manual navigation.

Architecture posture preserved:

- result review is still backed by authoritative result preview/list APIs (`listReferenceImageOutputs` / dataset listing),
- run linkage for review badges/details resolves from authoritative run history records (`listReferenceImageRunHistory`),
- no backend-local filesystem assumptions are introduced in result review or reuse actions.

## Epic 7.3 Story 7.3.3 implementation update

Story 7.3.3 adds continuity-focused recent-work and run-history continuation behavior so users can resume prior image work without restarting setup.

Updated seams:

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`

Recent-work continuity behavior:

- Runtime editor now renders a `Recent work` panel driven by authoritative saved-system listing (`listImageSystemDefinitions`).
- Entries expose compact summaries (title/readiness/updated timestamp) and a `Reopen setup` action.
- Reopen now loads authoritative system detail (`getImageSystemDefinition`) and applies it back to the active draft via authoritative modification (`modifySystemDefinition`) before refreshing runtime collections/history.

Run-history continuity behavior:

- Runtime editor now renders a dedicated `Run history` list from authoritative run-history records (`listReferenceImageRunHistory`).
- Each entry shows status, timestamp, output count, and summarized instruction context.
- `Open context` restores prior run context in-panel (selection focus + parameter snapshot when available).
- `Continue from output` chains run output back into input through authoritative dataset chaining (`chainReferenceImageDatasetItemToInput`), preserving lineage posture.

Architecture posture preserved:

- no local-only run/system cache assumptions are used for recent-work or run-history panels,
- continuation/reopen actions remain API-authoritative and draft-safe,
- backend filesystem/path shortcuts remain prohibited.

