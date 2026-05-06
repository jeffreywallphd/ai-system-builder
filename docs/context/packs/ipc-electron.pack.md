# Context Pack: Electron IPC

- Pack name: `ipc-electron`

## Purpose

- Guide Electron IPC contract and handler work while preserving shared transport envelope discipline.

## Use When

- Adding or changing `modules/contracts/ipc/**`, Electron IPC handler registration, or desktop preload methods.

## Core Guidance

- IPC contracts are transport specializations: use shared operation identities, `createIpcChannel`, `createIpcRequest`, `createIpcSuccessResponse`, `createIpcFailureResponse`, and `createIpcError`.
- Channels must stay operation-derived with `ipc.<operation>.<kind>` names and request/response kinds.
- Handlers should depend on application ports/use cases rather than desktop internals, Electron objects, or renderer code.
- Preserve `requestId` and `correlationId` across success and failure responses.
- Do not leak stack traces, local filesystem paths, process environment, secrets, or raw adapter protocol details through IPC errors.
- Desktop runtime readiness IPC wraps shared runtime readiness contracts from `modules/contracts/runtime`; it exposes host-scoped reads through the application `RuntimeReadinessPort` and must not start/stop/install/repair/probe runtimes merely to read readiness.
- Python-specific runtime IPC remains a detailed control/diagnostic surface and is not the generic runtime readiness model.
- Server API readiness routes are out of scope for desktop IPC work.

## Canonical Source Docs

- `docs/architecture/host-model.md`
- `docs/architecture/module-dependency-rules.md`
- `docs/architecture/runtime-model.md`
- `docs/adr/ADR-0013-host-owned-runtime-execution-and-feature-placement.md`
