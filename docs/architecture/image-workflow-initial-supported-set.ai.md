# AI Companion: Initial Supported Image Workflow Set

## What this slice adds

Story 2.3.1 defines the initial supported workflow template set for authoritative image-workflow definition authoring.
Story 2.3.2 adds translation-ready internal metadata for those template families so later adapter execution can map typed definitions into backend requests without treating backend graphs as product truth.
Story 2.3.3 adds template-level defaults and reusable presets so supported templates are immediately usable by non-technical users.

## Canonical files

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`
- `src/application/image-workflows/CreateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/tests/InitialSupportedImageWorkflowTemplateRegistry.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`
- `docs/architecture/image-workflow-initial-supported-set.md`

Story 2.3.2 metadata shape lives in:

- `InitialImageWorkflowTemplateDefinition.display` (user-facing text)
- `InitialImageWorkflowTemplateDefinition.translation` (internal translation metadata)
- `InitialImageWorkflowTemplateDefinition.configuration` (default values, parameter guidance, reusable preset profiles)

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

For Story 2.3.2 it also ensures each template stays translation-ready by validating:

- translation key presence and stable adapter operation identifiers,
- mapping descriptor consistency with required inputs/parameters/outputs,
- required asset-role hints derived from typed required inputs,
- separation between display metadata and translation identifiers.

This keeps authoring metadata and execution-translation metadata aligned without exposing runtime graph payloads.

For Story 2.3.3 it additionally validates:

- required parameters have default values,
- defaults/presets match parameter value kinds and known parameter ids,
- every supported parameter has user-facing guidance with recommended ranges and guardrails,
- preset ids are unique and resolvable for later system baseline cloning.

## Translation metadata consumption guidance

Later ComfyUI adapter work should consume only the `translation` metadata plus typed workflow definitions:

1. Resolve template family/operation from `InitialSupportedImageWorkflowTemplateRegistry`.
2. Use `translation.translationKey`, `translation.operationTypeKey`, and mapping descriptors to build adapter-bound request payloads.
3. Resolve concrete backend graph JSON strictly inside the adapter layer from internal adapter templates keyed by those identifiers.
4. Keep UI/API contracts on `display` + typed workflow/system models; never project adapter graph structure into user-facing contracts.

Preset/default consumption guidance:

1. Use `configuration.defaults` for initial parameter rendering.
2. Use `configuration.presets` as selectable profile starting points.
3. Use registry resolution helpers to merge defaults + preset overrides before writing system baselines.

## Authoring enforcement

`CreateImageWorkflowDefinitionUseCase` now blocks workflow creates whose `operationKind` falls outside the initial supported set.

This keeps downstream run-orchestration and translation stories aligned to stable assumptions.

## Related notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-workflow-domain-foundation.md`
