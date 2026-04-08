# AI Companion: Initial Supported Image Workflow Set

## What this slice adds

Story 2.3.1 defines the initial supported workflow template set for authoritative image-workflow definition authoring.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`
- `src/application/image-workflows/CreateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/tests/InitialSupportedImageWorkflowTemplateRegistry.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`
- `docs/architecture/image-workflow-initial-supported-set.md`

## Initial supported operation set

- `image-to-image` (template family `image-template:image-to-image-restyle:v1`)
- `enhance-upscale` (template family `image-template:enhance-upscale:v1`)
- `mask-guided-edit` (template family `image-template:mask-guided-edit:v1`)

## Why this set

- High-value operations with clear runtime value for the vertical slice.
- Typed minimum input/parameter/output contracts per template family.
- Bounded scope that is translation-ready without overcommitting to broad advanced operations.

## Registration/discovery seam

`InitialSupportedImageWorkflowTemplateRegistry` provides:

- list all initial template families,
- resolve template by family id,
- resolve template by operation kind,
- validate whether an operation is in-scope for initial authoring.

## Authoring enforcement

`CreateImageWorkflowDefinitionUseCase` now blocks workflow creates whose `operationKind` falls outside the initial supported set.

This keeps downstream run-orchestration and translation stories aligned to stable assumptions.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-workflow-domain-foundation.md`
