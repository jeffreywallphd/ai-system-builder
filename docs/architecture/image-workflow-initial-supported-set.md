# Initial Supported Image Workflow Set

This note documents Story 2.3.1 for Feature 2 / Epic 2.3: the initial production-ready workflow set for the image manipulation vertical slice.
Story 2.3.2 extends this set with translation-ready template metadata for adapter consumption.

## Purpose

Lock down a concrete, typed, user-facing workflow set so downstream translation and execution stories build on stable assumptions instead of broad "any workflow" abstractions.

## Canonical implementation seams

- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry.ts`
- `src/application/image-workflows/CreateImageWorkflowDefinitionUseCase.ts`
- `src/application/image-workflows/tests/InitialSupportedImageWorkflowTemplateRegistry.test.ts`
- `src/application/image-workflows/tests/ImageWorkflowDefinitionAuthoringUseCases.test.ts`

Story 2.3.2 metadata seam:

- `InitialImageWorkflowTemplateDefinition.display` for user-facing labels and rationale.
- `InitialImageWorkflowTemplateDefinition.translation` for internal translation keys, capability hints, and mapping descriptors.

## Initial supported workflow template families

The initial set is intentionally constrained to three high-value operations:

1. `image-to-image` (`image-template:image-to-image-restyle:v1`)
2. `enhance-upscale` (`image-template:enhance-upscale:v1`)
3. `mask-guided-edit` (`image-template:mask-guided-edit:v1`)

`batch-transform` remains a modeled operation kind in broader contracts, but it is outside the initial Story 2.3.1 supported set for authoritative image-workflow definition authoring.

## Rationale by operation

### Image-to-image restyle

- Highest utility baseline for prompt-driven edits from one source image.
- Exercises core source-image input, parameterized conditioning, and generated-image output seams.
- Keeps early execution integration tractable with one primary source and bounded output contract.

Minimum required shape:

- Inputs: `sourceImage` (`source-image`, required)
- Parameters: `prompt` (text, required), `variationStrength` (float, required)
- Outputs: `generatedImage` (`generated-image`, required)

### Enhance/upscale

- Provides practical quality-improvement outcomes with a narrow and reliable contract.
- Avoids overexpansion into advanced multi-stage editing while still production-relevant.

Minimum required shape:

- Inputs: `sourceImage` (`source-image`, required)
- Parameters: `scaleFactor` (float, required)
- Outputs: `enhancedImage` (`generated-image`, required)

### Mask-guided edit

- Adds a realistic targeted-edit transformation for production workflows.
- Fits vertical slice direction by keeping edits localized and inputs explicit.

Minimum required shape:

- Inputs: `sourceImage` (`source-image`, required), `maskImage` (`mask-image`, required)
- Parameters: `prompt` (text, required), `preserveUnmaskedAreas` (boolean, optional)
- Outputs: `editedImage` (`generated-image`, required)

## Registration and discovery posture

`InitialSupportedImageWorkflowTemplateRegistry` is the authoritative in-process registration seam for this story:

- deterministic listing of all initial template families,
- lookup by template family id,
- lookup by operation kind,
- explicit `isOperationSupported(...)` guard for authoring validation.

For Story 2.3.2 it also enforces translation readiness by validating:

- non-empty translation identifiers (`translationKey`, `adapterFamily`, `operationTypeKey`),
- consistency between translation mappings and required input/parameter/output requirements,
- required asset role hints derived from required typed input slots,
- stable separation between display metadata and backend translation metadata.

These checks prevent silent drift between authoring templates and future adapter translation logic.

## Authoring boundary enforcement

`CreateImageWorkflowDefinitionUseCase` now enforces initial-set scope:

- category must remain `image-manipulation`,
- operation kind must be in the initial supported set.

This reduces ambiguity for later execution and translation stories by preventing unsupported operation authoring from entering authoritative workflow storage.

## Scope and non-goals

In-scope for Story 2.3.1:

- typed registration of initial workflow template families,
- explicit operation rationale and minimum input/parameter/output requirements,
- authoring-time enforcement for initial supported operations.

Out of scope:

- ComfyUI graph-level template payloads,
- run orchestration or execution adapter implementation,
- broad operation expansion beyond initial constrained set.

## Adapter consumption pattern (Story 2.3.2)

Downstream ComfyUI adapter implementation should:

1. Resolve a supported template from `InitialSupportedImageWorkflowTemplateRegistry`.
2. Use `translation` metadata + typed workflow/system definitions to build adapter-bound requests.
3. Resolve backend graph JSON/prompt payloads internally inside the adapter using translation keys.
4. Keep backend graph structure out of domain models, shared API contracts, and Studio-facing configuration.

## Related architecture notes

- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-workflow-domain-foundation.md`
- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/image-workflow-input-output-binding-contracts.md`
- `docs/architecture/image-workflow-parameter-specification-contracts.md`
