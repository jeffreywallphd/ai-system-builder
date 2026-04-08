# AI Companion: Feature 3 Final Baseline for ComfyUI Execution Adapter

## Purpose

Provide implementation-truth completion notes for Feature 3 so later run orchestration, node execution, and persistence work consume one stable boundary.

## Canonical source doc

- `docs/architecture/image-manipulation-feature-3-final-baseline.md`

## Completion summary

- Feature 3 establishes a contract-first ComfyUI execution boundary for image manipulation.
- Authoritative workflow/system definitions remain source of truth; Comfy payloads are derived and infrastructure-local.
- Dispatch, state/progress, cancellation, output discovery, and backend readiness/capability behavior are normalized through application ports.
- Authoritative readiness is exposed through backend API (`/api/v1/runtime/execution/readiness`) so UI/admin clients avoid direct provider probes.

## Canonical seams

Application contracts:

- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`
- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`

Infrastructure adapter seams:

- `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts`
- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionStatusNormalizer.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionCancellationAdapter.ts`
- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- `src/infrastructure/execution/comfyui/ComfyUiImageManipulationCapabilityProbeAdapter.ts`

## Required boundary posture for follow-on features

- Feature 4 (run orchestration): consume execution ports + readiness summaries; no direct transport-client or Comfy DTO coupling.
- Feature 5 (node-based execution): extend typed translation/mapping seams; do not bypass with provider-native payload generation in application/UI layers.
- Feature 6 (result persistence/lineage): treat discovered backend output references as temporary handles; persist only canonical logical assets/dataset records with lineage.

## Supported coverage snapshot

Supported translation templates:

1. `image-template:image-to-image-restyle:v1`
2. `image-template:enhance-upscale:v1`
3. `image-template:mask-guided-edit:v1`

Canonical normalized states:

- `queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`

## Known limits (explicit)

- Polling-based progress/readiness behavior (no streaming telemetry in this slice).
- Image-focused output discovery scope.
- Best-effort cancellation under Comfy interrupt semantics.
- No distributed scheduling/assignment or final persistence ownership in Feature 3.

## Regression coverage to keep green

- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionStatusNormalizer.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionCancellationAdapter.test.ts`
- `src/infrastructure/execution/tests/ComfyUiOutputDiscoveryCollector.test.ts`
- `src/infrastructure/execution/tests/ComfyUiImageManipulationCapabilityProbeAdapter.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionAdapterComposition.test.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.integration.test.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`

