# Desktop Runtime and Hosts

This document explains how AI Loom Studio is delivered as desktop tooling and how the runtime/host model is implemented.

## Desktop-first architecture

The repository is clearly optimized for desktop use even though it preserves some browser-style fallbacks. The Electron host is responsible for creating the durable local environment that the renderer can use without becoming Node-aware.

The architectural split is:
- **Electron main process** = host bootstrap, local services, filesystem access, runtime discovery
- **Electron preload** = explicit bridge contract
- **React renderer** = product UI and dependency composition

## Electron main-process responsibilities

`electron/main/main.ts` is the Electron main-process executable entrypoint and now delegates host startup to the dedicated desktop host assembly (`src/hosts/desktop/DesktopHostEntrypoint.ts` + `src/hosts/desktop/DesktopHostCompositionRoot.ts`).

It is responsible for:
- creating the `BrowserWindow`
- resolving storage paths
- initializing production storage
- resolving the desktop Python runtime (post-login warmup)
- starting the desktop service supervisor (post-login warmup)
- building the bootstrap context exposed to the renderer
- registering IPC handlers for storage, workflow persistence, execution-run history, model-file operations, canonical asset reads, and thin agent-authoring backend operations

This makes Electron the host-level boundary where local capabilities become available.
Desktop startup orchestration is now explicit and stage-driven through the shared host bootstrap pipeline in the desktop composition root instead of ad hoc top-level startup flow.

## Preload bridge responsibilities

### Preload bridge module organization

The preload bridge is now split into domain-focused factory modules under `electron/preload/bridge/`, with `electron/preload.ts` acting as a composition root.

- `electron/preload.ts` remains responsible for sync bootstrap (`ipcRenderer.sendSync(DesktopBootstrapIpcChannels.bootstrap)`), runtime-readiness helpers, auth/deferred surface composition, and `contextBridge.exposeInMainWorld("aiLoomDesktop", desktopBridge)`.
- Domain bridge factories are isolated by contract area (`createStorageBridge`, `createSecretsBridge`, `createConnectivityBridge`, `createWorkflowsBridge`, `createExecutionRunsBridge`, `createWorkflowRunSummariesBridge`, `createModelFilesBridge`, `createCanonicalAssetsBridge`, `createStudioShellBridge`, `createRegistryBridge`, `createAgentsBridge`).
- Shared deferred-feature guard behavior (`is ready` checks, on-demand warmup triggering, and unavailable error generation) is centralized in `electron/preload/bridge/deferredFeatureGuards.ts` and injected into guarded bridge groups from preload composition.
- New preload bridge APIs should follow this pattern: add a domain factory module, accept dependencies explicitly via typed parameter objects, and compose it in `electron/preload.ts` without introducing mutable preload singletons.

`electron/preload.ts` exposes a single `aiLoomDesktop` object into the renderer. The bridge includes:
- bootstrap information
- key/value storage access
- workflow persistence operations
- execution-run history operations
- workflow-run summary history operations
- model-file operations
- canonical asset operations
- agent authoring/configuration operations (`create/update/get/list/delete/archive`, goal/policy/tool/memory/strategy configuration, and configuration validation)
- studio-shell authoring operations (`initialize/snapshot/start-session/create-draft/update-draft/update-dependencies/transition-lifecycle/publish-version/validate-draft`)

Electron preload execution uses a CommonJS preload bundle (`.vite/build/preload.cjs`) because preload scripts are loaded in a non-ESM context.

Agent authoring backend responses now use a hardened projection envelope (`agent`, `taxonomy`, optional `contract`) so desktop transport keeps read semantics aligned with `CompositionTaxonomyClassifier`/`CompositionAssetContractResolver`.
Phase 8.1 extends this desktop backend surface to a Studio-ready seam via `AgentStudioBackendApi`, adding runtime/session IPC operations (launch/trigger launch/session list/detail/run control/studio snapshot) on `ai-loom-desktop-agents:*` while keeping transport thin over existing application use cases.
Direction 5 Studio Shell operations are exposed the same way on `ai-loom-desktop-studio-shell:*` and delegate to `StudioShellBackendApi` over the real SQLite studio-shell repository.
Desktop launch/trigger IPC handlers now delegate into a real runner-backed execution path (`AgentRunnerService`) in the host bootstrap, including deterministic planning, capability orchestration, asset-backed memory retrieval/write, and SQLite session persistence.
Phase 8.5/8.6 UI flows remain contract-driven over this bridge: run-control UX maps directly to `control-run`, manual launches map to `launch`, and backend-trigger launches map to `trigger-launch`; unsupported automation systems (scheduler/cron/event bus/background orchestration) are intentionally not exposed in renderer-host contracts for this slice.
Agent authoring error responses are type-mapped from inner contracts (`AgentAuthoringError`, `AgentConfigurationValidationError`) with unknown failures normalized to `internal` (no substring-derived mapping).

`electron/src/shared/DesktopContracts.ts` defines the TypeScript contracts for those capabilities, which is a good practice because it creates a typed interface between host and renderer.

## Why this matters architecturally

The renderer composition can stay mostly platform-agnostic because desktop-only features are surfaced through typed bridge adapters rather than direct Node/Electron imports. That keeps host-specific logic concentrated in the outer layer.

## Workflow persistence across host modes

The workflow repository is host-aware.

### Desktop path
In desktop mode, the main process creates `DesktopWorkflowPersistence`, which stores:
- canonical workflow JSON files on disk
- workflow summaries in a SQLite index

The main process now also exposes a SQLite-backed execution-run repository through the preload bridge, using the desktop storage database as the durable structured source of truth for plan-backed execution history.

Workflow-run summary history now follows the same desktop persistence posture through `SqliteWorkflowRunSummaryRepository` and preload bridge operations (`ai-loom-desktop-workflow-runs:*`) so workflow-observability list views can query top-level run metadata without decoding full execution-run payloads.

That repository now uses explicit schema versioning and forward migrations via SQLite `user_version`, along with startup version checks. The intent is pragmatic rather than framework-heavy: repeated startup should be safe, legacy unversioned execution-run tables can be adopted and migrated in place, and newer unsupported schemas fail clearly instead of being used silently.

The renderer then uses `DesktopBridgeWorkflowRepository` for workflows and a desktop execution-run bridge repository for durable run history.

### Browser/degraded path
If the desktop workflow bridge is unavailable or the runtime mode is browser-oriented, the renderer can fall back to `BrowserStorageWorkflowRepository`, which stores workflow records in browser storage.
`StudioShellService` now also follows this bounded fallback posture for Studio Shell operations through `src/ui/composition/BrowserStudioShellBridgeFallback.ts`, which reuses in-process backend APIs over `InMemoryStudioShellRepository` when the desktop preload Studio Shell bridge is absent.
`RegistryService` now follows the same desktop-first-with-fallback pattern through `src/ui/composition/BrowserRegistryBridgeFallback.ts`, so Explore/Registry calls use in-process `RegistryBackendApi` when desktop registry preload contracts are unavailable in browser development mode.
That registry fallback shares the same in-memory workflow-persistence repository as the Studio Shell fallback, keeping persisted-workflow Explore entries coherent across Build/Explore/Run flows during browser-hosted development.
System-runtime callback delivery in that fallback path now signs callback payloads through a runtime-compatible HMAC seam (`ExecutionCallbackDispatcher` uses Web Crypto when available and falls back to Node crypto dynamically), which avoids browser bundle failures from top-level Node module imports.

For the current Direction 3 MCP registry slice, installed MCP tool records are also intentionally persisted via browser `localStorage` (`LocalStorageMcpToolRegistryRepository`) to match the existing renderer-side fallback persistence pattern instead of introducing a new desktop-only storage seam yet.

This means the host architecture is not just about display; it directly affects persistence durability and operational guarantees.

## Runtime orchestration and managed services

The product also has a managed runtime story, especially for Python-backed capabilities.

### Python runtime
The UI composition builds a `PythonRuntimeConfig`, runtime client, runtime manager, and service-definition wiring. The desktop host also resolves a desktop Python runtime and starts the service supervisor.

For desktop development provisioning, the supervisor treats the local Python environment as a managed disposable artifact rather than durable state. Provisioning performs explicit venv/pip integrity checks (including pip import/command checks and invalid distribution artifacts such as `~ip*.dist-info`), attempts bounded safe repair (`ensurepip --upgrade`) only when trustworthy, and otherwise builds a fresh staged environment under `.venv.managed/` before promoting it active. Prior broken environments are marked invalid and cleanup is best-effort so Windows lock/delete failures do not trap provisioning in repeated in-place mutation loops.

Provisioning and launchability are now intentionally separate truths:
- provisioning success means dependency installation/integrity succeeded
- launchability success means runtime import preflight succeeded on this host (`import app.main`)

The supervisor now persists launchability preflight results in provisioning metadata and can surface `provisioned-unlaunchable` for host/runtime-incompatible dependency builds (for example CPU-incompatible native wheels). Runtime diagnostics now distinguish unprovisioned/provisioning/provision-failed/corrupted/provisioned-unlaunchable/reprovision-needed states so the app does not over-claim runtime health.

Runtime truth is now explicitly split across three surfaces: baseline runtime boot health, capability-level readiness/unavailability (dependency/platform/resource constrained), and per-request execution readiness checks. Optional heavyweight capability failures are surfaced as capability/task unavailability rather than forcing the whole runtime into a fake healthy-or-dead binary.

Browser and desktop startup flows now also check supervisor service state after `ensure-running`, so known startup-fatal causes are surfaced directly instead of being primarily reported as port-wait timeouts.

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

## Offline local-mode authority boundary update (Feature 19 / Story 19.1.1)

- Desktop offline behavior now has an explicit authority model and resource boundary catalog:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
  - `src/application/common/OfflineLocalModeResynchronization.ts`
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
  - `src/hosts/desktop/DesktopConnectivityStateService.ts`
- Canonical architecture note:
  - `docs/architecture/offline-local-mode-authority-boundaries.md`
- Core posture:
  - desktop can cache/view/edit selected resources and queue explicit mutation envelopes while disconnected,
  - desktop connectivity transitions are host-owned and explicit (`connected`, `degraded`, `reconnecting`, `disconnected`) using transport/session/trust probes,
  - deliberate offline local-mode intent is distinct from transient reconnecting transport failures,
  - authoritative control-plane truth remains server-owned,
  - reconnect requires explicit apply/conflict/reject reconciliation outcomes and prohibits silent global divergence.

Direction 3 trust updates now also use local-first persistence seams for MCP governance: tool credential records prefer the desktop secure-storage bridge (Electron `safeStorage`) and fall back to encrypted local storage when unavailable; execution-policy audit decisions remain local-storage-backed, and ordinary installed-tool/read-model paths continue to avoid returning raw secret values.

## AI Loom image manipulation update: runtime launch window contract and host flow (stories 8.1-8.2)

- Desktop Studio Shell bridge now includes a dedicated runtime-window launch IPC seam (`ai-loom-desktop-studio-shell:runtime-window:launch`) that accepts only validated runtime launch contracts.
- Launch payloads are normalized and versioned through one shared contract (`SystemRuntimeWindowLaunchContract`) before reaching host window creation.
- Electron main now reuses existing window bootstrap mechanics to open a separate runtime-focused window and passes only contract-defined launch data to renderer query transport (`runtimeWindowLaunch`).
- Runtime window reuse is bounded through contract window intent (`reuseWindowKey`) rather than ad hoc global state.

## AI Loom image manipulation update: runtime hydration and binding posture (stories 8.3-8.4)

- Runtime-window host rendering now composes a dedicated hydration stage in renderer runtime seams (`SystemRuntimeWindowHydrationService`) after launch-contract parsing and snapshot loading, keeping host transport thin while moving launch-state normalization into one inspectable UI-runtime service.
- Hydrated runtime state now stays contract-driven and storage-safe: dataset/storage identity is carried as logical refs/instance ids from launch + serialization context and not converted into renderer-facing filesystem paths.
- Runtime startup now surfaces normalized hydration issues (warning/error) for invalid/missing launch dependencies instead of silent failure, while still allowing bounded fallback hydration from launch defaults when snapshot data is unavailable.

## AI Loom image manipulation update: runtime reopen and restore lifecycle hardening (stories 8.7-8.8)

- Runtime-window relaunch now reuses persisted runtime-session context through a single reopen preparation seam (`SystemRuntimeWindowRestoreService.buildReopenRequest`) that augments normalized launch contracts with prior session id and persisted runtime-safe state overlays.
- Runtime-window host restore now composes launch resolution, hydration, persisted-session lookup, and stale-reference handling in one orchestrator (`src/ui/runtime/SystemRuntimeWindowRestoreService.ts`) instead of introducing a parallel restore stack.
- Restored state is layered over hydrated defaults so runtime windows remain runnable without manual reconfiguration while still recovering prior property/selection/panel working context.
- Persisted stale references now degrade safely: unresolved binding references are filtered and reported as normalized restore warnings (`runtime-window.restore.*`) rather than crashing runtime-window startup.
- Lifecycle coverage now includes launch payload normalization, hydration/run-default initialization, restore success on reopen, stale-reference degradation, and invalid launch-query normalization (`src/ui/runtime/tests/SystemRuntimeWindowLifecycle.test.ts`).

## AI Loom image manipulation update: runtime repository installer contracts + git installer (stories 9.1-9.2)

- Added a reusable runtime repository installer contract seam in `src/application/runtime/RuntimeRepositoryInstallerContract.ts`:
  - generic install/update/status/validate/diagnostics request and result contracts,
  - repository-source metadata and installed-repository metadata,
  - deterministic install-location key generation for provisioned system-managed runtime locations,
  - normalized operation error and issue contracts.
- Added a concrete Git-backed installer in `src/infrastructure/runtime/GitRuntimeRepositoryInstaller.ts`:
  - deterministic target location resolution under provisioned roots,
  - clone/install and fetch/update flows with revision capture,
  - safe re-entry behavior for partial/interrupted installs,
  - status inspection, validation, and diagnostics on the shared contract surface.
- Added focused coverage:
  - `src/application/runtime/tests/RuntimeRepositoryInstallerContract.test.ts`
  - `src/infrastructure/runtime/tests/GitRuntimeRepositoryInstaller.test.ts`

## AI Loom image manipulation update: Comfy runtime installation asset + installer orchestration (stories 9.3-9.4)

- Added a first-class Comfy runtime installation asset contract in `src/application/runtime/ComfyRuntimeInstallationAsset.ts`:
  - versioned, inspectable runtime-installation metadata (source/revision pinning/install target/runtime start/health/capabilities/requirements),
  - deterministic provisioned-root request resolution through existing runtime repository installer contracts,
  - path-free install target intent (`targetRootKey`, deterministic location strategy) suitable for shared runtime provisioning.
- Added `src/application/runtime/ComfyRuntimeInstallerOrchestrationService.ts`:
  - composes existing repository installer mechanics with explicit phase hooks for environment prep, dependency install, custom nodes, model validation, and runtime start/health validation,
  - supports safe re-entry by inspecting existing repository state before install/update actions,
  - returns normalized orchestration status, per-phase outcomes, and actionable diagnostics, including explicit `not-implemented` phase reporting for later story seams.
- Image-manipulation system template composition now carries an explicit default runtime-installation asset reference through `ReferenceImageSystemTemplate` / `ImageManipulationSystemTemplate` with validation coverage.

## AI Loom image manipulation update: custom node install + runtime asset validation (stories 9.7-9.8)

- Comfy runtime installation metadata now declares structured custom-node requirements and runtime asset requirements (`checkpoint`, `vae`, `faceid-model`) in `src/application/runtime/ComfyRuntimeInstallationAsset.ts`.
- Custom-node install/update is now implemented as a dedicated Comfy orchestration hook (`src/infrastructure/runtime/ComfyRuntimeCustomNodeInstallationHooks.ts`) that composes the shared runtime repository installer contract for deterministic `custom_nodes` installs with install/update/recovery/diagnostics normalization.
- Runtime model/asset validation is now implemented as a dedicated Comfy orchestration hook (`src/infrastructure/runtime/ComfyRuntimeAssetValidationHook.ts`) driven by requirement metadata, with explicit normalized statuses:
  - `present-valid`
  - `missing-required`
  - `missing-optional`
  - `incompatible`
  - `unknown-unverifiable`
- Runtime installer composition now wires these hooks by default (`src/infrastructure/runtime/ComfyRuntimeInstallerComposition.ts`), so orchestration phase output carries inspectable custom-node and model-validation metadata for installer diagnostics and runtime launch/readiness consumers.
- Added focused tests:
  - `src/application/runtime/tests/ComfyRuntimeInstallationAsset.test.ts`
  - `src/application/runtime/tests/ComfyRuntimeInstallerOrchestrationService.test.ts`

## AI Loom image manipulation update: Comfy Python environment + dependency install hooks (stories 9.5-9.6)

- Added a reusable Python provisioning/dependency state contract in `src/application/runtime/PythonRuntimeProvisioningContract.ts`:
  - normalized detection/provisioning/dependency statuses and issue/error/remediation diagnostics,
  - structured command diagnostics for inspectable subprocess history,
  - persisted dependency install snapshot schema (`started`/`completed`/`failed`/`skipped`) with last-step and remediation metadata.
- Added concrete Comfy runtime environment/dependency phase hooks in `src/infrastructure/runtime/ComfyRuntimePythonHooks.ts`:
  - Python interpreter detection with requirement parsing (`python>=x.y`) and incompatible/missing diagnostics,
  - deterministic venv location provisioning (`<installDirectory>/.venv`) with safe staged create/promote and partial-environment recovery,
  - pip integrity/bootstrap checks (`import pip`, `ensurepip --upgrade`, `pip --version`) before dependency install,
  - repeatable requirements installation with persisted install-state metadata at `.ai-loom-comfy-python-dependencies.json`,
  - explicit missing-requirements, pip-bootstrap, install-failure, and partial-retry diagnostics/remediation hints.
- Added orchestration composition helper `src/infrastructure/runtime/ComfyRuntimeInstallerComposition.ts` that wires these hooks into `ComfyRuntimeInstallerOrchestrationService` as the default environment/dependency phase implementation seam.
- Added focused tests:
  - `src/infrastructure/runtime/tests/ComfyRuntimePythonHooks.test.ts`
  - `src/infrastructure/runtime/tests/ComfyRuntimeInstallerComposition.test.ts`

## AI Loom image manipulation update: Comfy runtime lifecycle + installer state recovery (stories 9.9-9.10)

- Runtime lifecycle/process management now has a dedicated infrastructure hook (`src/infrastructure/runtime/ComfyRuntimeLifecycleHooks.ts`) wired into installer orchestration as the runtime-validation phase.
  - supports `start`, `stop`, `restart`, `inspect`, and validation-driven launch readiness checks;
  - resolves runtime launch command from the provisioned Comfy virtual environment (`<installDirectory>/.venv/.../python`) first;
  - injects runtime host/port/environment configuration from orchestration context;
  - validates readiness/liveness endpoint URLs and polls for health with explicit timeout outcomes;
  - distinguishes normalized lifecycle states (`starting`, `healthy`, `unhealthy`, `stopped`, `unknown`, `timed-out`) with inspectable diagnostics metadata.
- Installer/runtime state persistence now uses a reusable contract seam (`src/application/runtime/ComfyRuntimeInstallerStateContract.ts`) with a filesystem-backed implementation (`src/infrastructure/runtime/FileComfyRuntimeInstallerStateStore.ts`).
  - persisted state now records phase status by step, repository/runtime revision metadata, runtime launch/health metadata, timestamps, and structured issues;
  - orchestration now loads persisted state, reconciles observed repository/runtime conditions, and emits explicit mismatch diagnostics instead of silently trusting stale metadata;
  - resume behavior is idempotent for completed setup phases (`environment`, `dependencies`, `custom-nodes`) when persisted state still matches observed conditions, while stale/mismatched state triggers full recovery execution.
- Runtime installer composition now wires lifecycle + state-store hooks by default (`src/infrastructure/runtime/ComfyRuntimeInstallerComposition.ts`) so image-manipulation runtime provisioning flows are recovery-ready without exposing user-managed install/runtime paths.
- Added focused tests:
  - `src/infrastructure/runtime/tests/ComfyRuntimeLifecycleHooks.test.ts`
  - `src/infrastructure/runtime/tests/FileComfyRuntimeInstallerStateStore.test.ts`
  - `src/application/runtime/tests/ComfyRuntimeInstallerOrchestrationService.test.ts` (resume/reconciliation additions)

## AI Loom image manipulation update: installer diagnostics system exposure + coverage hardening (stories 9.11-9.12)

- Added a reusable system-facing diagnostics projection seam at `src/application/runtime/ComfyRuntimeSystemDiagnostics.ts`.
  - maps installer orchestration + persisted state into one structured diagnostics model (phase statuses, repository/revision state, runtime lifecycle health, persisted-state recovery, normalized failures, and next-action remediation guidance);
  - includes bounded runtime readiness classification used by higher-level system/runtime consumers (`ready`, `partially-configured`, `unhealthy`, `missing-dependencies-or-assets`, `recoverable`).
- Installer orchestration output now carries this projection directly as `systemDiagnostics` on `ComfyRuntimeInstallerOrchestrationResult` so callers do not need ad hoc parsing.
- Runtime-window launch/hydration seams now accept and read this diagnostics contract through launch context payload:
  - launch resolver can include diagnostics in `runtimeContextPayload.runtimeDiagnostics`,
  - hydration validates/normalizes the payload and exposes it on hydrated runtime state for runtime-window/status consumers.
- Image manipulation system template runtime metadata now pins the diagnostics contract version so system/template validation paths have an explicit diagnostics seam.
- Added focused tests for diagnostics projection + wiring:
  - `src/application/runtime/tests/ComfyRuntimeSystemDiagnostics.test.ts`
  - `src/application/runtime/tests/ComfyRuntimeInstallerOrchestrationService.test.ts` (system diagnostics assertions)
  - `src/application/system-runtime/tests/SystemRuntimeWindowLaunchResolver.test.ts`
  - `src/ui/runtime/tests/SystemRuntimeWindowHydrationService.test.ts`
  - `src/application/system-studio/tests/ImageManipulationSystemTemplate.test.ts`
  - `src/application/system-studio/tests/ReferenceImageSystemTemplate.test.ts`

## Desktop initialization progress, timing, and auth bootstrap resilience

- Renderer startup now uses an explicit initialization stage contract in `src/ui/shared/initialization/AppInitializationProgress.ts` with user-facing labels for:
  - preparing desktop runtime
  - starting local services
  - starting identity services
  - loading saved session
  - validating session
  - loading workspace context
  - ready for sign in
  - ready
- App bootstrap UI in `src/ui/App.tsx` now renders changing status text + staged progress while session bootstrap executes, including a bounded “Still working on setup...” message when a phase exceeds the expected duration.
- Session bootstrap in `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts` is now explicitly timed/logged and bounded with timeout defaults for startup-critical identity calls:
  - `resolveAuthenticatedSession`
  - `resolveSessionActorContext`
- Shared API request timeout behavior now classifies timeout aborts as `domainCode: request-timeout` in `src/ui/shared/api/SharedApiClient.ts` so startup flows can distinguish timeout from user cancellation and route users to sign-in instead of leaving bootstrap pending.
- Electron desktop startup now emits phased startup timing and memory checkpoints in `electron/main/main.ts` for:
  - `desktop-startup.host-bootstrap`
  - `desktop-startup.pre-login-auth-shell-bootstrap`
  - `desktop-startup.identity-auth-host-readiness`
  - `desktop-startup.main-window-creation`
  - `desktop-startup.post-login-warmup`
  - `desktop-startup.deferred-feature-registration`
- Startup phase events are logged on `[ai-loom][startup]` and memory snapshots are logged on `[ai-loom][startup-memory]`, so slow pre-login boot can be separated from slow post-login warmup.
