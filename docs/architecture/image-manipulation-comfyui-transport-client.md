# Image Manipulation ComfyUI Transport Client

This note documents Story 3.2.2 for Feature 3 / Epic 3.2:
- concrete ComfyUI transport communication for translated execution submission
- bounded control operations for state query and cancellation signaling
- infrastructure-only isolation of Comfy transport details

## Canonical implementation seams

- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts`
- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts`
- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionAdapterComposition.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiOutputDiscoveryCollector.test.ts`

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

## Story 3.2.4 configuration and host composition extension

Adapter dependency and configuration management now has an explicit composition seam so ComfyUI execution wiring is host/infrastructure-owned instead of UI-owned:

1. Canonical configuration contract
- `ComfyUiExecutionAdapterConfig` (`src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts`) centralizes:
  - enable/disable behavior,
  - endpoint validation (`http`/`https`),
  - timeout defaulting,
  - capability-probe startup toggle,
  - required node-type declarations,
  - optional auth token ingestion.
- Environment-first resolution uses:
  - `AI_LOOM_COMFYUI_ADAPTER_ENABLED`
  - `AI_LOOM_COMFYUI_BASE_URL`
  - `AI_LOOM_COMFYUI_REQUEST_TIMEOUT_MS`
  - `AI_LOOM_COMFYUI_CAPABILITY_PROBE_ON_STARTUP`
  - `AI_LOOM_COMFYUI_REQUIRED_NODE_TYPES`
  - `AI_LOOM_COMFYUI_AUTH_TOKEN`
  - plus bounded compatibility fallbacks (`COMFYUI_BASE_URL`, `COMFYUI_TIMEOUT_MS`, `VITE_COMFYUI_BASE_URL`).

2. Concrete infrastructure composition helper
- `createComfyUiExecutionAdapterInfrastructure(...)` in
  `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts` creates and returns:
  - `ComfyUiTransportClient`
  - `ComfyUiRunExecutionTransportGateway`
  - `ComfyUiRunExecutionDispatchAdapter`
  - `ComfyUiImageManipulationCapabilityProbeAdapter`
- When adapter config is disabled, composition returns `undefined` and host startup continues without Comfy adapter registration.

3. Host bootstrap wiring
- Authoritative host dependencies stage now composes the ComfyUI execution adapter infrastructure and publishes it as startup artifact:
  - `AuthoritativeServerComfyUiExecutionAdapterArtifactKey`
  - file: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- This keeps Comfy execution dependency construction inside host composition and out of UI startup paths.

4. Sensitive connection detail handling
- Adapter auth token is consumed from server environment configuration only.
- Safe config snapshots expose `hasAuthToken` boolean instead of token value.
- Transport logging remains bounded to operational metadata and does not include credential payloads.

## Story 3.2.5 translation-dispatch integration hardening

Added controlled integration coverage for the concrete translation and dispatch path:

1. Supported template translation + dispatch success
- Confirms supported template translation outputs can be dispatched through
  `ComfyUiRunExecutionDispatchAdapter -> ComfyUiRunExecutionTransportGateway -> ComfyUiTransportClient`.
- Verifies submission payload shape at the transport boundary remains bounded (`client_id`, `prompt` only).

2. Invalid mapping behavior
- Confirms unsupported template translation fails with blocking diagnostics.
- Confirms failed translation does not dispatch to transport.

3. Backend unavailable behavior
- Confirms transport failures are normalized by the client as `transport-unavailable`, then projected by dispatch adapter as `ComfyUiRunExecutionDispatchError` (`dispatch-connectivity-failed`).

4. Malformed backend response behavior
- Confirms malformed prompt-submission responses normalize as transport `invalid-response`, then dispatch-level `dispatch-invalid-request-data`.

These checks are implemented in:
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`

## Story 3.3.2 dispatch failure normalization extension

Dispatch now maps transport and translation failures into one normalized adapter error:

1. Typed dispatch error boundary
- `ComfyUiRunExecutionDispatchError` is raised by `ComfyUiRunExecutionDispatchAdapter`.
- Carries normalized failure payload (`code`, `category`, `retryable`, safe summary/message, sanitized diagnostics).

2. Normalized failure categories on dispatch path
- connectivity/unreachable backend
- timeout
- translation mismatch / invalid graph binding
- invalid request/data failures
- missing-model dependency failures

3. Leak-prevention posture
- Raw transport exceptions are not passed directly upward from dispatch adapter.
- User-facing summary fields remain safe and backend-agnostic.
- Developer diagnostics preserve actionable context while redacting sensitive path/token-like content.

## Story 3.3.3 output discovery and collection extension

Added adapter-side output discovery + collection for completed ComfyUI jobs:

1. Transport history retrieval seam
- `ComfyUiTransportClient.queryPromptHistory(...)` reads `GET /history/{promptId}` and returns the prompt-scoped history entry for output inspection.
- Prompt-history retrieval remains infrastructure-only and does not surface raw transport DTOs to domain/application consumers.

2. Output discovery and collection seam
- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- Converts completed prompt history outputs into:
  - `ImageManipulationOutputDiscoverySnapshot`
  - `ImageManipulationCollectedExecutionResult`
- Captures:
  - output slot match (`matched` / `fallback` / `unmatched`),
  - image media metadata and deterministic descriptor identity,
  - temporary backend references (`backend-object-handle`) for later persistence handoff.

3. Partial/missing/malformed handling
- Missing outputs now return explicit `failed` collection with normalized `collectionFailure`.
- Malformed output artifacts (for example unsafe filesystem-like filenames) are skipped and returned as `partially-collected` with normalized `collectionFailure`.
- Collected records intentionally stay `not-persisted` with reason `awaiting-managed-asset-persistence`.

4. Composition wiring
- `createComfyUiExecutionAdapterInfrastructure(...)` now composes and returns `outputDiscoveryCollector` alongside dispatch + capability adapters.

### Known assumptions
- Story scope is image output discovery/collection only; non-image artifacts are not mapped in this adapter yet.
- Backend output handles are temporary transport references and are never treated as product asset identity.
- Output-slot matching uses backend-field/node-id heuristics with deterministic fallback by output order when exact node hints are unavailable.
