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
- Do not leak stack traces, local filesystem paths, process environment, secrets, or raw adapter protocol details through IPC errors; unexpected internal failures should use generic transport messages instead of raw exception messages.
- Runtime-backed desktop start handlers should surface application runtime guard failures as IPC `unavailable` failures with safe capability details and preserved request/correlation ids; do not apply those guards to task read/cancel/finalize paths unless the operation contract explicitly requires it.
- Desktop runtime readiness IPC wraps shared runtime readiness contracts from `modules/contracts/runtime`; it exposes host-scoped reads through the application `RuntimeReadinessPort` and must not start/stop/install/repair/probe runtimes merely to read readiness.
- Python-specific runtime IPC remains a detailed control/diagnostic surface and is not the generic runtime readiness model.
- Server API readiness routes are out of scope for desktop IPC work.
- Asset Registry desktop IPC is read-only: list definitions, read definition detail, read definition version, list resource-backed views, and read resource-backed view detail. Handlers wrap `AssetRegistryDefinitionReadPort`/the read facade only and must not receive persistence adapters, host composition helpers, mutation use cases, seeding services, runtime/storage adapters, provider clients, provider objects, resource scans, or bytes.
- Asset Registry IPC input parsing should stay in parity with the server API through shared transport-adapter normalization. Malformed asset type/family/status, built-in, boolean, expansion, limit, cursor, or definition/version input returns validation failure before the read facade is called. Unexpected facade failures return sanitized internal failures while preserving request/correlation ids.
- Phase 2C Prompt 8 fixed the initial IPC/preload surface at definition list/read/version-read; the final Phase 3 cleanup adds read-only resource-backed view list/detail channels. Do not add asset create/update/delete/register/import/finalize/seed/publish/execute/run/scan/sync/repair/install/start/train channels or preload methods. Validation diagnostics remain read-side details requested through `includeValidation`, not runtime validation tasks.
- Phase 3 Prompt 8 keeps resource-backed provider wiring internal. Public desktop IPC/preload resource-backed channels may only call the read facade; mutation/import/finalization/localization/publishing/seeding/scan/runtime/provider/byte-read channels remain forbidden.
- Phase 4 Prompt 7 is the only exception to the prior mutation ban: desktop IPC/preload may expose exactly four approved Asset Kernel mutation operations, `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object`. Handlers must depend only on matching narrow application use cases, perform shallow command validation, preserve request/correlation/idempotency metadata, return existing IPC envelopes, sanitize thrown errors, and must not expose arbitrary asset editor, seed, provider browse/download, runtime execution, scan, byte/content, or UI action channels.
- Phase 5 Prompt 9 does not add IPC channels. Pack/source/category discoverability should flow through existing read-only Asset Registry definition list/read/version-read payloads and shared UI mappers; `workspace-pack` is a workspace pack label, not an override label unless explicit override metadata exists. Do not add pack install/import/export/activate/disable channels, override edit channels, resolver activation channels, raw resolver result channels, asset editor channels, scan channels, provider/network/runtime channels, or byte/content channels.

## Canonical Source Docs

- `docs/architecture/host-model.md`
- `docs/architecture/module-dependency-rules.md`
- `docs/architecture/runtime-model.md`
- `docs/adr/ADR-0013-host-owned-runtime-execution-and-feature-placement.md`

## Phase 6 Prompt 5 workspace boundary

Workspace UI gating may use host/renderer active selection state. If IPC/preload workspace operations are added, keep them workspace-only (list/create/read selection/save selection/clear selection), sanitize diagnostics, avoid raw paths, and do not expose system pack installer, pack import/export/install, collaboration, permission, or resource-scoping channels.

## Phase 6 Prompt 6 workspace activation IPC boundary

Workspace system pack activation availability does not add Electron IPC or preload surface in this checkpoint. Keep activation read/list/status behavior internal to application use cases until a later prompt explicitly scopes transport exposure.

## Workspace-aware Asset Library reads

Desktop Asset Registry IPC/preload read payloads carry `workspaceId` for Asset Library list/detail/resource-backed reads. Missing or invalid workspace context must fail safely and must not call a global fallback read. IPC remains read-only for Asset Registry reads and must not expose pack install/import/export, activation-management, override-editing, or system-pack installer behavior.

