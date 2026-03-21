# ai-loom-studio

AI Loom Studio is a domain-first desktop and web workflow studio for composing AI capabilities.

## What changed

This repository now supports two explicit runtime modes:

- **Development browser mode**: the existing Vite-first workflow remains the default.
- **Packaged desktop production mode**: Electron hosts the renderer, owns the local supervisor lifecycle, uses a private/bundled Python runtime path, and persists durable app state in SQLite-backed desktop storage.

## Development mode

Development now has two clearly differentiated paths:

- **Desktop-host development (`npm run dev:desktop`)** is the truthful operational path.
- **Browser-only Vite development (`npm run dev`)** remains available as an authoring fallback when the desktop bridge is not present.

### Start the existing dev workflow

```bash
npm install
npm run dev
```

That starts the renderer in browser-only fallback mode. Workflows remain durable in browser storage, but this path does **not** provide the full dev filesystem + SQLite persistence foundation.

### Optional desktop-host development

```bash
npm run dev:desktop
```

This starts:

- the Vite renderer on `http://127.0.0.1:5174`
- an Electron shell that loads the dev server
- the local service supervisor owned by the Electron main process

Desktop development is now the main truthful development runtime:

- workflow JSON records persist under `dev/workflow-data/workflows/`
- a SQLite workflow index is created at `dev/workflow-data/workflows/workflow-index.sqlite`
- execution defaults to a **strategy-driven** path that prefers delegated Python runtime execution
- scaffold execution remains available only as an explicit fallback path and is labeled as such in execution metadata
- the primary node catalog is registry-backed rather than mock-only

## Production desktop mode

Production is now modeled as a packaged Electron app for **Windows** and **macOS**.

### Production behavior

In packaged desktop builds:

- Electron loads packaged renderer assets instead of the Vite dev server.
- Electron main starts and stops the local service supervisor.
- The desktop host resolves app-data directories from OS-safe user data locations.
- Core renderer persistence is backed by a **SQLite** database stored under the app data directory.
- Production no longer relies on browser `localStorage` or in-memory workflow repositories as the system of record.
- The Python runtime path is resolved as a **private packaged runtime location** under `runtime-assets/python/<platform>-<arch>/...`.

### Private Python runtime packaging

Packaged builds expect a private Python distribution to be placed at:

- `runtime-assets/python/<platform>-<arch>/python/bin/python3` on macOS/Linux
- `runtime-assets/python/<platform>-<arch>/python/python.exe` on Windows

A manifest template is included at `runtime-assets/python/manifest.template.json`.

If that private runtime is missing, the app keeps the architecture and path resolution in place, but the packaged runtime will log a concrete warning that the embedded interpreter was not found.

## Desktop packaging commands

### Build the browser renderer only

```bash
npm run build
```

### Package the Electron app locally

```bash
npm run build:desktop
```

### Produce platform installers/artifacts

```bash
npm run make:desktop
```

Electron Forge is configured for:

- **Windows**: Squirrel.Windows maker
- **macOS**: DMG and ZIP makers

Code signing, notarization, and publish/update credentials are **not** configured in this repository yet; the Forge configuration is structured so those can be added later without changing the runtime architecture.

## Runtime and persistence architecture

### Runtime selection

The app now differentiates between:

- `browser-development`
- `desktop-development`
- `desktop-production`

This runtime choice drives:

- renderer asset loading
- repository selection
- settings persistence selection
- workflow repository selection
- Python runtime resolution
- desktop path resolution

### Durable storage

Packaged desktop mode creates a storage layout under the Electron user-data folder that includes:

- `storage/ai-loom-studio.sqlite`
- `runtime/`
- `models/`
- `assets/`
- `logs/`

SQLite stores structured durable app state. Local filesystem paths remain the home for larger runtime assets, logs, and model/runtime working directories.

In desktop development specifically:

- canonical workflow definitions live in `dev/workflow-data/workflows/*.json`
- SQLite indexes workflow summaries and lookup metadata in `dev/workflow-data/workflows/workflow-index.sqlite`
- existing seeded/sample workflows are loaded from the same `dev/` workflow storage tree

This keeps development persistence durable across restarts while preserving a clear source of truth: **workflow JSON on disk is canonical; SQLite is the indexed summary layer**.

## Execution truthfulness

Workflow execution now reports how a run actually happened:

- **delegated** — execution was handed to the Python runtime
- **scaffolded** — execution used the deterministic scaffold interpreter fallback
- **hybrid** — a run mixed delegated and scaffolded behavior
- **unavailable** — the requested behavior could not be implemented truthfully

The app no longer treats scaffold execution as if it were the primary production-like path. When the Python runtime is unavailable, the UI and execution metadata now make that fallback explicit.

## Important current limitations

- The Electron packaging pipeline is fully wired, but **embedded Python binaries are not checked into this repository**. You must place a private Python runtime into `runtime-assets/python/<platform>-<arch>/...` before producing a distributable installer that is fully self-contained.
- Code signing, notarization, auto-update hosting, and release publishing secrets are intentionally not claimed as configured.
- The default `npm run dev` path remains browser-first by design so the existing developer workflow stays stable.

## Repository highlights

- `application/runtime/**`: runtime-mode and production storage initialization use cases
- `domain/runtime/**`: runtime mode definitions
- `infrastructure/desktop/**`: desktop storage, path resolution, and private Python runtime resolution
- `electron/**`: Electron main/preload host implementation
- `ui/composition/**`: explicit dev-vs-desktop repository composition
- `forge.config.ts`: Electron Forge packaging configuration
