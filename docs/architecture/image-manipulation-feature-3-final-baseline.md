# Feature 3 Final Baseline: ComfyUI Execution Adapter and Translation Layer

This document records completion status for Feature 3 in the image manipulation vertical slice and defines the production baseline for how ComfyUI is integrated as an infrastructure adapter.

Feature 3 is the bridge between authoritative typed workflow/system definitions and later run orchestration, node execution, and result persistence work.

## Baseline status

Feature 3 is implemented as a contract-first execution boundary:

- authoritative workflow/system definitions remain source of truth
- translation derives backend-executable payloads without promoting backend payloads into domain records
- dispatch, progress/state polling, cancellation, output discovery, and backend capability checks are exposed through application ports
- ComfyUI transport, queue/history payloads, and prompt/file details are isolated to infrastructure adapters
- authoritative readiness checks are exposed through backend API surfaces so callers avoid direct provider probing

## What Feature 3 provides

### 1. Established application ports and translation seams

Canonical application contract seams:

- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`
- `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`

These are the required consumption seams for orchestration and studio callers. New work should extend these contracts rather than introducing provider-owned contracts upstream.

### 2. Adapter implementation and host composition seams

Canonical ComfyUI infrastructure seams:

- `src/infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition.ts`
- `src/infrastructure/execution/comfyui/ComfyUiTransportClient.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionTransportGateway.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionStatusNormalizer.ts`
- `src/infrastructure/execution/comfyui/ComfyUiExecutionCancellationAdapter.ts`
- `src/infrastructure/execution/comfyui/ComfyUiOutputDiscoveryCollector.ts`
- `src/infrastructure/execution/comfyui/ComfyUiImageManipulationCapabilityProbeAdapter.ts`

Host wiring and authoritative backend exposure:

- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/ui/shared/runtime/RuntimeControlClient.ts`

### 3. Health/readiness behavior

Feature 3 normalizes backend readiness into canonical readiness states and issues:

- readiness states: `ready`, `degraded`, `unavailable`
- backend health mapping: `healthy`, `degraded`, `unavailable`
- capability compatibility checks: supported operation kinds + translation contract versions
- authoritative readiness endpoint: `GET /api/v1/runtime/execution/readiness`

The readiness route is the required integration path for studio/admin readiness UX. Direct UI-to-Comfy probes are an architecture violation.

### 4. Normalization rules (status, errors, outputs)

Status normalization:

- canonical execution states: `queued`, `preparing`, `running`, `completed`, `failed`, `cancelled`
- provider-specific state strings and queue/history details are interpreted only in infrastructure normalizers

Error normalization:

- stable failure code/category/retryability + user-safe summary/message
- provider diagnostics are sanitized and attached as diagnostics metadata, not promoted as product-facing truth

Output normalization:

- discovery returns normalized descriptors and temporary backend references
- temporary backend references are not logical asset identity
- collected results remain persistence-pending until Feature 6 persistence paths materialize managed records

### 5. Current supported workflow coverage

Comfy template translation currently supports:

1. `image-template:image-to-image-restyle:v1` (`image-to-image`)
2. `image-template:enhance-upscale:v1` (`enhance-upscale`)
3. `image-template:mask-guided-edit:v1` (`mask-guided-edit`)

Operation/template mismatch and missing required mappings fail translation with blocking diagnostics.

## Consumption contract for later features

### Feature 4 (run orchestration)

Feature 4 must:

- dispatch through run/application ports and Comfy dispatch adapters, not transport client calls
- consume normalized state/failure/output snapshots from execution ports
- use authoritative readiness summaries before scheduling/dispatch decisions
- keep lifecycle orchestration logic provider-agnostic and avoid Comfy queue/history DTO coupling

### Feature 5 (node-based execution)

Feature 5 must:

- treat Feature 3 translation seams as the only provider graph-payload derivation boundary
- keep node-execution planning/modeling in typed internal contracts; provider node names stay infrastructure-local
- extend adapter mappers/composition instead of bypassing with ad hoc backend payload generation

### Feature 6 (result persistence and lineage)

Feature 6 must:

- treat output discovery references as temporary handles only
- materialize persisted outputs as workspace-safe logical assets/dataset records with canonical run/workflow lineage
- preserve normalized failure/partial-output semantics in persistence outcomes
- avoid backend path/object-handle identity leakage into persisted product records

## Known limits and intentional non-goals

Known limits:

- capability probing is currently request/response (no streaming readiness telemetry)
- progress updates are polling-based; streaming progress is not implemented in this slice
- output discovery is image-focused and intentionally bounded
- cancellation is best effort under Comfy `interrupt` behavior and cannot guarantee prompt-specific hard-stop semantics

Intentional non-goals for Feature 3:

- distributed scheduling, queue arbitration, or run ownership policy logic
- node-level execution planner/orchestrator semantics beyond existing translation/adapter boundaries
- final persistence/lineage ownership rules beyond normalized collection outputs
- UI-direct provider communication paths

## Verification coverage and cross-references

Primary Feature 3 execution/adapter coverage:

- `src/infrastructure/execution/tests/ComfyUiTransportClient.test.ts`
- `src/infrastructure/execution/tests/ComfyUiRunExecutionTransportGateway.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiTranslationDispatch.integration.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionStatusNormalizer.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionCancellationAdapter.test.ts`
- `src/infrastructure/execution/tests/ComfyUiOutputDiscoveryCollector.test.ts`
- `src/infrastructure/execution/tests/ComfyUiImageManipulationCapabilityProbeAdapter.test.ts`
- `src/infrastructure/execution/tests/ComfyUiExecutionAdapterComposition.test.ts`
- `src/infrastructure/comfyui/execution/tests/ComfyImageManipulationTemplateTranslationAdapter.integration.test.ts`

Application contract/readiness coverage:

- `src/application/image-workflows/tests/ImageManipulationExecutionPorts.test.ts`
- `src/application/image-workflows/tests/ImageManipulationTranslationContracts.test.ts`
- `src/application/image-workflows/tests/ImageManipulationExecutionStatusContracts.test.ts`
- `src/application/image-workflows/tests/ImageManipulationOutputDiscoveryContracts.test.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`

Related architecture notes:

- `docs/architecture/image-manipulation-execution-application-ports.md`
- `docs/architecture/image-manipulation-translation-contracts.md`
- `docs/architecture/image-manipulation-execution-status-contracts.md`
- `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`
- `docs/architecture/image-manipulation-comfyui-template-translation-mappings.md`
- `docs/architecture/image-manipulation-comfyui-transport-client.md`
- `docs/architecture/image-manipulation-comfyui-adapter-architecture-and-boundary-rules.md`
- `docs/architecture/comfyui-adapter-audit.md`

