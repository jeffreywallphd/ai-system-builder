# Runtime Task Registry Pack

Use this pack when prompt scope includes long-running runtime-backed tasks (dataset preparation, model training, validation, publishing, or future runtime handlers).

## Required Lifecycle

- Long-running work must use Runtime Task Registry async lifecycle: **start / read(status) / cancel / list**.
- UI and callers must poll status by `requestId` only after a start operation accepts work and returns a task request id; readiness-guard-rejected starts must not create pollable task ids.
- Do not use long-held HTTP/IPC requests to wait for completion.
- Do not solve timeout/disconnect issues by stretching fetch/IPC timeouts.

## Shared vs Feature-Specific Responsibilities

- Registry lifecycle/state/progress/retention concerns are shared across runtime tasks.
- Runtime readiness contracts are adjacent shared vocabulary for capability availability and do not replace registry task records or registry lifecycle operations.
- Task handlers remain feature-specific.
- Do not introduce feature-specific task queues for dataset/model/etc.

## Progress + Status Source of Truth

- Use structured task status/progress from registry contracts.
- Unknown `requestId` reads/cancels must be explicit not-found/unknown results with structured reason metadata or task errors, using `recordType: "not-found"` when no valid task family is known; do not return synthetic records that imply accepted work, and do not cast `"unknown"` into `TaskType` when the task family is not known.
- Registry routers may recover missing in-process correlation by asking safe delegates, but status/cancel/list reads must not start, install, repair, or heavy-probe runtimes.
- `listTasks` should aggregate delegates that can list current-process records and report unsupported or failed delegate families as warnings/metadata instead of failing the whole aggregate read generically. Delegate list-failure warnings must use safe metadata such as delegate name, requested task types, and `failureKind`; never include raw exception text, paths, env, command lines, tokens, or runtime payloads.
- Logs remain useful diagnostics but should not be primary UI state source.

## Power Lifecycle

- Power suspension blockers should attach to runtime task lifecycle activity.
- Power blockers complement but do not replace async task lifecycle polling.

## Contract Boundaries

- Generic runtime registry contracts must not depend on Python-specific contract types.
- Python-prefixed async task contracts (for example `StartPythonRuntimeTaskRequest`, `PythonRuntimeTaskStatusResult`, and `CancelPythonRuntimeTaskResult`) are adapter-boundary types only, limited to Python HTTP/protocol implementation details.
- Python runtime adapters must map Python status/error payloads to generic runtime task registry contracts at the application boundary.
- Do not create domain aliases that merely re-export runtime contracts.


## Dataset Preparation Migration Status

- Dataset preparation now uses only `RuntimeTaskRegistryPort` with Python `/tasks/start` + `/tasks/{requestId}` lifecycle polling.
- Legacy `PythonDatasetPreparationPort` and its adapter path are retired.
- Legacy dataset-preparation synchronous `/tasks/execute` path is removed from dataset-preparation production flows.
- Model training/validation/publishing use Runtime Task Registry start/read/cancel lifecycle APIs.
- No new long-running runtime-backed feature should use legacy `/tasks/execute`; use Runtime Task Registry lifecycle APIs.

## Readiness Boundary

- Runtime readiness guards may prevent starting new runtime-backed work when a required derived feature capability is not ready, but they do not replace task registry reads, cancellation, status records, or retention.
- Runtime readiness answers whether a host-owned capability is available, degraded, installing, failed, or otherwise unavailable before/around task execution. The application readiness service may derive feature capability status from runtime dependencies but must not start tasks or own task progress.
- Runtime Task Registry remains the source of truth for accepted long-running task `startTask` / `getTaskStatus` / `cancelTask` / `listTasks` lifecycle and progress, but only after a start has passed readiness guards and been accepted.
- If a readiness guard rejects a start before task creation, no registry record should be created and later status reads for that caller correlation id should remain explicit unknown/not-found results.
- Do not encode task progress, Python protocol status payloads, or ComfyUI runtime internals as generic readiness fields.
- Asset Registry image/generated-output resource-backed views must not use task registry status/list/cancel reads to discover image outputs. They may only project already-known generated-output descriptors supplied through a safe descriptor source, and those views remain unfinalized/unregistered until separate finalization/registration behavior runs elsewhere.
- Provider detail reads for generated-output views must use the generated-output descriptor read seam when available, or an explicitly bounded list fallback. They must not query task status, task list delegates, runtime readiness, ComfyUI, or image-generation execution paths to discover outputs.
- Dataset/model resource-backed views must not query Runtime Task Registry status/list/cancel/start paths. Existing persisted model validation status may be displayed as metadata only, but validation/training/publishing task lifecycle operations must not be invoked by Asset Registry view reads.
- External repository object resource-backed views must not query Runtime Task Registry status/list/cancel/start paths, model publishing tasks, or runtime readiness. Existing persisted external/published metadata can be displayed only after sanitization; repository existence, publication status, and localization/import state must not be refreshed through runtime tasks.
- Phase 3 Review B cross-family aggregate reads preserve this no-task-registry behavior for all resource-backed providers. Unsupported/deferred sources and source failures are represented as sanitized diagnostics, not task lifecycle reads or runtime/provider probes.
- Phase 3 Prompt 7 host composition does not change Runtime Task Registry ownership. Desktop/server resource-backed provider wiring must not inject task registries or use task start/read/list/cancel delegates to discover generated outputs, datasets, models, or external objects.
