# AI Companion: Desktop Runtime and Hosts

## Core fact
Electron is the desktop host boundary; the renderer accesses desktop capabilities through preload bridge contracts.
Desktop host startup is now routed through a dedicated desktop host assembly (`src/hosts/desktop/DesktopHostEntrypoint.ts` and `src/hosts/desktop/DesktopHostCompositionRoot.ts`).
Python runtime resolution and local service-supervisor startup now occur in post-login warmup instead of pre-login window bootstrap.

## Main files
- Desktop host assembly entrypoint/composition root: `src/hosts/desktop/DesktopHostEntrypoint.ts`, `src/hosts/desktop/DesktopHostCompositionRoot.ts`
- Main process bootstrap: `electron/main/main.ts`
- Preload bridge: `electron/preload.ts`
- Preload build artifact: `.vite/build/preload.cjs` (CommonJS for Electron preload execution)
- Bridge contracts: `electron/src/shared/DesktopContracts.ts`
- Desktop workflow persistence: `src/infrastructure/desktop/DesktopWorkflowPersistence.ts`
- Desktop execution-run persistence: `src/infrastructure/filesystem/execution/SqliteExecutionRunRepository.ts`
- Desktop agent-authoring backend API: `src/infrastructure/api/agents/AgentAuthoringBackendApi.ts`
- Desktop-backed workflow repo used by renderer: `src/infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`

## Storage modes to mention
- Desktop canonical path: filesystem JSON + SQLite workflow index plus SQLite execution-run history with explicit schema versioning/migration via SQLite `user_version`
- Workflow run observability summaries now share that same desktop SQLite durability path through preload/IPC bridge contracts (`ai-loom-desktop-workflow-runs:*`) backed by `SqliteWorkflowRunSummaryRepository`.
- Desktop backend bridge now also includes thin agent-authoring IPC endpoints (`ai-loom-desktop-agents:*`) mapped to application use cases and structured validation errors.
- Phase 8.1 now consolidates Studio-facing desktop agent transport through `AgentStudioBackendApi` and extends `ai-loom-desktop-agents:*` with runtime/session endpoints (`launch`, `trigger-launch`, `list-sessions`, `get-session`, `control-run`, `studio-snapshot`) while staying thin over Phase 6/7 use cases.
- Phase 8.5/8.6 renderer flows consume those same host contracts directly: run controls call `control-run`, manual launches call `launch`, and backend-trigger launches call `trigger-launch`, with no renderer-owned scheduler/automation runtime.
- Desktop launch/trigger handlers now execute through a real host-wired runner path (`AgentRunnerService`) with deterministic planning + capability execution + asset-backed memory + SQLite-backed session persistence.
- Direction 5 Studio Shell transport now follows the same thin-host pattern on `ai-loom-desktop-studio-shell:*`, delegating to `StudioShellBackendApi` backed by `SqliteStudioShellRepository` for durable studio/session/draft/version state.
- Renderer-side `StudioShellService` now has an explicit browser fallback bridge adapter (`src/ui/composition/BrowserStudioShellBridgeFallback.ts`) that reuses in-process backend APIs over `InMemoryStudioShellRepository` when desktop preload bridge contracts are unavailable, preventing runtime crashes in browser-hosted development while keeping the same backend contract surface.
- Renderer-side `RegistryService` now mirrors that fallback posture via `src/ui/composition/BrowserRegistryBridgeFallback.ts`: when desktop registry preload contracts are unavailable, it routes through in-process `RegistryBackendApi` and shares the same in-memory workflow-persistence fallback repository used by Studio Shell so Explore remains available in browser development mode.
- System-runtime callback delivery signing now uses a runtime-compatible HMAC seam in `ExecutionCallbackDispatcher` (Web Crypto when available, Node crypto as fallback), so browser fallback runtime paths no longer require top-level Node module imports.
- Direction 5 Epic 6 runtime transport now extends that same Studio Shell host seam with bounded system-runtime endpoints (`system-runtime:start|status|trace|result`) delegated to `SystemRuntimeBackendApi` over the same repository-backed src/application/runtime path.
- Agent authoring backend responses now use a hardened projection envelope (`agent`, `taxonomy`, optional `contract`) so transport read models classify/project through shared composition seams.
- Agent authoring error responses are type-mapped from inner contracts (`AgentAuthoringError`, `AgentConfigurationValidationError`) with unknown failures normalized to `internal` (no substring-derived mapping).
- Fallback path: browser/local storage repositories
- Execution-run queries now also support unit-kind/provenance/flow/time filtering in addition to status/execution-kind/metadata filters, and non-SQLite repositories persist an explicit query-index envelope so those filters remain available in fallback modes.
- MCP installed-tool registry persistence is intentionally in browser `localStorage` in the current slice (`LocalStorageMcpToolRegistryRepository`), matching other renderer fallback repositories; this is a staging seam until/if registry durability needs to move to desktop bridge persistence.
- MCP trust-policy persistence is local-first but hardened: MCP credential records prefer desktop secure-encryption bridge storage (Electron `safeStorage`) and fall back to encrypted local storage; execution audit decisions remain local-storage-backed (`LocalStorageMcpToolExecutionAuditSink`).

## Runtime modes to mention
- desktop development
- desktop production
- browser development
- runtime disabled/degraded states

## Runtime orchestration update
- Runtime dependency graph composition is now centralized in a reusable outer-layer module instead of being duplicated ad hoc in the infrastructure registry and UI composition.
- The shared graph now covers `python-runtime -> mcp-runtime` plus appended runtime-backed capability gates for delegated workflow execution, document conversion, dataset generation, model training, and narrow MCP server-operation execution in the UI composition.
- Resolutions now carry an operational state model (`disabled`, `unavailable`, `provisioning`, `starting`, `healthy`, `degraded`, `failed`, `stopped`, `unknown`), fallback information, timestamps, metadata, and remediation hints.
- The orchestrator also supports explicit `refresh`, single-dependency invalidation, and global invalidation so runtime-backed capabilities can recompute status after managed-runtime changes; the runtime console and managed-services store now use those hooks.
- Python runtime provisioning in desktop development treats the managed environment as disposable: supervisor provisioning verifies venv/pip integrity before pip operations (including invalid-distribution detection), performs bounded safe `ensurepip --upgrade` repair only when trustworthy, and otherwise provisions/validates a fresh staged environment (`.venv.managed/*`) before promoting it active.
- Runtime launchability is a separate truth from provisioning: after install/integrity checks, provisioning now runs an import preflight (`import app.main`) and persists launchability diagnostics.
- Provisioning/runtime diagnostics must stay truthful across these flows and distinguish at least unprovisioned, provisioning, provisioned, provisioned-unlaunchable, provision-failed, corrupted environment, and needs-reprovision states.
- Browser/desktop startup now checks supervisor state after `ensure-running` so known startup-fatal failures are surfaced directly instead of being masked by generic port-wait timeouts.
- Runtime truth now has three distinct layers: baseline runtime boot health, capability readiness (dependency/platform/resource constrained vs ready), and execution-time task readiness checks for optional heavyweight local flows such as local gradient training.

## Caveat
The preload bridge uses synchronous IPC and exposes storage/workflow/model-file capabilities.

## What remains out of scope
- Orchestration is not yet rolled out across model-file bridge policies.

## TODO
- When discussing security or performance, mention the sync IPC tradeoff explicitly.

## Offline local-mode update (Feature 19 / Story 19.1.1)

- Desktop offline/local-mode authority boundaries are now explicit and versioned through:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
  - `src/application/common/OfflineLocalModeResynchronization.ts`
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
  - `src/hosts/desktop/DesktopConnectivityStateService.ts`
- Canonical architecture note for this slice:
  - `docs/architecture/offline-local-mode-authority-boundaries.md`
- Boundary stance:
  - desktop remains control-plane client only,
  - offline cache/draft/queued mutation/ephemeral local state are explicitly separated,
  - connectivity transitions are host-owned and explicit (`connected`, `degraded`, `reconnecting`, `disconnected`) from transport/session/trust/offline-intent probes,
  - deliberate offline mode is distinguished from transient transport reconnecting states through structured reason metadata,
  - reconnect decisions are explicit (`apply`, `conflict`, `reject`) and no-silent-divergence is enforced.

## AI Loom image manipulation update: runtime launch window contract and host flow (stories 8.1-8.2)

- Desktop Studio Shell bridge now includes a dedicated runtime-window launch IPC seam (`ai-loom-desktop-studio-shell:runtime-window:launch`) that accepts only validated runtime launch contracts.
- Launch payloads are normalized and versioned through one shared contract (`SystemRuntimeWindowLaunchContract`) before reaching host window creation.
- Electron main now reuses existing window bootstrap mechanics to open a separate runtime-focused window and passes only contract-defined launch data to renderer query transport (`runtimeWindowLaunch`).
- Runtime window reuse is bounded through contract window intent (`reuseWindowKey`) rather than ad hoc global state.

## AI Loom image manipulation update: runtime hydration + binding posture (stories 8.3-8.4)

- Runtime-window renderer flow now includes a dedicated hydration seam (`src/ui/runtime/SystemRuntimeWindowHydrationService.ts`) layered after launch-contract parsing/snapshot read; host IPC remains thin and contract transport stays unchanged.
- Hydrated runtime state stays logical-reference-first (dataset instance ids, storage instance refs, binding ids) and avoids UI-facing raw path exposure.
- Hydration now emits normalized warning/error issues for incomplete or invalid launch/snapshot inputs, with bounded fallback hydration from launch/template defaults.

## AI Loom image manipulation update: runtime reopen + restore lifecycle hardening (stories 8.7-8.8)

- Runtime-window launch reopen now composes persisted logical runtime session state into launch contracts before host handoff (`SystemRuntimeWindowRestoreService.buildReopenRequest`), including runtime session id carry-forward and persisted runtime-state overlays (property, selection, panel state).
- Runtime-window host startup now uses one restore orchestrator seam (`src/ui/runtime/SystemRuntimeWindowRestoreService.ts`) that composes launch-contract parsing, hydration, persisted-session lookup, and stale-reference normalization instead of parallel restore paths.
- Restore merges persisted session overrides on top of hydrated template defaults so runtime windows reopen in a usable context while remaining runnable from defaults when persisted state is missing.
- Persisted stale/missing binding references are normalized to bounded warning issues (`runtime-window.restore.*`) and stripped from restored selection state, preventing runtime-window crashes.
- Runtime window lifecycle tests now cover launch normalization, hydration defaults/binding establishment, restore overlay on reopen, stale-reference degradation, and invalid launch-input normalization (`src/ui/runtime/tests/SystemRuntimeWindowLifecycle.test.ts`).

## AI Loom image manipulation update: runtime repository installer contracts + git installer (stories 9.1-9.2)

- Added a reusable runtime repository installer contract seam at `src/application/runtime/RuntimeRepositoryInstallerContract.ts`:
  - install/update/status/validate/diagnostics contracts,
  - repository source metadata + installed repository metadata,
  - deterministic install-location key generation for provisioned runtime roots,
  - normalized operation error/issue contracts.
- Added `src/infrastructure/runtime/GitRuntimeRepositoryInstaller.ts` as the concrete Git-backed installer:
  - deterministic location resolution,
  - clone/install + fetch/update with revision capture,
  - safe partial-install recovery for re-entry after interruption,
  - shared-contract status/validation/diagnostics operations.
- Added focused tests:
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

## Desktop initialization progress + bootstrap timing update

- Renderer startup now uses a dedicated initialization progress contract in `src/ui/shared/initialization/AppInitializationProgress.ts` with user-facing phases (`preparing desktop runtime` through `ready`).
- `src/ui/App.tsx` now renders real phase changes + detail text during startup session bootstrap, plus a bounded “Still working on setup...” indicator for slower phases.
- `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts` now:
  - emits phase progress callbacks,
  - logs bootstrap timing checkpoints,
  - applies bounded timeout defaults for startup-critical identity reads (`resolveAuthenticatedSession`, `resolveSessionActorContext`),
  - and transitions to sign-in-ready state on timeout/transport failures instead of leaving pending bootstrap.
- `src/ui/shared/api/SharedApiClient.ts` now classifies timeout aborts as `domainCode: request-timeout` (distinct from `request-cancelled`) for clearer startup failure handling.
- Electron desktop startup timing checkpoints are now logged in `electron/main/main.ts` for:
  - `desktop-host-bootstrap`
  - `desktop-runtime-bootstrap`
  - `local-service-supervisor-start`
  - `authoritative-server-startup`
