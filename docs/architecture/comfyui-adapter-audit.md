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
