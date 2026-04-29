# Dataset Preparation Timeout and IPC Map

- Desktop dataset preparation uses async **start/read/cancel task IPC** channels.
- `startPrepareTrainingDataset` in preload is short-lived and uses direct `ipcRenderer.invoke(...)` with no long custom timeout wrapper.
- IPC task-read success payload is desktop-specific: only `status: "succeeded"` includes a materialized `result` (outputs/provenance/summary/warnings).
- Runtime task status internally still uses runtime-shaped `data` for succeeded task payloads; IPC mapping translates runtime status into desktop response shape.
- Long-running dataset preparation and model training flows automatically use per-task power suspension blockers at the application/use-case layer.
- The blocker prevents OS sleep/suspension while tasks are active, but it does **not** change HTTP/IPC transport timeout behavior.
- Async polling (`start`/`read`/`cancel`) remains the primary lifecycle and timeout-safe control mechanism.

## Power Suspension Lifecycle Notes

- Power suspension lifecycle must not depend on UI polling.
- Blockers are managed centrally through `TaskPowerLifecycleService`.
- Async polling (`read*` task status) exists for UI updates only, not lifecycle correctness.
