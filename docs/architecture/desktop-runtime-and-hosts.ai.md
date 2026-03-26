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
- Desktop backend bridge now also includes thin agent-authoring IPC endpoints (`ai-loom-desktop-agents:*`) mapped to application use cases and structured validation errors.
- Phase 8.1 now consolidates Studio-facing desktop agent transport through `AgentStudioBackendApi` and extends `ai-loom-desktop-agents:*` with runtime/session endpoints (`launch`, `trigger-launch`, `list-sessions`, `get-session`, `control-run`, `studio-snapshot`) while staying thin over Phase 6/7 use cases.
- Desktop launch/trigger handlers now execute through a real host-wired runner path (`AgentRunnerService`) with deterministic planning + capability execution + asset-backed memory + SQLite-backed session persistence.
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

## Caveat
The preload bridge uses synchronous IPC and exposes storage/workflow/model-file capabilities.

## What remains out of scope
- Orchestration is not yet rolled out across model-file bridge policies.

## TODO
- When discussing security or performance, mention the sync IPC tradeoff explicitly.
