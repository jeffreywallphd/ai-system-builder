# AI Companion: Image Manipulation ComfyUI Adapter Architecture and Boundary Rules

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-comfyui-adapter-architecture-and-boundary-rules.md`

## Why this exists
- Story 3.1.5 requires explicit architecture rules for the ComfyUI execution adapter boundary.
- ComfyUI must remain infrastructure, not product truth.
- Later run orchestration and node-management stories need stable seams for translation, status/error normalization, and output collection.

## Canonical contract seams
- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`
- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`

## Comfy adapter implementation seams
- `src/application/execution/comfyui/ComfyAdapterContract.ts`
- `src/application/execution/comfyui/ComfyExecutionService.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyExecutionRequestMapper.ts`
- `src/infrastructure/comfyui/execution/mappers/ComfyExecutionResultMapper.ts`
- `src/infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`
- `src/infrastructure/comfyui/execution/ComfyQueueClient.ts`

## Boundary posture
- Workflow/system definitions and execution contracts are authoritative.
- Translation derives backend payloads; backend payloads never become domain records.
- Domain/application layers must not consume Comfy transport DTOs or queue/history semantics directly.
- Infrastructure adapter layers own provider payload mapping, transport communication, and normalization back into canonical contracts.
- UI/transport layers call application ports/use cases only; no direct UI-to-Comfy shortcuts.

## Normalization posture
- Canonical states remain: `queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`.
- Canonical failures remain structured: code/category/retryability + safe message + optional diagnostics.
- Output collection keeps temporary backend references separate from persisted logical assets.

## Related docs to reuse (do not duplicate)
- Feature 1:
  - `docs/architecture/workspace-foundation.md`
  - `docs/architecture/shared-asset-contracts.md`
  - `docs/architecture/storage-access-semantics.md`
- Feature 2:
  - `docs/architecture/image-workflow-system-definition-layer.md`
  - `docs/architecture/image-workflow-system-api-contracts.md`
- Feature 3:
  - `docs/architecture/image-manipulation-execution-application-ports.md`
  - `docs/architecture/image-manipulation-translation-contracts.md`
  - `docs/architecture/image-manipulation-execution-status-contracts.md`
  - `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`
  - `docs/architecture/image-manipulation-comfyui-template-translation-mappings.md`
- Comfy baseline:
  - `docs/architecture/comfyui-adapter-audit.md`
