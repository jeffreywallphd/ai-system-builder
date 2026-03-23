# AI Companion: Desktop Runtime and Hosts

## Core fact
Electron is the desktop host boundary; the renderer accesses desktop capabilities through preload bridge contracts.

## Main files
- Main process bootstrap: `electron/main/main.ts`
- Preload bridge: `electron/preload.ts`
- Bridge contracts: `electron/shared/DesktopContracts.ts`
- Desktop workflow persistence: `infrastructure/desktop/DesktopWorkflowPersistence.ts`
- Desktop-backed workflow repo used by renderer: `infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`

## Storage modes to mention
- Desktop canonical path: filesystem JSON + SQLite index
- Fallback path: browser/local storage repository

## Runtime modes to mention
- desktop development
- desktop production
- browser development
- runtime disabled/degraded states

## Runtime orchestration update
- Runtime dependency graph composition is now centralized in a reusable outer-layer module instead of being duplicated ad hoc in the infrastructure registry and UI composition.
- The shared graph now covers `python-runtime -> mcp-runtime` plus appended runtime-backed capability gates for delegated workflow execution, document conversion, dataset generation, and model training in the UI composition.
- Resolutions now carry an operational state model (`disabled`, `unavailable`, `provisioning`, `starting`, `healthy`, `degraded`, `failed`, `stopped`, `unknown`), fallback information, timestamps, metadata, and remediation hints.
- The orchestrator also supports explicit `refresh`, single-dependency invalidation, and global invalidation so runtime-backed capabilities can recompute status after managed-runtime changes; the runtime console and managed-services store now use those hooks.

## Caveat
The preload bridge uses synchronous IPC and exposes storage/workflow/model-file capabilities.

## What remains out of scope
- Orchestration is not yet rolled out across model-file bridge policies.

## TODO
- When discussing security or performance, mention the sync IPC tradeoff explicitly.
