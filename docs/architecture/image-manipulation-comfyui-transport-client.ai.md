# AI Companion: Image Manipulation ComfyUI Transport Client

## What this slice adds

Story 3.2.2 adds a concrete infrastructure transport client for ComfyUI dispatch/control operations on the image manipulation execution path.

## Canonical files

- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionCancellationAdapter.ts`
- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts`
- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionAdapterComposition.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiOutputDiscoveryCollector.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionCancellationAdapter.test.ts`
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

## Story 3.3.2 dispatch failure normalization update
- `ComfyUiRunExecutionDispatchAdapter` now maps transport/translation failures into normalized dispatch errors:
  - `ComfyUiRunExecutionDispatchError`
  - normalized `failure` payload aligned to image-manipulation execution failure contracts
- Dispatch normalization now distinguishes:
  - backend connectivity/unreachable
  - timeout
  - translation mismatch / invalid graph binding (`comfy.request` mapping failures)
  - invalid request/data failures
  - missing-model dependency failures surfaced through transport diagnostics
- User-safe summaries/messages are separated from sanitized developer diagnostics before errors cross the adapter boundary.

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

## Story 3.2.4 config + dependency composition layer

### Added behavior

- Added explicit Comfy adapter config seam at
  `src/infrastructure/config/ComfyUiExecutionAdapterConfig.ts` with:
  - enable/disable control,
  - endpoint URL validation and normalization,
  - timeout defaulting,
  - required-node declarations,
  - capability-probe startup toggle,
  - optional auth token ingestion.
- Added canonical composition helper at
  `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts` that builds:
  - `ComfyUiTransportClient`
  - `ComfyUiRunExecutionTransportGateway`
  - `ComfyUiRunExecutionDispatchAdapter`
  - `ComfyUiImageManipulationCapabilityProbeAdapter`
  from one validated config object.
- Authoritative host dependencies stage now composes this infrastructure and exposes it as startup artifact:
  `AuthoritativeServerComfyUiExecutionAdapterArtifactKey`
  in `src/hosts/server/AuthoritativeServerCompositionRoot.ts`.

### Security + maintainability posture

- Sensitive connection details stay in server-side env/config composition and are not pushed into UI code.
- Safe config snapshots expose `hasAuthToken` only, not token values.
- Transport requests can include auth token as bearer header without changing application contracts.

## Story 3.2.5 translation and dispatch integration coverage

### Added behavior

- Added end-to-end infrastructure integration coverage at
  `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
  for translation output handoff into concrete Comfy dispatch transport.

### Scenarios covered

- Supported template set translates and dispatches successfully through:
  `ComfyImageManipulationTemplateTranslationAdapter` ->
  `ComfyUiRunExecutionDispatchAdapter` ->
  `ComfyUiRunExecutionTransportGateway` ->
  `ComfyUiTransportClient`.
- Invalid translation mapping emits blocking diagnostics and short-circuits dispatch.
- Backend unavailable submission normalizes to `ComfyUiTransportClientError` (`transport-unavailable`).
- Malformed backend submission response normalizes to `ComfyUiTransportClientError` (`invalid-response`).
 - Dispatch adapter projects those transport failures into normalized `ComfyUiRunExecutionDispatchError` categories/codes (`dispatch-connectivity-failed`, `dispatch-invalid-request-data`) for orchestration-facing behavior.

### Boundary posture preserved

- Application/domain remain unaware of raw Comfy payload internals; integration assertions verify dispatch receipts stay normalized and do not surface prompt-graph payload data.

## Story 3.3.3 output discovery + collection coverage

### Added behavior

- `ComfyUiTransportClient` now exposes `queryPromptHistory(...)` for prompt-scoped history reads (`GET /history/{promptId}`) used by output discovery.
- Added `ComfyUiOutputDiscoveryCollector` at:
  - `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- Collector maps completed Comfy prompt outputs into canonical contracts:
  - `ImageManipulationOutputDiscoverySnapshot`
  - `ImageManipulationCollectedExecutionResult`

### Mapping semantics

- Discovers image output artifacts from prompt history outputs.
- Captures slot matching (`matched` / `fallback` / `unmatched`) using expected output bindings.
- Emits image media metadata and temporary backend references (`backend-object-handle`).
- Collection records remain `not-persisted` with reason `awaiting-managed-asset-persistence` to preserve separation from final logical asset identity.

### Abnormal scenario handling

- Missing discoverable image outputs -> explicit `failed` collection + normalized `collectionFailure`.
- Malformed/unsafe output references -> `partially-collected` + normalized `collectionFailure`.
- Backend layout details remain adapter-only metadata and never become product source of truth.

### Composition update

- `createComfyUiExecutionAdapterInfrastructure(...)` now composes and returns `outputDiscoveryCollector` alongside dispatch/capability seams.

### Known assumptions

- Story scope is image output discovery/collection only; non-image artifacts are out of scope here.
- Slot matching uses backend-field/node-id hinting with deterministic order fallback when exact hints are unavailable.

## Story 3.3.4 cancellation and cleanup behavior

### Added behavior

- Added `ComfyUiExecutionCancellationAdapter` implementing
  `IImageManipulationExecutionCancellationPort` with normalized cancellation outcomes:
  - `accepted`
  - `already-terminal`
  - `not-supported`
  - `rejected`
  - `not-found`
  - `failed`
- Adapter maps Comfy transport failures into normalized failure diagnostics attached to cancellation result details, using the shared image-manipulation failure normalization utility.

### Cleanup behavior

- `ComfyUiOutputDiscoveryCollector` now tracks adapter-managed temporary output references discovered during collection.
- Added explicit cleanup operation:
  - `releaseTemporaryReferences(...)`
- Cancellation flow invokes this cleanup as best effort and reports cleanup status (`completed` / `none` / `degraded`) in cancellation result details.

### Guarantees and limitations

- Cancellation guarantee is best effort via ComfyUI `POST /interrupt` semantics.
- Cleanup guarantee is limited to adapter-local tracked temporary reference state; it does not guarantee deletion of backend-generated files or runtime-global Comfy queue side effects.
- Degraded cleanup is explicit and observable in result details so higher layers can choose retry/reconciliation behavior without hidden partial-state assumptions.
