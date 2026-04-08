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

