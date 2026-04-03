# AI Companion: Desktop Runtime and Hosts

## Core fact
Electron is the desktop host boundary; the renderer accesses desktop capabilities through preload bridge contracts.

## Main files
- Main process bootstrap: `electron/main/main.ts`
- Preload bridge: `electron/preload.ts`
- Bridge contracts: `electron/shared/DesktopContracts.ts`
- Desktop workflow persistence: `infrastructure/desktop/DesktopWorkflowPersistence.ts`
- Desktop execution-run persistence: `infrastructure/filesystem/execution/SqliteExecutionRunRepository.ts`
- Desktop agent-authoring backend API: `infrastructure/api/agents/AgentAuthoringBackendApi.ts`
- Desktop-backed workflow repo used by renderer: `infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`

## Storage modes to mention
- Desktop canonical path: filesystem JSON + SQLite workflow index plus SQLite execution-run history with explicit schema versioning/migration via SQLite `user_version`
- Workflow run observability summaries now share that same desktop SQLite durability path through preload/IPC bridge contracts (`ai-loom-desktop-workflow-runs:*`) backed by `SqliteWorkflowRunSummaryRepository`.
- Desktop backend bridge now also includes thin agent-authoring IPC endpoints (`ai-loom-desktop-agents:*`) mapped to application use cases and structured validation errors.
- Phase 8.1 now consolidates Studio-facing desktop agent transport through `AgentStudioBackendApi` and extends `ai-loom-desktop-agents:*` with runtime/session endpoints (`launch`, `trigger-launch`, `list-sessions`, `get-session`, `control-run`, `studio-snapshot`) while staying thin over Phase 6/7 use cases.
- Phase 8.5/8.6 renderer flows consume those same host contracts directly: run controls call `control-run`, manual launches call `launch`, and backend-trigger launches call `trigger-launch`, with no renderer-owned scheduler/automation runtime.
- Desktop launch/trigger handlers now execute through a real host-wired runner path (`AgentRunnerService`) with deterministic planning + capability execution + asset-backed memory + SQLite-backed session persistence.
- Direction 5 Studio Shell transport now follows the same thin-host pattern on `ai-loom-desktop-studio-shell:*`, delegating to `StudioShellBackendApi` backed by `SqliteStudioShellRepository` for durable studio/session/draft/version state.
- Renderer-side `StudioShellService` now has an explicit browser fallback bridge adapter (`ui/composition/BrowserStudioShellBridgeFallback.ts`) that reuses in-process backend APIs over `InMemoryStudioShellRepository` when desktop preload bridge contracts are unavailable, preventing runtime crashes in browser-hosted development while keeping the same backend contract surface.
- Renderer-side `RegistryService` now mirrors that fallback posture via `ui/composition/BrowserRegistryBridgeFallback.ts`: when desktop registry preload contracts are unavailable, it routes through in-process `RegistryBackendApi` and shares the same in-memory workflow-persistence fallback repository used by Studio Shell so Explore remains available in browser development mode.
- System-runtime callback delivery signing now uses a runtime-compatible HMAC seam in `ExecutionCallbackDispatcher` (Web Crypto when available, Node crypto as fallback), so browser fallback runtime paths no longer require top-level Node module imports.
- Direction 5 Epic 6 runtime transport now extends that same Studio Shell host seam with bounded system-runtime endpoints (`system-runtime:start|status|trace|result`) delegated to `SystemRuntimeBackendApi` over the same repository-backed application/runtime path.
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

## AI Loom image manipulation update: runtime launch window contract and host flow (stories 8.1-8.2)

- Desktop Studio Shell bridge now includes a dedicated runtime-window launch IPC seam (`ai-loom-desktop-studio-shell:runtime-window:launch`) that accepts only validated runtime launch contracts.
- Launch payloads are normalized and versioned through one shared contract (`SystemRuntimeWindowLaunchContract`) before reaching host window creation.
- Electron main now reuses existing window bootstrap mechanics to open a separate runtime-focused window and passes only contract-defined launch data to renderer query transport (`runtimeWindowLaunch`).
- Runtime window reuse is bounded through contract window intent (`reuseWindowKey`) rather than ad hoc global state.
