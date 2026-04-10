# AI Companion: Desktop Auth-First Startup Boundary

Feature: A  
Epic: A.1-A.3  
Story: A.1.2-A.1.3, A.2.1-A.2.3, A.3.1-A.3.3

## Purpose

Define the startup split so Electron can render the login-capable window from a minimal auth bootstrap path, then move broader runtime initialization behind login or lazy feature demand.

## Current implementation (A.1.2)

`electron/main/main.ts` now uses explicit startup phases:

- `bootstrapAuthShell()` runs storage + auth identity bootstrap + trusted-device bootstrap context.
- `registerAuthIpc()` binds auth/bootstrap IPC only.
- `createMainWindow()` runs immediately after auth-shell bootstrap.
- `bootstrapPostLoginRuntime()` runs after window creation to start service supervisor and compose broader runtime services.
- `registerDeferredFeatureIpc()` gates non-auth IPC registration so feature surfaces are clearly post-login/deferred.

## Story A.2.1 implementation update

Desktop storage initialization is now scope-aware:

- `auth-shell-pre-login` scope (used in `bootstrapAuthShell()`):
  - creates only app data + storage directories needed for key/value session and trust bootstrap state.
  - does not create runtime/logs/models/assets directories on the pre-login path.
- `full-runtime` scope (used in `bootstrapPostLoginRuntime()`):
  - preserves existing full directory provisioning for runtime and feature infrastructure.

This keeps auth/session bootstrap storage available on clean machines and existing installations while moving non-auth storage provisioning off the login critical path.

## Story A.2.2 implementation update

Auth/bootstrap IPC registration is now isolated into a dedicated module:

- `electron/main/AuthBootstrapIpcRegistration.ts` owns pre-login auth/bootstrap IPC channel binding.
- `electron/main/main.ts` now delegates pre-login registration through that module and keeps feature/runtime IPC registration in the deferred post-login path.

Pre-login registration remains limited to:

- bootstrap sync retrieval
- desktop storage `getItem/setItem/removeItem`
- secrets availability/read/write/remove
- auth connectivity state read/write endpoints

## Story A.2.3 implementation update

Preload now enforces a split between auth/bootstrap API surface and deferred feature APIs:

- Always available during startup:
  - `bootstrap`
  - `storage`
  - `secrets`
  - `connectivity`
  - `runtime.isDeferredFeatureApiReady()`
- Deferred/guarded:
  - workflows, execution runs, workflow run summaries, model files, canonical assets, studio shell, registry, agents

Guard behavior:

- async deferred APIs return explicit rejected unavailable errors until post-login IPC is ready
- sync deferred APIs throw explicit unavailable errors until post-login IPC is ready
- workflow persistence status returns a degraded deferred-state payload so renderer startup composition can fall back safely instead of crashing

Auth/bootstrap IPC now includes a deferred-feature readiness channel:

- `ai-loom-desktop-runtime:is-feature-api-ready`

## Story A.3.1 implementation update

Python runtime resolution and service-supervisor startup are now post-login warmup responsibilities:

- `bootstrapAuthShell()` no longer resolves desktop Python runtime metadata.
- Pre-login bootstrap runtime config is now created from auth-shell config paths that do not require supervisor/Python runtime fields.
- `bootstrapPostLoginRuntime()` now resolves desktop Python runtime and starts `DesktopServiceSupervisor` during warmup.
- Warmup is started by an explicit auth/bootstrap IPC trigger (`ai-loom-desktop-runtime:start-post-login-warmup`) invoked after renderer authentication succeeds.

Result: first login-capable window creation no longer waits on Python runtime resolution or supervisor startup.

## Story A.3.2 implementation update

Workflow/studio/system runtime repositories and backend APIs are now deferred behind a dedicated lazy feature-runtime container:

- `electron/main/DeferredDesktopFeatureRuntime.ts` owns post-login deferred runtime composition for:
  - workflow persistence
  - execution run history + workflow run history
  - studio shell persistence + backend API
  - system studio backend API
  - system runtime backend API + runtime audit/execution stores
  - image workflow persistence adapters used by studio/system flows
- `bootstrapPostLoginRuntime()` now creates this container and registers deferred IPC handlers without eagerly constructing those object graphs.
- Deferred IPC handlers now resolve dependencies via `ensure*` lazy initializers on first feature use.
- Disposal now routes through one container `dispose()` path so lazily-created repositories/adapters remain lifecycle-coherent.

Result: post-login warmup no longer eagerly allocates workflow/studio/system backend graphs; they are created only when feature IPC routes are invoked.

## Story A.3.3 implementation update

Post-login warmup now starts from renderer authentication success paths with explicit trigger provenance:

- `src/ui/App.tsx` requests warmup on:
  - explicit sign-in success (`explicit-login`),
  - restored session bootstrap success (`session-restore`),
  - authenticated visibility refresh (`session-refresh`).
- `src/ui/runtime/DesktopPostLoginWarmup.ts` coalesces concurrent warmup requests and suppresses duplicate requests after completion so repeated auth-success events remain idempotent from the renderer side.
- preload and auth bootstrap IPC now pass a narrow warmup request payload (`triggerSource`, optional `requestedAt`) to main process warmup startup.
- main-process warmup request handling logs request provenance and whether the request started warmup, joined an in-flight warmup, or was ignored after startup.

Result: authenticated routes can render immediately while deferred warmup begins asynchronously, and warmup trigger behavior is directly observable in desktop logs.

## Story A.3.4 implementation update

Desktop startup logging now uses explicit phased identifiers so startup regressions can be localized:

- `desktop-startup.pre-login-auth-shell-bootstrap`
- `desktop-startup.identity-auth-host-readiness`
- `desktop-startup.main-window-creation`
- `desktop-startup.post-login-warmup`
- `desktop-startup.deferred-feature-registration`

Main-process startup logs now emit:

- timing phase events on `[ai-loom][startup]` (start/end/checkpoint)
- memory snapshots on `[ai-loom][startup-memory]` at key checkpoints

Startup contract regression checks are now codified in tests:

- startup sequence asserts main-window creation before service-supervisor startup,
- pre-login initializer set excludes workflow/studio/system runtime initialization,
- preload sync bootstrap call is verified against the shared auth-bootstrap IPC channel contract.

Result: startup slowdowns can be attributed quickly to pre-login auth-shell bootstrap versus post-login warmup.

## Target phase model

1. `pre-login startup` (critical path):
- minimal storage bootstrap for auth/session keys,
- auth identity API URL bootstrap,
- trusted-device bootstrap projection,
- auth-only IPC registration,
- create main window.

2. `post-login warmup`:
- start service supervisor and broader runtime services,
- register non-auth IPC groups,
- compose workflow/studio/system runtime persistence/backends.

3. `on-demand feature initialization`:
- lazy canonical registry runtime,
- lazy agent runtime,
- deferred feature IPC groups.

## Planned seams (target names)

- `bootstrapAuthShell`
- `registerAuthIpc`
- `bootstrapPostLoginRuntime`
- `registerDeferredFeatureIpc`

## Required bootstrap data for auth/session restore

Required pre-login:

- `bootstrap.runtimeConfig.identityApiBaseUrl`
- `bootstrap.identityTransportTrust`
- optional `bootstrap.storage.appDataDirectory` and `bootstrap.environment.isPackaged` for auth-shell presentation/diagnostics
- desktop storage bridge (`getItem/setItem/removeItem`) for `ai-loom.identity.session.v1`

Not required pre-login:

- full storage-path metadata
- service-supervisor details/base URL
- python runtime details/base URL
- workflow path metadata
- workflow/studio/agent/model/registry runtime initialization

## Story A.1.3 implementation notes

- preload bootstrap contract is now explicitly auth-minimal (`DesktopAuthBootstrapContext`).
- `bootstrap.runtimeConfig` is projected to `DesktopAuthBootstrapRuntimeConfig` and no longer exposes service supervisor or Python/runtime path fields.
- renderer runtime config resolution remains backward-safe by accepting both legacy full runtime config payloads and the new minimal payload.

## Major work to move off critical path

- full desktop runtime bootstrap before window creation,
- broad authoritative host startup as a startup gate,
- bulk preload IPC registration unrelated to auth,
- repository/backend composition for workflow/studio/runtime features before login render.
