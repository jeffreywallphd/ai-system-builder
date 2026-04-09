# AI Companion: Feature 2 Final Baseline

## Source of truth

- Canonical human doc:
  - `docs/architecture/image-workflow-feature-2-final-baseline.md`

## Why this exists

- Story 2.4.5 requires Feature 2 completion verification and explicit handoff guidance.
- This note summarizes the locked seams for agents/contributors extending execution and orchestration after Feature 2.

## Completion posture

- Feature 2 is complete as the authoritative workflow/system-definition layer for image manipulation authoring.
- Studio save/reopen now depends on authoritative workflow/system use cases, not UI-only state.
- Supported workflow set enforcement is explicit; unsupported placeholders are rejected.

## Canonical seams to preserve

- `src/infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `src/infrastructure/api/studio-shell/StudioImageSystemDefinitionSupport.ts`
- `src/application/image-workflows/CreateImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/UpdateImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/GetImageSystemDefinitionUseCase.ts`
- `src/application/image-workflows/ListImageSystemDefinitionsUseCase.ts`
- `src/application/image-workflows/ImageWorkflowSystemReadinessValidationService.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`
- `src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter.ts`

## Guardrails

- Keep workflow/system definition models as product source of truth.
- Keep ComfyUI/provider DTO payloads out of authoring contracts.
- Keep workflow selection constrained to supported operation templates.
- Keep readiness and compatibility feedback sourced from application/domain services.

## Verification anchors

- `src/infrastructure/api/studio-shell/tests/ImageWorkflowSystemDefinitionAuthoringE2E.integration.test.ts`
- `src/infrastructure/api/studio-shell/tests/ImageManipulationStudioVerticalSlice.integration.test.ts`
- `src/infrastructure/api/studio-shell/tests/StudioShellBackendApi.test.ts`
- `src/infrastructure/persistence/image-workflows/tests/SqliteImageWorkflowSystemPersistenceAdapter.test.ts`

## Follow-on dependency map

- Feature 3 (execution adapter/translation) must consume Feature 2 workflow/system bindings.
- Feature 4 (run orchestration) must treat Feature 2 readiness/compatibility as gating input.
- Feature 6 (result lineage/persistence) must anchor lineage to Feature 2 system/workflow identity/version references.
