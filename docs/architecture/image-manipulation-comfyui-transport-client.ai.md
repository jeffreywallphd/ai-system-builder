# AI Companion: Image Manipulation ComfyUI Transport Client

## What this slice adds

Story 3.2.2 adds a concrete infrastructure transport client for ComfyUI dispatch/control operations on the image manipulation execution path.

## Canonical files

- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`
- `docs/architecture/image-manipulation-comfyui-transport-client.md`

## Operational behavior

- Submission: sends translated `comfy.request` payloads to `POST /prompt` and returns prompt id as backend run id.
- State query: resolves prompt state via `GET /history/{promptId}` then falls back to `GET /queue`.
- Cancellation: issues `POST /interrupt` when prompt is non-terminal, returns already-terminal status when complete/failed/cancelled.

## Boundary posture

- Comfy transport stays infrastructure-only.
- Application/run orchestration continues to call abstractions (`ComfyUiDispatchGateway` / dispatch adapter seams).
- No direct UI-to-Comfy transport shortcuts are introduced.

## Reliability posture

- Enforces request timeout via `AbortController`.
- Normalizes failures as typed infrastructure transport errors (`ComfyUiTransportClientError`):
  - `request-timeout`
  - `transport-unavailable`
  - `http-error`
  - `prompt-rejected`
  - `invalid-response`
- Emits bounded structured transport logs without exposing raw prompt payload content.

## Extension points

- Add WebSocket progress streaming within `ComfyUiTransportClient` without changing application contracts.
- Add additional control operations (for example queue inspection expansion) in the same infrastructure seam.
- Keep future backend adapters aligned to abstraction-first dispatch gateways.

## Story 3.2.3 health + capability probes

### Added behavior

- `ComfyUiTransportClient` now exposes backend probe logic:
  - reachability/responsiveness via `GET /queue`
  - capability discovery via `GET /object_info`
  - required-node capability compatibility checks for supported workflow templates

### Normalized probe states

- `ready`
- `degraded`
- `incompatible`
- `unavailable`

These states are infrastructure-normalized and avoid leaking raw response payloads upward.

### Application-facing capability mapping

- Added `ComfyUiImageManipulationCapabilityProbeAdapter` to project probe results into
  `IImageManipulationExecutionCapabilityPort` / `ImageManipulationExecutionBackendStatus`.
- Health mapping remains app-contract compatible:
  - `ready -> healthy`
  - `degraded|incompatible -> degraded`
  - `unavailable -> unavailable`
- Readiness detail is carried in diagnostics for later node-assignment and UX readiness messaging.
