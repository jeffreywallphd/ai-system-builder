# Desktop Runtime and Hosts

This document explains how AI Loom Studio is delivered as desktop tooling and how the runtime/host model is implemented.

## Desktop-first architecture

The repository is clearly optimized for desktop use even though it preserves some browser-style fallbacks. The Electron host is responsible for creating the durable local environment that the renderer can use without becoming Node-aware.

The architectural split is:
- **Electron main process** = host bootstrap, local services, filesystem access, runtime discovery
- **Electron preload** = explicit bridge contract
- **React renderer** = product UI and dependency composition

## Electron main-process responsibilities

`electron/main/main.ts` is the main desktop composition point.

It is responsible for:
- creating the `BrowserWindow`
- resolving storage paths
- initializing production storage
- resolving the desktop Python runtime
- starting the desktop service supervisor
- building the bootstrap context exposed to the renderer
- registering IPC handlers for storage, workflow persistence, execution-run history, model-file operations, canonical asset reads, and thin agent-authoring backend operations

This makes Electron the host-level boundary where local capabilities become available.

## Preload bridge responsibilities

`electron/preload.ts` exposes a single `aiLoomDesktop` object into the renderer. The bridge includes:
- bootstrap information
- key/value storage access
- workflow persistence operations
- execution-run history operations
- model-file operations
- canonical asset operations
- agent authoring/configuration operations (`create/update/get/list/delete/archive`, goal/policy/tool/memory/strategy configuration, and configuration validation)
- studio-shell authoring operations (`initialize/snapshot/start-session/create-draft/update-draft/update-dependencies/transition-lifecycle/publish-version/validate-draft`)

Agent authoring backend responses now use a hardened projection envelope (`agent`, `taxonomy`, optional `contract`) so desktop transport keeps read semantics aligned with `CompositionTaxonomyClassifier`/`CompositionAssetContractResolver`.
Phase 8.1 extends this desktop backend surface to a Studio-ready seam via `AgentStudioBackendApi`, adding runtime/session IPC operations (launch/trigger launch/session list/detail/run control/studio snapshot) on `ai-loom-desktop-agents:*` while keeping transport thin over existing application use cases.
Direction 5 Studio Shell operations are exposed the same way on `ai-loom-desktop-studio-shell:*` and delegate to `StudioShellBackendApi` over the real SQLite studio-shell repository.
Desktop launch/trigger IPC handlers now delegate into a real runner-backed execution path (`AgentRunnerService`) in the host bootstrap, including deterministic planning, capability orchestration, asset-backed memory retrieval/write, and SQLite session persistence.
Phase 8.5/8.6 UI flows remain contract-driven over this bridge: run-control UX maps directly to `control-run`, manual launches map to `launch`, and backend-trigger launches map to `trigger-launch`; unsupported automation systems (scheduler/cron/event bus/background orchestration) are intentionally not exposed in renderer-host contracts for this slice.
Agent authoring error responses are type-mapped from inner contracts (`AgentAuthoringError`, `AgentConfigurationValidationError`) with unknown failures normalized to `internal` (no substring-derived mapping).

`electron/shared/DesktopContracts.ts` defines the TypeScript contracts for those capabilities, which is a good practice because it creates a typed interface between host and renderer.

## Why this matters architecturally

The renderer composition can stay mostly platform-agnostic because desktop-only features are surfaced through typed bridge adapters rather than direct Node/Electron imports. That keeps host-specific logic concentrated in the outer layer.

## Workflow persistence across host modes

The workflow repository is host-aware.

### Desktop path
In desktop mode, the main process creates `DesktopWorkflowPersistence`, which stores:
- canonical workflow JSON files on disk
- workflow summaries in a SQLite index

The main process now also exposes a SQLite-backed execution-run repository through the preload bridge, using the desktop storage database as the durable structured source of truth for plan-backed execution history.

That repository now uses explicit schema versioning and forward migrations via SQLite `user_version`, along with startup version checks. The intent is pragmatic rather than framework-heavy: repeated startup should be safe, legacy unversioned execution-run tables can be adopted and migrated in place, and newer unsupported schemas fail clearly instead of being used silently.

The renderer then uses `DesktopBridgeWorkflowRepository` for workflows and a desktop execution-run bridge repository for durable run history.

### Browser/degraded path
If the desktop workflow bridge is unavailable or the runtime mode is browser-oriented, the renderer can fall back to `BrowserStorageWorkflowRepository`, which stores workflow records in browser storage.

For the current Direction 3 MCP registry slice, installed MCP tool records are also intentionally persisted via browser `localStorage` (`LocalStorageMcpToolRegistryRepository`) to match the existing renderer-side fallback persistence pattern instead of introducing a new desktop-only storage seam yet.

This means the host architecture is not just about display; it directly affects persistence durability and operational guarantees.

## Runtime orchestration and managed services

The product also has a managed runtime story, especially for Python-backed capabilities.

### Python runtime
The UI composition builds a `PythonRuntimeConfig`, runtime client, runtime manager, and service-definition wiring. The desktop host also resolves a desktop Python runtime and starts the service supervisor.

For desktop development provisioning, the supervisor treats the local Python environment as a managed disposable artifact rather than durable state. Provisioning performs explicit venv/pip integrity checks (including pip import/command checks and invalid distribution artifacts such as `~ip*.dist-info`), attempts bounded safe repair (`ensurepip --upgrade`) only when trustworthy, and otherwise builds a fresh staged environment under `.venv.managed/` before promoting it active. Prior broken environments are marked invalid and cleanup is best-effort so Windows lock/delete failures do not trap provisioning in repeated in-place mutation loops. Runtime diagnostics distinguish unprovisioned/provisioning/provision-failed/corrupted/reprovision-needed states so the app does not over-claim runtime health.

### Runtime dependency orchestration
The infrastructure bootstrap and UI composition now share a centralized runtime-dependency composition module that builds the core `Python runtime -> MCP runtime` graph and can append other runtime-backed capability registrations such as document conversion, model training, and narrow MCP server-operation execution while still letting each outer-layer composition root inject its own health adapter.

The orchestration layer is responsible for:
- registering runtime-backed dependencies in one reusable outer-layer composition entry point
- resolving dependency chains with fallback and cycle detection
- caching operational checks with explicit refresh/invalidation controls
- returning an operational resolution model instead of a binary availability flag

The operational state model is intentionally richer than before. A runtime dependency can resolve as:
- `disabled`
- `unavailable`
- `provisioning`
- `starting`
- `healthy`
- `degraded`
- `failed`
- `stopped`
- `unknown`

Each resolution also carries dependency-chain information, fallback usage, checked timestamps, metadata, detail text, and remediation hints. That makes the orchestration layer a shared operational foundation for runtime-backed features without pushing infrastructure details into the application contracts.

The current rollout now directly gates:
- MCP runtime access
- delegated workflow execution selection
- Python-backed document conversion
- Python-backed dataset generation
- Python-backed model training and model-creation environment checks

Managed-runtime lifecycle surfaces such as the runtime console and managed-services store now also trigger targeted orchestration refresh/invalidation so downstream runtime-backed checks recompute after Python runtime changes. Higher-level diagnostics in MCP status, document-conversion failures, and model-training environment reporting now surface orchestration detail and remediation hints more consistently.

This is an architectural sign that runtime availability is considered part of the application's operational model, not an incidental implementation detail.

### Managed services
Managed service definitions, supervisor access, health status, and event streaming are modeled as a distinct subsystem. That fits the desktop-tooling intention well because local runtimes are treated as governable services rather than invisible helper processes.

## Host/runtime modes in practice

The code supports multiple practical modes:

- **Desktop development**
- **Desktop production**
- **Browser development**
- **Disabled runtime / degraded local behavior**

Configuration objects such as `AppRuntimeConfig`, `PythonRuntimeConfig`, and related storage/runtime settings drive those modes.

## Strengths of the current host model

### Clear outer boundary
Electron is kept at the edge, with typed contracts into the renderer.

### Durable desktop persistence
Desktop workflow persistence intentionally combines filesystem JSON with SQLite indexing, and desktop execution-run persistence now uses SQLite as the preferred structured source of truth with browser/local-storage fallbacks only when the desktop bridge is unavailable. The execution-run schema now also stores query-friendly run summaries beside the canonical JSON snapshot so history/detail surfaces can rely on engine-native fields first without decoding feature-specific artifacts, including filtering by unit kind, provenance classification, flow grouping, and basic started/updated time windows. Non-SQLite execution-run repositories now also persist an explicit query index envelope for parity, so those same query dimensions stay available in fallback modes. That is a strong fit for local authoring tools that need truthful history, filtering, and durable inspection.

### Runtime-aware product design
The system acknowledges runtime health, startup, ownership, supervision, and degradation, which is essential for trustworthy desktop tooling.


## What is intentionally still out of scope

This orchestration work is still deliberately narrow. It now provides a stronger shared foundation for runtime-backed capabilities, but it does **not** yet orchestrate every subsystem that might eventually depend on runtime state. In particular, model-file bridge capability policies remain a future expansion area rather than part of the current orchestration rollout.

Keeping the scope limited avoids turning runtime orchestration into a broad repo-wide refactor before the core contracts and MCP integration settle.

## Recommended next steps

The most natural next architectural steps are:
1. extend the shared orchestration model into model-file bridge capability policies and any other runtime-backed desktop-only permissions
2. keep tightening lifecycle-triggered orchestration recomputation so more host/supervisor events can invalidate the smallest necessary runtime dependency subgraph
3. standardize orchestration-aware diagnostics in more user-facing capability summaries and future runtime-backed tools
4. decide whether the remaining composition duplication between renderer and infrastructure should be reduced further once more runtime-backed flows adopt the shared orchestration layer

## TODO

- The preload bridge currently relies on synchronous IPC for many operations. That is simple and works, but it can become a scaling and responsiveness concern as payloads or operation frequency grow.
- Model-file operations currently expose a broad host capability surface through the preload bridge. If the product evolves toward stronger trust boundaries, this area may need tighter scoping and policy controls.
- Runtime/bootstrap composition is split between the Electron host and the renderer composition; the long-term architecture would benefit from a clearer statement of what must be host-owned versus renderer-owned.

Direction 3 trust updates now also use local-first persistence seams for MCP governance: tool credential records prefer the desktop secure-storage bridge (Electron `safeStorage`) and fall back to encrypted local storage when unavailable; execution-policy audit decisions remain local-storage-backed, and ordinary installed-tool/read-model paths continue to avoid returning raw secret values.
