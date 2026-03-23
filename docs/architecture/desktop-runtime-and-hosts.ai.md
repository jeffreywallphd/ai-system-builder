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

## Caveat
The preload bridge uses synchronous IPC and exposes storage/workflow/model-file capabilities.

## TODO
- When discussing security or performance, mention the sync IPC tradeoff explicitly.
