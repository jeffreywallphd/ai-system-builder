# Desktop Memory Diagnostics

Set `DESKTOP_MEMORY_DIAGNOSTICS=1` to emit local, developer-facing one-line JSON snapshots during Electron desktop startup and renderer activation:

```bash
DESKTOP_MEMORY_DIAGNOSTICS=1 npm run dev:desktop
```

Each line uses the `desktop.memory.snapshot` or `desktop.renderer.memory.snapshot` event and includes a stable `milestone`, `component`, timestamp, process label, uptime, and best-effort memory fields. Main-process snapshots include `process.memoryUsage()` values (`rss`, `heapTotal`, `heapUsed`, `external`, and `arrayBuffers` when available) plus safe system context such as platform, architecture, Node, Electron, and Chrome versions. Renderer snapshots use `performance.memory` only when Chromium exposes it; otherwise the milestone still logs without heap numbers.

## Milestone groups

- `desktop.main.*` and `desktop.app.*`: Electron main module load and app readiness.
- `desktop.host.compose.*`: desktop host composition boundaries before IPC registration.
- `desktop.host.*.before` / `desktop.host.*.after`: coarse composition stages for runtime foundations, storage, workspace, artifact, settings, model, asset, image-generation, and Electron IPC wiring.
- `desktop.window.*`: BrowserWindow construction, load, and show timing.
- `renderer.workspace-provider.*`: active workspace provider load success or failure.
- `renderer.page.active.changed`: active desktop page changes with `activePage`, `visibleActivePage`, and workspace status.

## Comparing development and packaged memory

Electron Forge and Webpack development processes can inflate apparent memory usage. Capture a dev baseline with `DESKTOP_MEMORY_DIAGNOSTICS=1 npm run dev:desktop`, then compare with a packaged app run with the same environment flag. Focus on deltas between adjacent milestones in the same run first, then compare the same milestone pairs across dev and packaged runs.

## Using the logs for lazy-loading work

Before changing host composition, save the ordered snapshot logs as a baseline. After future lazy-loading or host-splitting changes, collect the same startup path and compare memory deltas around host composition, IPC registration, BrowserWindow load/show, workspace loading, and page changes. The diagnostics are intentionally gated, local-only, and do not poll or retain snapshot history.

## Prompt 2 startup composition contract

Prompt 2 changes desktop startup so host composition and IPC registration build only the Tier 0/Tier 1 shell: Electron bootstrap, logging, memory diagnostics, Hugging Face token status/config, local settings/secrets, minimal workspace list/create/active-selection persistence, lazy IPC handlers, and cheap runtime readiness/status shells. Startup diagnostics should include:

- `desktop.host.compose.before` / `desktop.host.compose.after`
- `desktop.host.startup-workspace-shell.compose.before` / `desktop.host.startup-workspace-shell.compose.after`
- `desktop.host.ipc-registration.lazy-handlers.before` / `desktop.host.ipc-registration.lazy-handlers.after`
- `desktop.ipc.register.before` / `desktop.ipc.register.after`

The following feature milestones should **not** appear during initial startup or IPC registration. They should appear only after the first matching IPC request:

- `desktop.host.artifact-features.compose.*` for artifact upload/browser/local artifact content requests.
- `desktop.host.asset-features.compose.*` for Asset Library or asset mutation requests.
- `desktop.host.model-features.compose.*` for model management requests.
- `desktop.host.image-generation-features.compose.*` for image generation requests.
- `desktop.host.ingestion-features.compose.*` for website ingestion requests.
- `desktop.host.dataset-preparation-features.compose.*` for dataset preparation requests.
- `desktop.host.huggingface-features.compose.*` for Hugging Face remote browse/publish/import/localize operations.
- `desktop.host.comfyui-features.compose.*` for ComfyUI install/status/repair/start or image generation requests.
- `desktop.host.runtime-task-features.compose.*` for runtime-backed task execution paths.

To compare Prompt 1 and Prompt 2 memory deltas, collect the same startup path with `DESKTOP_MEMORY_DIAGNOSTICS=1 npm run dev:desktop` before and after the change. Compare adjacent deltas for `desktop.host.compose.before` → `desktop.host.compose.after`, `desktop.ipc.register.before` → `desktop.ipc.register.after`, and `desktop.host.ipc-registration.lazy-handlers.before` → `desktop.host.ipc-registration.lazy-handlers.after`. Prompt 2 should move most Tier 2/Tier 3 memory growth out of those startup pairs and into the first-request feature milestones.

A regression is likely if startup logs show any deferred feature milestone before the renderer makes the corresponding feature IPC request, or if `desktop.host.ipc-registration.lazy-handlers.*` is followed by Tier 2/Tier 3 composition milestones during registration. GPU probing, Python runtime startup/probing, ComfyUI startup, and power suspension blockers should remain absent from startup diagnostics and should occur only for explicit runtime actions that require them.

## Prompt 3 feature-module import laziness

Prompt 2 made many desktop feature constructors lazy, but constructor laziness alone did not guarantee that Electron main avoided loading those feature modules. Prompt 3 extends the startup contract so `composeDesktopHost.ts` keeps only the Tier 0/Tier 1 shell statically imported and dynamically imports explicit feature composers on first matching IPC use.

Dynamic import milestones use `desktop.host.<feature>.import.before` and `desktop.host.<feature>.import.after`. Feature object construction milestones use `desktop.host.<feature>.compose.before` and `desktop.host.<feature>.compose.after`. During initial startup, workspace shell registration, settings/token calls, runtime readiness reads, and IPC handler registration, these deferred import/compose milestones should be absent for artifact, artifact-remote/Hugging Face, asset, model, image-generation, ComfyUI, ingestion, dataset-preparation, runtime-task, and Python runtime foundation features.

The following should appear only after the first feature request:

- `desktop.host.artifact-features.import.*` / `desktop.host.artifact-features.compose.*` for artifact browser/upload/content operations.
- `desktop.host.artifact-remote-features.import.*` / `desktop.host.artifact-remote-features.compose.*` for Hugging Face artifact remote operations.
- `desktop.host.asset-features.import.*` / `desktop.host.asset-features.compose.*` for asset registry and mutation operations.
- `desktop.host.model-features.import.*` / `desktop.host.model-features.compose.*` for model management operations.
- `desktop.host.image-generation-features.import.*` / `desktop.host.image-generation-features.compose.*` for image generation operations.
- `desktop.host.comfyui-features.import.*` / `desktop.host.comfyui-features.compose.*` for ComfyUI install/status/repair or ComfyUI-backed generation operations.
- `desktop.host.ingestion-features.import.*` / `desktop.host.ingestion-features.compose.*` for website ingestion operations.
- `desktop.host.dataset-preparation-features.import.*` / `desktop.host.dataset-preparation-features.compose.*` for dataset preparation operations.
- `desktop.host.runtime-task-features.import.*` / `desktop.host.runtime-task-features.compose.*` for runtime-backed task execution.
- `desktop.host.python-runtime-foundation.import.*` / `desktop.host.python-runtime-foundation.compose.*` for explicit Python runtime control or runtime-task paths.

A startup regression is likely if any deferred feature import or compose milestone appears before the renderer invokes that feature's IPC channel. A source-boundary regression is likely if `modules/hosts/desktop/composition/composeDesktopHost.ts` regains static imports of deferred implementation modules such as filesystem artifact storage, Hugging Face artifact/model adapters, model use cases, image-generation use cases, ComfyUI runtime/installer adapters, asset resource-backed view composition, website ingestion, dataset preparation, Python task registry, or power lifecycle implementations. ComfyUI install-root resolution, GPU detection (`nvidia-smi`), Python start/probe/task activity, and ComfyUI start/probe activity should remain absent from startup and registration diagnostics.
