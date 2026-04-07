# AI Companion: ComfyUI Adapter Audit Snapshot

## Why this exists
- Story 2.1.1 requires a clear audit of existing ComfyUI touchpoints and boundary leaks.
- Story 2.1.2 requires a minimal internal adapter contract that protects asset/workflow/system boundaries.

## What changed
- Added internal Comfy adapter contract at `src/application/execution/comfyui/ComfyAdapterContract.ts`.
- Added lifecycle + error normalization helper at `src/infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`.
- Refactored `ComfyQueueClient` to normalize transport history output into internal completion/output artifact contracts.
- Refactored `ComfyWorkflowExecutor` to:
  - implement `IComfyExecutionAdapter` as the explicit Comfy seam,
  - keep `IWorkflowExecutor` compatibility,
  - consume normalized queue completion/lifecycle contracts instead of raw Comfy DTO history.

## Key findings from audit
- Comfy DTO shapes leaked into execution orchestration.
- Lifecycle/error handling was mostly ad-hoc string/status mapping.
- Asset mapping logic was coupled to raw Comfy payload details.
- Context/asset-ref/runtime-option semantics were not represented in a stable Comfy adapter request contract.

## New minimum viable seam
- Request: workflow + property overrides + input asset refs + runtime params + execution context.
- Lifecycle: queued/running/completed/failed/cancelled with optional percent/message/queue position.
- Result: normalized outputs + lifecycle trail + structured error + messages.
- Capabilities: explicit cancel/progress/asset-reference support flags.

## Next
- Keep Comfy specifics inside infrastructure adapter layers and keep src/application/execution orchestration on internal contracts.

## Story 2.1.3 + 2.1.4 update
- Added focused mapper seams:
  - `src/infrastructure/comfyui/execution/mappers/ComfyExecutionRequestMapper.ts`
  - `src/infrastructure/comfyui/execution/mappers/ComfyExecutionResultMapper.ts`
- Added an adapter-driven invocation service:
  - `src/application/execution/comfyui/ComfyExecutionService.ts`
- Refactored `ComfyWorkflowExecutor` to consume `IComfyExecutionAdapter` instead of owning Comfy queue calls directly.
- Added output lineage hooks (`assetRef`, `lineage`) in `IComfyAdapterOutputRecord` so downstream persistence/provenance stories have a stable internal contract.

## Story 2.1.5 + 2.1.6 update
- Added canonical Comfy execution-context assembly in `src/application/execution/comfyui/ComfyExecutionContext.ts`.
- Expanded the internal Comfy adapter execution-context contract so one typed object now carries execution identifiers, system/runtime references, dataset refs, selected input assets, runtime params/options, trigger metadata, and observability hooks.
- Updated `ComfyWorkflowExecutor` + request mapping flow so execution metadata is no longer passed as loose bags.
- Added structured normalized execution error semantics to adapter errors (`code`, `category`, `severity`, retryability hints, execution references, diagnostics).
- Centralized normalization in `src/infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts` and applied it in `ComfyQueueExecutionAdapter` for mapping, connectivity, execution, and output-normalization failures.
- Added tests for execution-context construction and representative normalized failure scenarios.

## Story 2.1.7 + 2.1.8 update
- Adapter outputs now normalize to canonical asset-style references for generated execution artifacts (`asset:workflow-output:comfyui:...`) instead of prompt/file-derived ids.
- Normalized output metadata now carries dataset ownership hooks (`outputDatasetRefs`, `outputDatasetInstanceRefs`) sourced from execution context so downstream system-owned dataset persistence can bind outputs without Comfy payload parsing.
- Comfy file/path details remain infrastructure-only metadata on output records; adapter-facing request/result contracts stay asset-reference-first.
- Removed legacy parallel delegated Comfy strategy wrapper (`src/infrastructure/comfyui/execution/DelegatedWorkflowExecutionStrategy.ts`) to reinforce adapter-only access patterns.
- Added/updated tests for canonical output asset reference mapping and dataset-reference propagation in normalized result contracts.

## Story 2.1.9 + 2.1.10 update
- Added canonical Comfy adapter config seam in `src/infrastructure/comfyui/execution/ComfyAdapterConfig.ts` (required endpoint + minimal execution defaults + env mapping).
- Refactored `ComfyApiClient` + `ComfyQueueClient` to consume that config seam so adapter runtime options are centralized and validated.
- Added lightweight structured adapter observability helper in `src/infrastructure/comfyui/execution/ComfyAdapterObservability.ts`.
- `ComfyQueueExecutionAdapter` now emits normalized lifecycle execution logs for accepted/start/completed/failed/cancelled events with execution-context correlation ids when present.
- Added focused tests for valid/invalid/missing config behavior, env resolution, config-driven polling behavior, and structured log emission contracts.

## Story 2.1.11 + 2.1.12 update
- Validated that workflow-triggered Comfy execution uses the canonical seam:
  `ExecuteWorkflowUseCase` -> one-unit workflow execution plan -> `UnifiedExecutionEngine` -> `WorkflowExecutionUnitHandler` -> `IWorkflowExecutor` (Comfy-backed implementation).
- Added integration coverage for success and failure execution flow through that seam (`src/application/workflows/tests/ExecuteWorkflowUseCase.test.ts`) so trigger -> execute -> normalized result/error propagation is verified without bypassing adapter boundaries.
- Added normalized preview/inspection support on workflow execution results (`IWorkflowExecutionResult.inspection`) with Comfy-backed construction in `ComfyExecutionService`:
  - execution summary (runtime/status/output count/lifecycle/message counts),
  - normalized output references (node/kind/reference/assetId/metadata),
  - normalized diagnostics derived from adapter errors.
- This keeps preview/debug metadata internal-contract-first and adapter-result-driven, without exposing raw Comfy history payloads to workflow callers.

## Story 2.2.1 + 2.2.2 update
- Added runtime-agnostic common image node contracts at `src/application/execution/comfyui/image-nodes/CommonImageNodeContracts.ts` covering the current image vertical-slice node set (load/save/model/prompt/sampler/resize/VAE encode/decode).
- Added reusable Comfy adapter base pattern at `src/infrastructure/comfyui/adapters/image-nodes/ComfyImageNodeAdapterPattern.ts` with explicit hook points for identity/capabilities, input mapping, output mapping, inspection metadata, and error normalization.
- Added a single concrete pattern-validation adapter (`ComfyPromptInputNodeAdapter`) to prove the seam without prematurely implementing the full adapter catalog.
- Added tests for contract shape, adapter consistency, required input validation, normalized error behavior, and boundary isolation (no Comfy-specific types in the internal contract module).

## Story 2.2.3 + 2.2.4 update
- Added `ComfyLoadImageNodeAdapter` (`src/infrastructure/comfyui/adapters/image-nodes/ComfyLoadImageNodeAdapter.ts`) that loads images only from system-owned dataset instances through `DatasetInstanceRepository`, supports id/index/random/latest selection semantics, resolves file bytes with Node `fs`, and outputs internal image + metadata/preview contracts.
- Added `ComfySaveImageNodeAdapter` (`src/infrastructure/comfyui/adapters/image-nodes/ComfySaveImageNodeAdapter.ts`) that accepts internal image payloads, persists files with Node `fs/path`, writes dataset image records (timestamp/metadata/lineage/workflow/source refs) through dataset repository ports, and keeps filename strategy internal via prefix + timestamp + unique id.
- Extended common image-node contracts with reusable internal image and dataset-selection types to keep load/save compatibility explicit without introducing Comfy-specific types into application contracts.
- Added focused adapter tests (`src/infrastructure/comfyui/adapters/image-nodes/tests/ComfyLoadSaveImageNodeAdapters.test.ts`) for dataset->image resolution, save persistence + lineage capture, load->save composability, and Comfy-type boundary isolation.

## Story 2.2.5 + 2.2.6 update
- Added `ComfyModelLoaderNodeAdapter` (`src/infrastructure/comfyui/adapters/image-nodes/ComfyModelLoaderNodeAdapter.ts`) as the internal model/checkpoint loading seam with narrow model selection input (`modelRef`) and optional runtime/model-family hints in config.
- Added internal image-node contracts for downstream model/prompt composition in `CommonImageNodeContracts.ts`:
  - `ICommonImageNodeModelCapabilityRef` for loaded model capability references,
  - `ICommonImageNodePromptConditioning` for prompt/conditioning transfer without raw Comfy payload types.
- Updated `ComfyPromptInputNodeAdapter` to consume internal model capabilities plus positive/optional negative prompts, emit internal prompt conditioning output, and provide inspectable prompt-supply/binding metadata.
- Added focused adapter tests (`src/infrastructure/comfyui/adapters/image-nodes/tests/ComfyModelAndPromptNodeAdapters.test.ts`) for contract compliance, model->prompt composability, Comfy-boundary isolation, and normalized validation error behavior.

## Story 2.2.7 + 2.2.8 update
- Added `ComfySamplerWrapperNodeAdapter` (`src/infrastructure/comfyui/adapters/image-nodes/ComfySamplerWrapperNodeAdapter.ts`) as the internal sampler seam with narrow sampling config (`steps`, `guidance`, `seed`, optional sampler/scheduler/strength), internal model + prompt-conditioning inputs, optional source-image composition support, and inspectable effective sampling metadata.
- Added `ComfyResizeUpscaleNodeAdapter` (`src/infrastructure/comfyui/adapters/image-nodes/ComfyResizeUpscaleNodeAdapter.ts`) as the internal resize/upscale seam with narrow config (`width`/`height` and/or `scaleFactor`, fit mode, strategy), internal image output shape continuity, and explicit transform metadata updates (source/target dimensions + transform details).
- Added focused adapter tests (`src/infrastructure/comfyui/adapters/image-nodes/tests/ComfySamplerAndResizeNodeAdapters.test.ts`) covering contract compliance, model+prompt sampler composition, resize metadata integrity, composability-ready output shape, boundary isolation, and normalized validation error behavior.

## Story 2.2.9 + 2.2.10 update
- Added bounded VAE adapters:
  - `src/infrastructure/comfyui/adapters/image-nodes/VaeEncodeNodeAdapter.ts`
  - `src/infrastructure/comfyui/adapters/image-nodes/VaeDecodeNodeAdapter.ts`
- Extended common image-node internal contracts with a reusable latent representation (`ICommonImageNodeLatentRepresentation`) so sampler/VAE composition remains internal-contract-first and Comfy latent payload details stay inside adapter mapping.
- VAE adapters now map internal image/model/latent inputs to Comfy class/input semantics internally (`VAEEncode`, `VAEDecode`) and return only internal latent/image outputs plus small inspectable metadata.
- Added focused tests for encode/decode contract behavior, boundary isolation, composability seams, and normalized validation failures:
  - `src/infrastructure/comfyui/adapters/image-nodes/tests/ComfyVaeNodeAdapters.test.ts`
  - `src/infrastructure/comfyui/adapters/image-nodes/tests/ComfyImageNodeCompositionIntegration.test.ts`
- Composition coverage now validates representative end-to-end chain behavior under internal contracts:
  - load -> VAE encode -> sampler -> VAE decode -> resize -> save
  - inspectability and normalized integration failure behavior across the composed path.

## Story 2.3.7 + 2.3.8 update
- Workflow-output materialization now supports inspectable multi-output semantics on the canonical payload contract (`WorkflowOutputMaterializationPayload`):
  - per-output ordering (`outputIndex`),
  - per-output grouping (`outputGroupId`),
  - optional per-output source linkage (`sourceImageRef`),
  - role-tagged output persistence (`primary`/`variant`/`intermediate`) under one parent workflow run/materialization id.
- Comfy result mapping remains adapter-bounded: `ComfyExecutionResultMaterializationMapper` maps executor outputs into those canonical fields (including stable ordering/group defaults) without leaking Comfy-specific batch semantics outside the adapter.
- System-owned dataset persistence now stores ordering/group metadata in dataset generation records plus workflow-output provenance rows, keeping run-level grouping and output-level lineage queryable and inspectable.
- Dataset preview read models now expose generation/run/group metadata for materialized outputs so Data Studio/System Studio inspection and reuse paths can browse workflow outputs as ordinary operational image records.


## Story 2.4.5 + 2.4.6 update
- Added a provider-agnostic runtime capability preflight seam in `src/application/system-runtime/RuntimeCapabilityExecutionPreflight.ts`.
  - Resolves model bindings and runtime execution options against existing capability contracts.
  - Returns structured failure states for validation failures vs unsupported provider mappings.
  - Fails before provider execution for missing models, invalid combinations, unsupported requirements, and out-of-bounds values.
- Added a ComfyUI-specific translation adapter in `src/infrastructure/comfyui/execution/mappers/ComfyRuntimeCapabilityTranslator.ts` that maps internal runtime capability state into ComfyUI execution configuration without leaking Comfy-specific terms upward.
- Added focused tests:
  - `src/application/system-runtime/tests/RuntimeCapabilityExecutionPreflight.test.ts`
  - `src/infrastructure/comfyui/execution/tests/ComfyRuntimeCapabilityTranslator.test.ts`

## Story 2.4.7 + 2.4.8 update
- Added provider-agnostic runtime-capability binding persistence/serialization seam at
  `src/application/system-runtime/RuntimeCapabilityBindingPersistence.ts`.
  - Persists explicit internal records (`bindingContract`, selected model binding, selected execution options, optional resolved options).
  - Enforces schema-version awareness (`1.0.0`) and rejects unsupported persisted versions.
  - Normalizes/strips unknown provider-payload leakage at this higher-level persistence boundary.
- Integrated that persistence seam into System Studio execution-metadata updates in
  `src/application/system-studio/SystemStudioApplicationService.ts` so persisted runtime capability bindings are validated/sanitized before draft save.
- Extended System Studio execution metadata domain shape with bounded runtime-capability binding storage slot (`runtimeCapabilityBindings`) for inspectable persistence in system draft content.
- Added minimal bounded System Studio UI integration in
  `src/ui/components/studio-shell/SystemExecutionMetadataEditor.tsx`:
  - select/confirm model binding id,
  - adjust bounded normalized execution options (sampler, steps, guidance scale),
  - inspect persisted binding count from saved execution metadata.
- Added focused tests:
  - `src/application/system-runtime/tests/RuntimeCapabilityBindingPersistence.test.ts`
  - `src/application/system-studio/tests/SystemStudioApplicationService.test.ts` (runtime-capability persistence/reload, provider payload leakage prevention, unsupported-version rejection)
  - `src/ui/pages/tests/SystemStudioPageContracts.test.ts` (bounded runtime-capability editor contract surface)

## Story 5.1 + 5.2 update
- Added a concrete image-manipulation execution adapter contract at
  `src/application/system-studio/ComfyImageManipulationExecutionAdapterContract.ts`.
  - Covers request/graph build input, execution submission payload, progress polling snapshot, normalized success/failure outputs, and output materialization hook bindings.
  - Keeps versioning + inspectability explicit (`contractVersion`, graph/template/version metadata, extension-binding inspection payloads).
  - Stays asset-aligned by carrying logical dataset/storage binding references and workflow-template output materialization bindings.
- Added a concrete request/graph builder at
  `src/application/system-studio/ComfyImageManipulationGraphRequestBuilder.ts`.
  - Transforms default image manipulation workflow-template context (resolved config + dataset runtime handles + runtime metadata + base graph) into a runnable Comfy `prompt` graph.
  - Resolves logical source-image dataset references through the existing dataset-binding asset contract.
  - Reuses the existing property-mapping asset for deterministic property-to-node mapping and extension readiness (including FaceID hooks) without adding a parallel mapping model.
  - Produces inspectable submission output for debugging and runtime handoff.
- Added focused tests in
  `src/application/system-studio/tests/ComfyImageManipulationGraphRequestBuilder.test.ts` for default runnable graph output, logical-reference safety (no path leakage), and version-contract enforcement.
