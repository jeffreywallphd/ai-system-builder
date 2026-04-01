# AI Companion: ComfyUI Adapter Audit Snapshot

## Why this exists
- Story 2.1.1 requires a clear audit of existing ComfyUI touchpoints and boundary leaks.
- Story 2.1.2 requires a minimal internal adapter contract that protects asset/workflow/system boundaries.

## What changed
- Added internal Comfy adapter contract at `application/execution/comfyui/ComfyAdapterContract.ts`.
- Added lifecycle + error normalization helper at `infrastructure/comfyui/execution/ComfyExecutionLifecycle.ts`.
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
- Keep Comfy specifics inside infrastructure adapter layers and keep application/execution orchestration on internal contracts.
