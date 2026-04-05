# ai-loom-studio

AI Loom Studio is a domain-first desktop and web workflow studio for composing AI capabilities.

## What changed

This repository now supports two explicit runtime modes:

- **Development desktop mode**: Electron + the renderer now form the standard dev workflow and persist durable app state under `dev/`.
- **Packaged desktop production mode**: Electron hosts the renderer, owns the local supervisor lifecycle, uses a private/bundled Python runtime path, and persists durable app state in SQLite-backed desktop storage.
- **Desktop-backed model and dataset truth**: when the desktop bridge is available, installed-model metadata, managed model reconciliation, training-job metadata, and dataset studio persistence all prefer durable desktop-backed storage over browser-only records.

## Development mode

Development now has two clearly differentiated paths:

- **Desktop-host development (`npm run dev`)** is now the standard truthful development path.
- **Browser-only Vite development (`npm run dev:browser`)** remains available only as an explicit degraded fallback when the desktop bridge is not present.

### Start the standard dev workflow

```bash
npm install
npm run dev
```

That starts the renderer plus the Electron desktop host, which is the expected development path for durable `dev/` filesystem + SQLite persistence.

### Explicit browser-only fallback

```bash
npm run dev:browser
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

The Python runtime provisioning path in development also treats `.venv` as a disposable managed artifact:

- the supervisor performs explicit virtual-environment/pip integrity checks before package installation
- integrity checks now explicitly detect missing interpreter, pip import/command failures, and invalid pip distribution artifacts (for example leftover `~ip*.dist-info`)
- bounded in-place repair is attempted only when safe (`ensurepip --upgrade`), then revalidated; unsafe cases transition directly to rebuild
- when an environment is unhealthy, the supervisor provisions a fresh staged environment under `.venv.managed/`, validates it, promotes it as active, and marks prior environments invalid/cleanup-pending on a best-effort basis
- runtime diagnostics keep corrupted/rebuild-needed/rebuild-in-progress truth explicit instead of retrying poisoned environments indefinitely
- provisioning and launchability are now modeled separately: the supervisor records `provisioned` vs `provisioned-unlaunchable` so “requirements installed” is not treated as “runtime can boot on this host”
- provisioning now runs an explicit runtime import preflight (`import app.main`) and persists launchability diagnostics so host-incompatible native dependencies (for example CPU-incompatible NumPy wheels) are surfaced as a known root cause instead of generic startup timeouts
- browser and desktop dev startup now consult supervisor state directly after `ensure-running`; when the runtime is already known failed/unlaunchable, startup reports that cause immediately instead of primarily timing out on `127.0.0.1:8100`
- model-training native dependency failures are capability-scoped: the core Python API can still boot, while local gradient training truthfully reports unavailable/degraded behavior when NumPy cannot initialize
- runtime health (`/health` bootability), capability health (for example `local-gradient-training` dependency/platform/resource readiness), and task execution readiness are now reported as distinct truths; a bootable runtime does not imply every optional local capability is runnable on the current machine

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
- Packaged desktop keeps this private runtime direction and does not fall back into dev `.venv` provisioning semantics; health/provisioning diagnostics still use the same truthful managed-service contract.

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

Under the hood those runtime modes are now treated as **runtime profiles** composed from smaller architectural axes:

- **host kind** — browser vs desktop
- **lifecycle stage** — development vs production
- **distribution target** — the delivery technology currently responsible for the renderer/host pairing (today `vite-browser` or `electron`)
- **renderer delivery mode** — dev server vs packaged assets

That separation matters because “Vite”, “Electron Forge”, and similar tools are better understood here as **distribution tooling choices**, not the core runtime model. The runtime profile owns the application-facing contract, while the current toolchain plugs into it.

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
- Browser-only development remains available, but it is now documented and surfaced as a degraded fallback rather than the ordinary development baseline.

## Repository highlights

- `application/runtime/**`: runtime-mode and production storage initialization use cases
- `domain/runtime/**`: runtime mode definitions
- `infrastructure/desktop/**`: desktop storage, path resolution, and private Python runtime resolution
- `electron/**`: Electron main/preload host implementation
- `ui/composition/**`: explicit dev-vs-desktop repository composition
- `forge.config.ts`: Electron Forge packaging configuration

## Identity session docs

- Session architecture and integration expectations: `docs/architecture/identity-session-architecture.md`
- Identity foundation overview: `docs/architecture/identity-foundation.md`
- Identity server API contract: `docs/architecture/identity-server-api.md`
- Feature 1 final baseline and downstream implementation notes: `docs/architecture/identity-feature-1-final-baseline.md`

## Node execution truthfulness categories

Workflow and node execution now report structured truthfulness categories end to end:

- **real** — executed by a real runtime/model-backed implementation
- **delegated** — delegated across the runtime boundary (Python runtime or live MCP runtime)
- **hybrid** — combined delegated/runtime-backed behavior with bounded scaffold support
- **scaffolded** — deterministic scaffold/interpreted fallback only
- **unavailable** — the requested behavior could not be performed truthfully

Scaffold fallback is no longer implied. It is reported explicitly in workflow provenance, node provenance, logs, and UI status panels.

## MCP truthfulness

MCP-backed execution now reports runtime/session truth explicitly:

- **live**
- **stale**
- **disconnected**
- **unavailable**

These states flow through MCP workflow nodes, capability execution metadata, and operational status surfaces so a capability cannot silently appear runnable when the runtime/session state says otherwise.

## Model library truthfulness

The Models area now distinguishes between:

- **installed and verified**
- **installed but unverified**
- **registered metadata only**
- **missing on disk**
- **partially installed**
- **corrupted / checksum mismatch**
- **downloaded but not registered**
- **browser-fallback downloaded only**

The source-of-truth architecture is now explicit:

- **managed local files** are canonical whenever the desktop model-file bridge is available
- the **installed-model catalog** is a durable index/registration layer that is reconciled against those managed files
- **remote catalog results** are discovery-only and do not override local truth
- **browser fallback downloads** remain visible, but only as degraded metadata/deregistration paths rather than as managed local installs

The Models page now supports real end-to-end actions for download/install, refresh/reconcile, metadata-only removal, and managed uninstall when the underlying environment can actually perform those actions.

## Fine-tuning workflow foundation

The Create Models workspace now exposes two truthful model-creation paths:

- **Prepare bundle only** — validates the selected base model + dataset version and writes a manifest/bundle for later use. This ends in `exported-without-training`, not `completed training`.
- **Start local training** — submits a Python-runtime local training job that performs real local work when the current runtime mode, base model, and dataset version all support it.

The studio is now explicitly mode-aware:

- **desktop development** — bundle preparation and real local training can both be available when the Python runtime is healthy, the desktop model-file bridge is connected, a local-file base model is selected, and the dataset version uses a supported task type
- **desktop production** — the same truthful local capabilities apply, with promotion back into the installed model library available when completed artifacts exist on disk
- **browser fallback** — the UI no longer pretends that full local training is available; it guides the user toward bundle preparation only and explains why desktop mode is needed for real training and promotion
- **runtime disabled or unavailable** — the workspace switches to a guided fallback, clearly explaining what is blocked and which next action is required

The current supported training backend is intentionally narrow but real:

- supported execution backend: **Python runtime local gradient trainer** (`python-runtime-local`)
- supported preparation backend: **Python runtime manifest/export path** (`python-runtime-manifest`)
- supported dataset tasks for real local training: `question_answering` and `chat_completion`
- persisted lifecycle states: `submitted`, `queued`, `running`, `completed`, `failed`, `cancelled`, `reconciliation-needed`, `partially-completed`, and `exported-without-training`
- durable outputs: manifest, checkpoints, metrics, logs, a diagnostic artifact on failure, and a final trained artifact when training completes
- post-training lifecycle: completed outputs can be inspected immediately, and in desktop file-backed modes they can be promoted into the installed model library without faking installation in browser fallback mode

This is still **not** the same thing as provider-hosted LoRA, QLoRA, or remote foundation-model fine-tuning. Unsupported provider backends remain explicit rather than being faked.

## Dataset generation truthfulness

Dataset example generation now prefers a **true provider/model-backed Python runtime path** when a supported provider is configured, and otherwise falls back truthfully:

- `provider-model-backed` — a real provider/model completion API generated the examples
- `python-runtime-local` — the explicit Python runtime local generator produced the examples without claiming provider backing
- `heuristic-fallback` — an explicit degraded browser fallback path generated examples heuristically

Supported dataset tasks remain:

- `question_answering`
- `chat_completion`

Each generation batch persists provenance and diagnostics, including provider/model identity when available, execution path, execution kind, timing, batch status (`completed` / `partial` / `failed` / `degraded`), and fallback reasons. Browser heuristic generation still exists only as an explicit degraded fallback path, while the Python runtime local generator is labeled separately from provider-backed execution.
