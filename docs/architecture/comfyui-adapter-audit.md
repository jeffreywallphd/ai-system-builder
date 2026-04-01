# ComfyUI Adapter Audit (Stories 2.1.1 and 2.1.2)

## Scope
This audit reviews current ComfyUI integration touchpoints and aligns them with AI Loom's asset-first, workflow-execution, and system-integration architecture.

## Current-state touchpoint inventory

| Area | Files | Current role |
|---|---|---|
| DTO transport shapes | `infrastructure/comfyui/dto/*` | Raw Comfy prompt/history/queue shapes.
| Workflow->Comfy mapping | `infrastructure/comfyui/adapters/ComfyWorkflowAdapter.ts`, `ComfyNodeAdapter.ts`, `ComfyPropertyAdapter.ts` | Converts workflow graph + node properties to Comfy prompt payload.
| Comfy transport client | `infrastructure/comfyui/execution/ComfyApiClient.ts` | HTTP queue/history/interrupt/view calls.
| Queue lifecycle polling | `infrastructure/comfyui/execution/ComfyQueueClient.ts` | Polls queue/history and derives status.
| Execution orchestration | `infrastructure/comfyui/execution/ComfyWorkflowExecutor.ts` | Executes workflow, emits events, creates assets.
| Delegated runtime strategy seam | `infrastructure/comfyui/execution/DelegatedWorkflowExecutionStrategy.ts` | Generic delegated strategy path (runtime=`comfyui`).
| Node catalog/runtime descriptors | `infrastructure/comfyui/catalog/*`, `infrastructure/nodes/comfyui/*` | Authoring/runtime node metadata and compatibility hints.

## Misalignment findings

### A. Asset model misalignment
1. Output mapping relied on raw Comfy history DTOs inside executor logic, tightly coupling asset creation to tool payload shapes.
2. Comfy output records used ad-hoc file/text parsing without a normalized adapter output contract.
3. Input asset references were not part of a stable Comfy adapter request shape (only optional `inputAssets` existed at workflow executor port boundary).

### B. Workflow execution model misalignment
1. Lifecycle normalization was implicit and mixed with transport polling logic (`queued` coerced to `running`, percent heuristics hardcoded in executor).
2. Result/error contract was executor-specific and string-message-oriented; no normalized structured adapter error surface existed.
3. Queue/history details leaked directly into execution logic through DTO types.

### C. System integration model misalignment
1. Comfy transport and request/response details were directly consumed by the workflow executor class instead of being isolated at an adapter seam.
2. Adapter capabilities (progress/cancel/support posture) were not explicitly declared for system-level orchestration/use by future runtime selection.
3. Execution context extensibility for system context/dataset refs/runtime options was not represented in a stable internal contract.

## Leakage and boundary issues
- Raw Comfy history output payloads were consumed outside the transport edge.
- Comfy-specific request/response DTO types crossed into execution orchestration.
- Error handling used generic thrown errors with text parsing and no normalized code/retriable metadata.
- Lifecycle event handling did not provide a reusable normalized shape for future engine swaps.

## Minimum viable target contract (implemented in this slice)

### Internal contract seam
- Added `application/execution/comfyui/ComfyAdapterContract.ts`:
  - `IComfyExecutionAdapter`
  - `IComfyAdapterRequest`
  - `IComfyAdapterResult`
  - `IComfyAdapterLifecycleEvent`
  - `IComfyAdapterError`
  - explicit capabilities contract.

### Normalized execution lifecycle + errors
- Added `infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`:
  - lifecycle mapping from transport progress -> normalized adapter lifecycle events.
  - error normalization (`queue-timeout`, `execution-failed`, `execution-cancelled`, etc.).

### Output normalization boundary
- `ComfyQueueClient` now normalizes Comfy history outputs into adapter-owned `IComfyPromptCompletion` and `IComfyPromptOutputArtifact`, preventing DTO leakage into `ComfyWorkflowExecutor`.

### Executor boundary alignment
- `ComfyWorkflowExecutor` now implements both:
  - `IWorkflowExecutor` (existing workflow execution backbone contract)
  - `IComfyExecutionAdapter` (new internal Comfy adapter seam)
- Workflow-facing execution path now maps through adapter request/lifecycle/result contracts first, then projects to existing workflow execution event/result contracts.

## Refactor implications and mapping

| Current component | Target boundary role | Status |
|---|---|---|
| `ComfyApiClient` | Transport-only Comfy HTTP adapter | kept; still infrastructure edge |
| `ComfyQueueClient` | Transport lifecycle/output normalizer | refactored |
| `ComfyWorkflowExecutor` | Adapter seam + workflow port bridge | refactored |
| `ComfyWorkflowDto`/history DTOs | confined to transport/mapping layers | reduced leakage |
| `IWorkflowExecutor` usage | preserved for backward progress | preserved |

## Impacted modules/files
- `application/execution/comfyui/ComfyAdapterContract.ts`
- `infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`
- `infrastructure/comfyui/execution/ComfyQueueClient.ts`
- `infrastructure/comfyui/execution/ComfyWorkflowExecutor.ts`
- `infrastructure/comfyui/execution/tests/*` (contract/lifecycle behavior coverage)

## Remaining follow-up (not required for this story)
1. Introduce a higher-level runtime registration/composition path that depends on `IComfyExecutionAdapter` instead of concrete executor wiring.
2. Extend normalized output metadata to include explicit lineage correlation IDs for cross-system persistence hooks.
3. Add richer lifecycle status mapping when Comfy exposes finer-grained progress semantics.

## Story 2.1.3 and 2.1.4 incremental update
- Added focused mapper seams so request/result mapping no longer lives ad-hoc inside execution orchestration:
  - `infrastructure/comfyui/execution/mappers/ComfyExecutionRequestMapper.ts`
  - `infrastructure/comfyui/execution/mappers/ComfyExecutionResultMapper.ts`
- Added `application/execution/comfyui/ComfyExecutionService.ts` as the adapter-driven invocation layer (`trigger -> execute -> normalize`) for workflow execution callers.
- Refactored `ComfyWorkflowExecutor` to consume `IComfyExecutionAdapter` and route execution through the new service instead of directly owning Comfy queue invocation mechanics.
- Expanded normalized adapter output records with `assetRef` and `lineage` hooks for downstream persistence/provenance alignment without exposing Comfy DTOs upstream.

## Story 2.1.5 and 2.1.6 incremental update
- Introduced canonical execution-context construction for Comfy adapter execution via:
  - `application/execution/comfyui/ComfyExecutionContext.ts`
  - expanded `IComfyAdapterExecutionContext` contract in `application/execution/comfyui/ComfyAdapterContract.ts`
- Comfy execution paths now pass one stable execution context object (identifiers, system refs, dataset refs, selected input assets, runtime params/options, trigger metadata, observability hooks, metadata) rather than ad-hoc metadata bags.
- `ComfyWorkflowExecutor` now consistently builds and passes that context into adapter requests.
- Error handling now normalizes infrastructure/adapter failures into structured internal contracts (`code`, `category`, `severity`, retryability, execution refs, diagnostics) through `infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`.
- `ComfyQueueExecutionAdapter` now captures and normalizes:
  - request-mapping failures,
  - connection/queue submission failures,
  - execution-time failures,
  - output-normalization failures,
  instead of leaking raw Comfy exception shapes across adapter boundaries.
- Added focused test coverage for context assembly/propagation and normalized error scenarios.

## Story 2.1.7 and 2.1.8 incremental update
- Comfy adapter result normalization is now explicitly asset-oriented for downstream persistence:
  - output records now use canonical asset-style references (`asset:workflow-output:comfyui:...`) instead of ad-hoc prompt/file-derived identifiers;
  - dataset ownership intent is propagated on normalized output metadata (`outputDatasetRefs`, `outputDatasetInstanceRefs`) so system-owned dataset persistence hooks can attach without parsing Comfy payloads.
- Request/result mapping keeps Comfy file/path specifics inside infrastructure metadata only; adapter-facing contracts remain asset-reference-first.
- Legacy Comfy direct strategy plumbing (`infrastructure/comfyui/execution/DelegatedWorkflowExecutionStrategy.ts`) was removed so Comfy execution depends on the canonical adapter-driven execution seam rather than parallel delegated wrappers.
- Tests were updated to cover canonical asset output reference mapping and dataset-reference propagation through normalized adapter outputs.

## Story 2.1.9 and 2.1.10 incremental update
- Added a small explicit Comfy adapter configuration seam in `infrastructure/comfyui/execution/ComfyAdapterConfig.ts` with:
  - required adapter endpoint (`baseUrl`),
  - defaulted request timeout (`requestTimeoutMs`),
  - defaulted polling cadence (`pollIntervalMs`),
  - defaulted max execution wait (`maxExecutionWaitMs`),
  - environment resolution (`COMFYUI_BASE_URL`, `COMFYUI_TIMEOUT_MS`, `COMFYUI_POLL_INTERVAL_MS`, `COMFYUI_MAX_WAIT_MS`).
- Refactored `ComfyApiClient` and `ComfyQueueClient` constructors so runtime callers can depend on the canonical config seam instead of spreading Comfy env reads or duplicated option defaults.
- Added adapter-level structured observability via `infrastructure/comfyui/execution/ComfyAdapterObservability.ts`.
  - Execution path now emits normalized lifecycle logs (`request-accepted`, `execution-started`, `execution-completed`, `execution-failed`, `execution-cancelled`).
  - Log records are machine-friendly and include execution/workflow identifiers, optional lineage/correlation refs from execution context, terminal status, duration, output count, and normalized error codes/categories where present.
- Updated `ComfyQueueExecutionAdapter` to use centralized observability emission across request mapping, enqueue, completion, cancellation, and failure paths without leaking raw Comfy payloads into log records.
- Added tests for configuration validation/defaulting/env loading, config-driven client construction, queue polling timeout behavior from canonical config, and structured lifecycle log emission with context correlation.

## Story 2.1.11 and 2.1.12 incremental update
- Validated canonical workflow execution integration for Comfy-backed runs through:
  `ExecuteWorkflowUseCase` -> one-unit workflow execution plan -> `UnifiedExecutionEngine` -> `WorkflowExecutionUnitHandler` -> Comfy-backed `IWorkflowExecutor`.
- Added workflow integration coverage for trigger -> execute -> result/error propagation so Comfy execution no longer risks hidden bypasses around the unified execution seam.
- Added normalized execution preview/inspection support to workflow results via `IWorkflowExecutionResult.inspection`.
- `ComfyExecutionService` now maps normalized adapter result data into platform-facing inspection contracts:
  - execution summary (`runtime`, `status`, output/lifecycle/message counts, error presence),
  - output preview references (`nodeId`, kind, reference, `assetId`, metadata),
  - normalized diagnostics from adapter errors.
- Preview/inspection shaping remains contract-first and avoids exposing raw Comfy transport payloads to workflow callers.

## Story 2.2.1 + 2.2.2 update (Common image node contracts + adapter pattern)
- Added internal common-image node contracts in `application/execution/comfyui/image-nodes/CommonImageNodeContracts.ts` for:
  - load image
  - save image
  - model loader
  - prompt input
  - sampler wrapper
  - resize/upscale
  - VAE encode
  - VAE decode
- Contracts are intentionally runtime-agnostic and include explicit identity, capabilities, input/output/config contracts, execution request/response, inspectability metadata, and normalized execution error contracts.
- Added reusable Comfy adapter base pattern in `infrastructure/comfyui/adapters/image-nodes/ComfyImageNodeAdapterPattern.ts` with consistent seams for:
  - node identity and capability contract access
  - input mapping (`toComfyPayload`)
  - output mapping (`fromComfyResult`)
  - inspection metadata (`inspect`)
  - normalized error hook (`normalizeError`)
- Added one thin concrete adapter (`ComfyPromptInputNodeAdapter`) only to validate the pattern without over-implementing all node adapters in this slice.
- Added focused tests to verify:
  - contract coverage and runtime-agnostic shape
  - adapter pattern consistency and required-input enforcement
  - separation between domain/application contracts and Comfy-specific infrastructure concerns.

## Story 2.2.3 + 2.2.4 update (Load/Save image node adapters)
- Added `ComfyLoadImageNodeAdapter` at `infrastructure/comfyui/adapters/image-nodes/ComfyLoadImageNodeAdapter.ts`:
  - consumes system-owned dataset instance references through `DatasetInstanceRepository`,
  - resolves image records using id/index/random/latest selection strategy semantics,
  - reads image bytes via Node `fs` and emits internal image payload + metadata (dataset/image/filename/dimensions),
  - includes preview metadata hooks while keeping Comfy-specific payload details inside adapter outputs only.
- Added `ComfySaveImageNodeAdapter` at `infrastructure/comfyui/adapters/image-nodes/ComfySaveImageNodeAdapter.ts`:
  - consumes internal image payloads and target dataset instance references,
  - persists image files via Node `fs/path` into system-owned dataset storage roots,
  - writes dataset image records through `DatasetInstanceRepository` with timestamp, metadata, lineage/provenance, and source/workflow references,
  - keeps filename strategy internal (`prefix + timestamp + unique id`) without exposing raw Comfy `filename_prefix` at system-facing contracts.
- Extended common runtime-agnostic contracts in `CommonImageNodeContracts.ts` with reusable internal image and dataset-selection contract shapes for load/save adapter compatibility.
- Added focused integration tests in `infrastructure/comfyui/adapters/image-nodes/tests/ComfyLoadSaveImageNodeAdapters.test.ts` for:
  - dataset-resolution-to-image mapping,
  - save persistence + lineage metadata,
  - load->save composability roundtrip,
  - boundary validation that Comfy-specific type names do not leak into application contract modules.

## Story 2.2.5 + 2.2.6 update
- Added `ComfyModelLoaderNodeAdapter` (`infrastructure/comfyui/adapters/image-nodes/ComfyModelLoaderNodeAdapter.ts`) as the internal model/checkpoint loading seam with narrow model selection input (`modelRef`) and optional runtime/model-family hints in config.
- Added internal image-node contracts for downstream model/prompt composition in `CommonImageNodeContracts.ts`:
  - `ICommonImageNodeModelCapabilityRef` for loaded model capability references,
  - `ICommonImageNodePromptConditioning` for prompt/conditioning transfer without raw Comfy payload types.
- Updated `ComfyPromptInputNodeAdapter` to consume internal model capabilities plus positive/optional negative prompts, emit internal prompt conditioning output, and provide inspectable prompt-supply/binding metadata.
- Added focused adapter tests (`infrastructure/comfyui/adapters/image-nodes/tests/ComfyModelAndPromptNodeAdapters.test.ts`) for contract compliance, model->prompt composability, Comfy-boundary isolation, and normalized validation error behavior.
