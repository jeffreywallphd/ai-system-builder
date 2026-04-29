# Dataset Preparation Timeout and IPC Map

- Desktop dataset preparation uses async **start/read/cancel task IPC** channels.
- `startPrepareTrainingDataset` in preload is short-lived and uses direct `ipcRenderer.invoke(...)` with no long custom timeout wrapper.
- IPC task-read success payload is desktop-specific: only `status: "succeeded"` includes a materialized `result` (outputs/provenance/summary/warnings).
- Runtime task status internally still uses runtime-shaped `data` for succeeded task payloads; IPC mapping translates runtime status into desktop response shape.
