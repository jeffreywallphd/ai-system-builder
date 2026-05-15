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
- `desktop.host.artifact-remote-features.compose.*` for Hugging Face remote browse/publish/import/localize operations.
- `desktop.host.comfyui-install-features.compose.*` for ComfyUI install/status/repair requests, and `desktop.host.comfyui-image-runtime-features.compose.*` for ComfyUI-backed image runtime requests.
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
- `desktop.host.comfyui-install-features.import.*` / `desktop.host.comfyui-install-features.compose.*` for ComfyUI install/status/repair operations.
- `desktop.host.comfyui-image-runtime-features.import.*` / `desktop.host.comfyui-image-runtime-features.compose.*` for ComfyUI-backed generation operations.
- `desktop.host.ingestion-features.import.*` / `desktop.host.ingestion-features.compose.*` for website ingestion operations.
- `desktop.host.dataset-preparation-features.import.*` / `desktop.host.dataset-preparation-features.compose.*` for dataset preparation operations.
- `desktop.host.runtime-task-features.import.*` / `desktop.host.runtime-task-features.compose.*` for runtime-backed task execution.
- `desktop.host.python-runtime-foundation.import.*` / `desktop.host.python-runtime-foundation.compose.*` for explicit Python runtime control or runtime-task paths.

A startup regression is likely if any deferred feature import or compose milestone appears before the renderer invokes that feature's IPC channel. A source-boundary regression is likely if `modules/hosts/desktop/composition/composeDesktopHost.ts` regains static imports of deferred implementation modules such as filesystem artifact storage, Hugging Face artifact/model adapters, model use cases, image-generation use cases, ComfyUI runtime/installer adapters, asset resource-backed view composition, website ingestion, dataset preparation, Python task registry, or power lifecycle implementations. ComfyUI install-root resolution, GPU detection (`nvidia-smi`), Python start/probe/task activity, and ComfyUI start/probe activity should remain absent from startup and registration diagnostics.

## Prompt 4 feature-group IPC registration

Prompt 4 splits Electron IPC channel registration into explicit feature-group boundaries while keeping renderer-facing preload methods, IPC channel names, and request/response envelopes stable. Startup may now show registration-only milestones for each group:

- `desktop.host.ipc.startup-group.register.*`
- `desktop.host.ipc.artifact-group.register.*`
- `desktop.host.ipc.asset-group.register.*`
- `desktop.host.ipc.model-group.register.*`
- `desktop.host.ipc.image-generation-group.register.*`
- `desktop.host.ipc.runtime-group.register.*`
- `desktop.host.ipc.ingestion-group.register.*`
- `desktop.host.ipc.dataset-preparation-group.register.*`

Those milestones mean only that IPC handlers were attached to Electron. They should appear between `desktop.host.ipc-registration.lazy-handlers.before` and `desktop.host.ipc-registration.lazy-handlers.after` during startup. They must not be accompanied by deferred feature import or composition milestones during registration.

Use Prompt 3 import/compose milestones to distinguish handler registration from provider resolution. During startup, the logs should still omit deferred milestones such as `desktop.host.model-features.import.*`, `desktop.host.model-features.compose.*`, `desktop.host.artifact-features.import.*`, `desktop.host.artifact-remote-features.import.*`, `desktop.host.asset-features.import.*`, `desktop.host.image-generation-features.import.*`, `desktop.host.comfyui-install-features.import.*`, `desktop.host.comfyui-image-runtime-features.import.*`, `desktop.host.ingestion-features.import.*`, `desktop.host.dataset-preparation-features.import.*`, `desktop.host.runtime-task-features.import.*`, and `desktop.host.python-runtime-foundation.import.*`.

To diagnose accidental provider resolution during registration, collect a startup baseline and inspect the log segment from `desktop.host.ipc-registration.lazy-handlers.before` through `desktop.host.ipc-registration.lazy-handlers.after`. That segment should contain the feature-group `register.before`/`register.after` pairs only. If a deferred `<feature>.import.*` or `<feature>.compose.*` milestone appears in the same segment, a registration function probably called a lazy provider while attaching handlers.

To compare Prompt 3 and Prompt 4 diagnostics, use the same command before and after the split:

```bash
DESKTOP_MEMORY_DIAGNOSTICS=1 npm run dev:desktop
```

Prompt 4 should add finer-grained IPC registration pairs without moving feature import/compose milestones earlier. Model, artifact, asset, image-generation, ComfyUI, ingestion, dataset-preparation, artifact-remote/Hugging Face, runtime-task, and Python runtime foundation milestones should appear only after the first corresponding feature request, not during startup or channel registration.

## Cleanup checkpoint: refined lazy feature boundaries

The desktop main-process lazy boundary now separates ComfyUI install/status work from the ComfyUI image runtime. A first install/status or repair request should import and compose only `desktop.host.comfyui-install-features.*`; it should not import or compose `desktop.host.comfyui-image-runtime-features.*`, create the ComfyUI HTTP client, create the image-generation runtime adapter, start ComfyUI, or run GPU detection. The install root is resolved inside the install feature when the install/status/repair request is handled, not during startup or IPC registration.

ComfyUI image generation and runtime-backed task paths use the separate image runtime feature. Those paths may show `desktop.host.comfyui-image-runtime-features.import.before/after` and `desktop.host.comfyui-image-runtime-features.compose.before/after` on first use. GPU/device resolution is still deferred until an explicit ComfyUI runtime start/action path needs it, so install-status reads should not run `nvidia-smi` or equivalent detection.

Python runtime helper functions used by startup status reads live in a lightweight helper module, separate from Python runtime feature composition. Startup status reads may produce unavailable Python status without importing the Python runtime foundation. `desktop.host.python-runtime-foundation.import.*` and `desktop.host.python-runtime-foundation.compose.*` should appear only after explicit Python runtime control or runtime-task requests.

Feature-group IPC registration uses narrow typed lazy providers. Registration should attach handlers only; it should not resolve model, artifact, asset, image-generation, ComfyUI install, ComfyUI image runtime, ingestion, dataset-preparation, runtime-task, or Python runtime providers. In diagnostics, the IPC group `register.before`/`register.after` pairs should still appear during startup without adjacent deferred feature import/compose milestones.

Runtime task power lifecycle is task-action lazy. Composing `desktop.host.runtime-task-features.*` should not create the real Electron power suspension blocker. The first task lifecycle action that starts, stops, or lists a blocker may show `desktop.host.power-blocker.compose.before` and `desktop.host.power-blocker.compose.after`.

For a baseline comparison, run:

```bash
DESKTOP_MEMORY_DIAGNOSTICS=1 npm run dev:desktop
```

Expected milestone split:

- Startup: base host, logging, token/settings, startup workspace shell, and IPC group registration milestones only.
- First ComfyUI install/status request: `desktop.host.comfyui-install-features.import.*` and `desktop.host.comfyui-install-features.compose.*` only.
- First ComfyUI-backed image generation/runtime action: `desktop.host.comfyui-image-runtime-features.import.*` and `desktop.host.comfyui-image-runtime-features.compose.*` along with the relevant image/runtime-task feature milestones.
- First Python runtime control or Python-backed runtime task: `desktop.host.python-runtime-foundation.import.*` and `desktop.host.python-runtime-foundation.compose.*`.
- First task power lifecycle action: `desktop.host.power-blocker.compose.*`.
