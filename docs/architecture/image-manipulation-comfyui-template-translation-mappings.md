# Image Manipulation ComfyUI Template Translation Mappings

This note documents Story 3.2.1 for Feature 3 / Epic 3.2:
- concrete translation of supported image workflow templates into ComfyUI-executable request payloads
- deterministic template-to-prompt mapping behavior
- structured diagnostic behavior for unsupported or invalid translation requests

## Canonical implementation seams

- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyImageManipulationTemplateTranslationAdapter.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.test.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`

## Translation boundary posture

- Input is the authoritative translation request contract containing Feature 2 workflow/system identity and bindings.
- Output is a backend-execution payload that includes a ComfyUI-ready request object at `inputs["comfy.request"]`.
- Backend payload assembly is isolated to infrastructure adapter code.
- Unsupported/invalid mappings return failed results with structured diagnostics and blocking/error severity.

## Supported template mappings

1. `image-template:image-to-image-restyle:v1`
- required inputs: `inputs.source-image`
- required parameters: `parameters.prompt`, `parameters.variation-strength`
- required outputs: `outputs.generated-image`
- Comfy request graph core nodes: `LoadImage`, `CheckpointLoaderSimple`, `CLIPTextEncode`, `VAEEncode`, `KSampler`, `VAEDecode`, `SaveImage`

2. `image-template:enhance-upscale:v1`
- required inputs: `inputs.source-image`
- required parameters: `parameters.scale-factor`
- required outputs: `outputs.enhanced-image`
- Comfy request graph core nodes: `LoadImage`, `ImageScaleBy`, `SaveImage`

3. `image-template:mask-guided-edit:v1`
- required inputs: `inputs.source-image`, `inputs.mask-image`
- required parameters: `parameters.prompt`
- optional parameters: `parameters.preserve-unmasked-areas`
- required outputs: `outputs.edited-image`
- Comfy request graph core nodes: `LoadImage` (source + mask), `CheckpointLoaderSimple`, `CLIPTextEncode`, `VAEEncode`, `SetLatentNoiseMask`, `KSampler`, `VAEDecode`, `SaveImage`

## Diagnostic behavior

Structured diagnostics currently include:
- `unsupported-template-id` (`template-resolution`)
- `operation-template-mismatch` (`template-resolution`)
- `missing-required-slot-binding` (`slot-binding`)
- `missing-required-parameter-mapping` (`parameter-mapping`)
- `missing-required-output-expectation` (`output-mapping`)
- parameter guardrail diagnostics such as invalid variation strength or scale factor

Blocking diagnostics force a failed translation result.

## Architectural constraints preserved

- Workflow/system definitions remain the source of truth.
- ComfyUI graph/payload details are not promoted into domain/application records.
- Translation and provider payload construction stay behind infrastructure adapters.

## Story 3.2.5 integration coverage extension

- Added integration coverage for translation and dispatch together using controlled backend scenarios:
  - supported-template translation followed by successful dispatch transport submission
  - unsupported template mapping with blocking diagnostics and dispatch short-circuit
  - backend unavailable dispatch failure normalization
  - malformed backend response normalization for prompt submission
- Coverage ensures translation diagnostics remain meaningful and dispatch wiring regressions are caught without relying on uncontrolled external backend state.
