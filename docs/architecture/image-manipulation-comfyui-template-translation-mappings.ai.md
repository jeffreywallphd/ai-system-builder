# AI Companion: Image Manipulation ComfyUI Template Translation Mappings

## What this slice adds

Story 3.2.1 adds the concrete infrastructure translation adapter that maps supported image workflow templates to ComfyUI-ready request payloads using authoritative workflow/system translation contracts.

## Canonical files

- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyImageManipulationTemplateTranslationAdapter.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.test.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
- `docs/architecture/image-manipulation-comfyui-template-translation-mappings.md`

## Mapping summary

- `image-template:image-to-image-restyle:v1` maps source image + prompt + variation-strength to a Comfy graph with checkpoint load, prompt encoding, latent encode/sample/decode, and save.
- `image-template:enhance-upscale:v1` maps source image + scale-factor to `LoadImage -> ImageScaleBy -> SaveImage`.
- `image-template:mask-guided-edit:v1` maps source image + mask image + prompt (+ optional preserve flag) to a masked latent sampling flow (`SetLatentNoiseMask` + `KSampler`).

## Failure and diagnostics posture

Unsupported or invalid mappings return failed translation results with blocking diagnostics, including:
- unsupported template ids
- template/operation mismatches
- missing required input/parameter/output mappings
- parameter guardrail errors relevant to template translation

## Boundary posture

- Input remains authoritative Feature 2 workflow/system translation data.
- Comfy payload assembly remains infrastructure-only.
- Result payload includes Comfy-ready request content in `executionPayload.inputs["comfy.request"]` without making Comfy DTOs authoritative product records.

## Story 3.2.5 update

- Added integrated translation+dispatch regression coverage in
  `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`.
- New controlled scenarios validate:
  - successful translation and dispatch for the supported template set,
  - unsupported template diagnostics and dispatch short-circuit behavior,
  - backend-unavailable normalization (`transport-unavailable`),
  - malformed submission-response normalization (`invalid-response`).
- Coverage remains backend-state controlled by using mocked transport responses and does not depend on an external Comfy runtime.
