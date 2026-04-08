# Initial Supported Image Workflow Set

This note documents Story 2.3.1 for Feature 2 / Epic 2.3: the initial production-ready workflow set for the image manipulation vertical slice.
Story 2.3.2 extends this set with translation-ready template metadata for adapter consumption.
Story 2.3.3 adds template-scoped defaults and reusable parameter presets so supported workflows are immediately usable without low-level tuning.
Story 2.3.4 extends the set with explicit compatibility/capability metadata and readiness evaluation seams for later scheduling, node capability checks, and translation backend selection.

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
- `InitialImageWorkflowTemplateDefinition.compatibility` for operation capability requirements, required input/output kinds, backend family identifiers, and readiness-check toggles.
- `InitialImageWorkflowTemplateDefinition.translation` for internal translation keys, capability hints, and mapping descriptors.
- `InitialImageWorkflowTemplateDefinition.configuration` for defaults, parameter guidance (recommended ranges + guardrails), and reusable preset profiles.

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

For Story 2.3.3 it also enforces configuration readiness by validating:

- default parameter values are present for all required parameters and match parameter value kinds,
- presets reference known parameters and can be resolved from defaults + preset overrides,
- parameter guidance exists for each supported parameter and carries user-facing helper text,
- recommended ranges and guardrails are structurally valid for later studio and system-binding flows.

For Story 2.3.4 it also enforces and exposes compatibility readiness by validating:

- required operation capability metadata is present,
- required input/output kinds include all required typed contract kinds,
- translation/backend family identifiers remain aligned with adapter-family metadata.

Registry consumption seams for downstream consumers:

- `resolveCompatibilityMetadataForOperationKind(...)` resolves canonical capability metadata by operation.
- `evaluateCompatibilityReadinessForOperationKind(...)` performs deterministic readiness checks against available operation capabilities, input/output kinds, and backend family availability.

## Defaults and presets UX role

Defaults and presets are now explicit template metadata, not UI-only constants:

- `configuration.defaults` provides initial render values for first-time form population.
- `configuration.presets` provides reusable profile bundles that can be selected now and later cloned into system baselines.
- `configuration.parameterGuidance` provides user-facing labels/help plus recommended ranges and hard guardrails.

`InitialSupportedImageWorkflowTemplateRegistry` additionally exposes preset/default resolution helpers so later system-binding and studio configuration flows can consume one authoritative source.

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
