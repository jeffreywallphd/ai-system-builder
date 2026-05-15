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
