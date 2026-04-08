# Image Manipulation ComfyUI Transport Client

This note documents Story 3.2.2 for Feature 3 / Epic 3.2:
- concrete ComfyUI transport communication for translated execution submission
- bounded control operations for state query and cancellation signaling
- infrastructure-only isolation of Comfy transport details

## Canonical implementation seams

- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`

## Transport scope

The concrete client currently supports:

1. Prompt submission (`POST /prompt`) with translated Comfy request payloads.
2. Prompt state query (`GET /history/{promptId}` with queue fallback `GET /queue`).
3. Cancellation signaling (`POST /interrupt`) with terminal-state short-circuit handling.

These operations are intentionally infrastructure-only and do not alter application contracts.

## Boundary posture

- Application/domain layers remain Comfy-agnostic and consume canonical dispatch/cancellation/state contracts.
- `ComfyUiRunExecutionDispatchAdapter` depends on `ComfyUiDispatchGateway` abstraction.
- `ComfyUiRunExecutionTransportGateway` is the concrete infrastructure gateway that binds that abstraction to the transport client.
- Raw fetch transport behavior and Comfy endpoint semantics remain inside `ComfyUiTransportClient`.

## Resilience and diagnostics assumptions

- Request timeout is explicit and enforced with `AbortController`.
- Transport failures, timeout failures, HTTP failures, prompt rejection failures, and invalid response failures are normalized into typed transport errors (`ComfyUiTransportClientError`).
- Logging is structured and bounded to safe operational metadata (operation, duration, status, code), without emitting raw prompt payloads.

## Constraints and extension points

- Cancellation uses ComfyUI `interrupt` semantics, which are runtime-global in Comfy; prompt-specific cancellation beyond this boundary is not assumed.
- Prompt-state reads use Comfy history first, then queue fallback, so orchestration can read state before completion records are persisted in history.
- Future progress streaming (WebSocket) can be added in `ComfyUiTransportClient` without changing application-layer dispatch contracts.
- Additional execution backends should continue to implement infrastructure gateway abstractions and avoid direct transport access from application logic.

## Story 3.2.3 health and capability probe extension

The concrete transport client now includes backend probe behavior for execution-readiness checks:

1. Reachability/Responsiveness probe
- Uses `GET /queue` as the baseline transport-safe probe to verify backend reachability and JSON responsiveness.

2. Capability probe
- Uses `GET /object_info` to discover available node types without dispatching a run.
- Compares discovered node types to required node capabilities for supported image workflow templates.

3. Normalized probe states
- `ready`: backend reachable and required capabilities present.
- `degraded`: backend reachable but capability discovery failed.
- `incompatible`: backend reachable but required capabilities are missing.
- `unavailable`: backend reachability/responsiveness probe failed.

4. Application-facing capability status mapping
- `ComfyUiImageManipulationCapabilityProbeAdapter` maps transport probe output into
  `IImageManipulationExecutionCapabilityPort` (`ImageManipulationExecutionBackendStatus`).
- Mapping keeps raw transport details inside infrastructure and emits normalized health/capability metadata suitable for readiness messaging and later run scheduling logic.
