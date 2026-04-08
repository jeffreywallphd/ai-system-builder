# AI Companion: Image Manipulation Execution Application Ports

## Source of truth
- Canonical human doc: `docs/architecture/image-manipulation-execution-application-ports.md`
- Canonical code seam: `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`

## Why this exists
- Story 3.1.1 requires backend-agnostic application execution ports for image manipulation.
- ComfyUI is an infrastructure adapter, not product truth.
- Run orchestration and image workflow/system services need stable execution contracts independent of backend transport payloads.

## Port groups
1. Dispatch:
- `IImageManipulationExecutionDispatchPort`

2. State query:
- `IImageManipulationExecutionStateQueryPort`

3. Progress:
- `IImageManipulationExecutionProgressPort` (poll + subscribe)

4. Cancellation:
- `IImageManipulationExecutionCancellationPort`

5. Outputs:
- `IImageManipulationExecutionOutputPort`

6. Health/capabilities:
- `IImageManipulationExecutionCapabilityPort`

## Contract posture
- Requests carry workflow translation metadata, system context, logical asset references, and output targets.
- State/progress/errors are normalized into AI Loom execution semantics.
- Outputs are normalized into logical reference kinds (`asset-reference`, `dataset-item-reference`, `storage-object-reference`, `external-url`, `inline-value`).
- No HTTP/WebSocket or Comfy DTO types are exposed in this application contract.

## Consumers
- Run orchestration use cases (dispatch, observe, cancel, finalize).
- Image workflow/system services that need backend execution as a port.
- Infrastructure adapters implementing ComfyUI or future execution providers.

## Story 3.1.2 translation bridge
- Feature 2 authoritative workflow/system definitions are translated through:
  - `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- Translation contract architecture note:
  - `docs/architecture/image-manipulation-translation-contracts.md`

## Story 3.1.3 normalized status/error contracts
- Canonical status/progress/completion/failure contracts are defined in:
  - `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- Architecture note:
  - `docs/architecture/image-manipulation-execution-status-contracts.md`

## Story 3.1.4 output discovery and collection contracts
- Canonical output-discovery and collected-result contracts are defined in:
  - `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- Architecture note:
  - `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`

## Story 3.1.5 ComfyUI adapter architecture and boundary rules
- Focused architecture note for execution-adapter layering and strict authority boundaries:
  - `docs/architecture/image-manipulation-comfyui-adapter-architecture-and-boundary-rules.md`
