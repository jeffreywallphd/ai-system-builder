# AI Companion: Desktop Auth-First Startup Boundary

Feature: A  
Epic: A.1-A.3  
Story: A.1.2-A.1.3, A.2.1-A.2.3, A.3.1-A.3.3

## Purpose

Define the startup split so Electron can render the login-capable window from a minimal auth bootstrap path, then move broader runtime initialization behind login or lazy feature demand.

## Story 1.1.3 implementation update

Desktop startup now follows one control-plane host composition path for the full desktop session:

- pre-login bootstrap and post-login warmup both use the same authoritative server host runtime started during `bootstrapAuthShell()`.
- Electron main no longer composes an auth-minimal host for pre-login and then replaces it with another host after login.
- renderer-facing transport remains continuously bound; post-login work activates capabilities in place through explicit runtime state transitions.

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

- startup sequence contract excludes Python runtime resolution and service-supervisor startup from pre-login boot,
- pre-login initializer set excludes workflow/studio/system runtime initialization,
- preload sync bootstrap call is verified against the shared auth-bootstrap IPC channel contract.

Result: startup slowdowns can be attributed quickly to pre-login auth-shell bootstrap versus post-login warmup.

## Story B.2.1 implementation update

Pre-login server startup now uses an explicit auth-minimal host path:

- `src/hosts/server/AuthMinimalServerHostEntrypoint.ts`
- `startAuthMinimalServerHostAssembly(...)` from `electron/main/main.ts`

This keeps pre-login identity bootstrap on the shared host lifecycle pipeline while narrowing startup composition to auth-critical route/persistence responsibilities.

## Story B.3.1 implementation update

Electron main now hardens auth-minimal startup integration details:

- pre-login startup logs explicitly call out auth-minimal identity host start/ready.
- `bootstrapAuthShell()` still derives `identityApiBaseUrl` from auth-minimal host runtime address, preserving renderer auth/bootstrap URL contract.
- pre-login runtime naming in Electron main now uses auth-minimal host terminology instead of authoritative wording.
- shutdown/disposal path continues stopping auth-minimal host through shared pre-login cleanup.

Regression safeguards now include:

- pre-login startup initializer naming updated to `auth-minimal-identity-host`.
- tests assert Electron main starts `startAuthMinimalServerHostAssembly(...)`.
- tests assert Electron main does not call `startAuthoritativeServerHostAssembly(...)` on the pre-login path.

## Story B.3.2 implementation update

Auth-minimal pre-login host now preserves trusted-device/session-bootstrap security behaviors that renderer startup depends on:

- `src/hosts/server/AuthMinimalIdentityServerHost.ts` now wires transport trust validation (`ValidateTransportConnectionTrustUseCase` + HTTP/WebSocket transport adapters) on the auth-minimal host path, including desktop loopback bypass semantics for the desktop transport scenario.
- auth-minimal host integration tests now verify:
  - local desktop login succeeds on auth-minimal host,
  - saved-session validation (`GET /api/v1/identity/session`) succeeds for desktop sessions,
  - actor-context resolution (`GET /api/v1/identity/session/context`) returns workspace context on auth-minimal host,
  - required trusted-device login fails with controlled auth errors when trust bootstrap state is missing,
  - required trusted-device login succeeds when trusted-device binding state is present,
  - thin-client session validation is rejected by transport trust enforcement on the narrowed host.
- desktop trust-bootstrap diagnostics now return specific prerequisite failure details (missing binding id, missing pin reference, expired pin material) so trust/bootstrap failures remain understandable.

## Story B.3.3 implementation update

Auth-minimal pre-login startup now includes explicit scope-creep regression guards in composition code:

- route coverage guard in `src/hosts/server/AuthMinimalServerApiRouteComposition.ts` now enforces an exclusive auth-minimal route family boundary:
  - required route family remains `identity-auth`,
  - any additional composed route family now fails the auth-minimal coverage assertion.
- service coverage guard in `src/hosts/server/AuthMinimalServerHostEntrypoint.ts` now enforces a narrowed auth-minimal startup service contract:
  - only the auth-minimal startup service IDs are composed for service-plan coverage,
  - unexpected or forbidden control-plane service IDs now fail startup assertions.
- persistence scope guard in `src/hosts/server/AuthMinimalServerHostEntrypoint.ts` now asserts non-auth persistence repositories are not composed on pre-login startup.

Auth-minimal startup scope is also now observable in development logs through structured diagnostics:

- `auth-minimal-server.startup.route-scope`
- `auth-minimal-server.startup.service-scope`
- `auth-minimal-server.startup.persistence-scope`

Regression tests now include explicit negative checks for route/service scope expansion so boundary regressions fail loudly.

## Story C.1.3 implementation update

Post-login runtime orchestration now has an explicit lifecycle contract boundary:

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`

Contract coverage now explicitly defines:

- auth-success plus lazy feature-demand warmup trigger semantics,
- authoritative main-process lifecycle status states (`unavailable`, `warming`, `ready`, `failed`),
- preload/runtime bridge status and readiness probes for renderer-safe state checks,
- teardown/reset lifecycle expectations for logout and application quit.

## Story C.4.1 implementation update

Electron main-process composition now extracts windowing and app lifecycle wiring into focused modules:

- `electron/main/DesktopWindowManager.ts`
  - owns main window creation, renderer loading (packaged vs dev), runtime window launch, and reuse-key tracking/cleanup.
  - preserves preload wiring, background color, ready-to-show maximize/show behavior, and runtime window defaults.
- `electron/main/DesktopAppLifecycle.ts`
  - owns `whenReady`, `activate`, `window-all-closed`, and `before-quit` event registration semantics.
  - keeps `main.ts` as composition root that wires startup bootstrap, disposal, and host stop hooks.

Contributor boundary guidance:

- place new `BrowserWindow` behavior and renderer route/search loading rules in `DesktopWindowManager`.
- place Electron app event policy changes in `DesktopAppLifecycle`.
- keep `electron/main/main.ts` focused on service composition and startup orchestration rather than low-level window/event details.

## Story C.2.1 implementation update

Desktop runtime startup composition now splits post-login shared bootstrap from on-demand feature composition paths:

- `composePostLoginRuntime(...)` now owns only shared post-login prerequisites:
  - full-runtime storage initialization,
  - Python runtime resolution,
  - service supervisor startup,
  - runtime-config upgrade and deferred feature-runtime container creation.
- `createOnDemandFeatureCompositionPaths(...)` now defines explicit first-use composition entrypoints consumed by deferred IPC handlers for:
  - workflow/execution/workflow-run runtime,
  - studio shell/system runtime backend APIs,
  - canonical registry runtime composition,
  - agent runtime composition.

## Story C.2.2 implementation update

Deferred feature IPC registration is now split into domain registration modules under `electron/main/ipc/` and orchestrated from `electron/main/main.ts`:

- `registerWorkflowPersistenceIpc`
- `registerExecutionRunIpc`
- `registerWorkflowRunHistoryIpc`
- `registerAgentStudioIpc`
- `registerStudioShellIpc`
- `registerSystemStudioIpc`
- `registerSystemRuntimeIpc`
- `registerModelFileIpc`
- `registerCanonicalRegistryIpc`

`registerDeferredFeatureIpc(...)` remains the idempotent gate in main-process bootstrap, but the large inline `ipcMain.on` / `ipcMain.handle` block has been replaced by `registerDeferredFeatureIpcDomains(...)` composition wiring.

Guidance for future additions:

- Add new non-auth channels in the appropriate domain module under `electron/main/ipc/`.
- Keep dependencies explicit via typed registration parameter objects.
- Keep `main.ts` focused on lifecycle/orchestration and registration composition only.
- Preserve existing renderer IPC channel names/contracts unless a coordinated surface change is planned.

Result: `bootstrapPostLoginRuntime(...)` is now orchestration glue for post-login and on-demand paths instead of a single broad runtime bootstrap block.

## Story C.2.2 implementation update

Desktop startup contracts now explicitly treat Python runtime resolution and service-supervisor startup as post-login warmup-only work:

- `DesktopStartupBootSequence` is now constrained to pre-login auth-shell startup steps only and no longer includes service-supervisor startup.
- `DesktopPostLoginWarmupSequence` now codifies ordered post-login warmup steps:
  - `python-runtime-resolution`
  - `service-supervisor-startup`
  - `deferred-feature-registration`
- startup contract validation now fails if Python runtime resolution or supervisor startup appears in the pre-login boot sequence.
- pre-login startup regression tests now verify:
  - `bootstrapAuthShell()` does not resolve desktop Python runtime,
  - `bootstrapAuthShell()` does not construct or start `DesktopServiceSupervisor`,
  - post-login runtime composition remains the only path that resolves Python runtime and starts supervisor.
- post-login warmup logging now emits explicit start/ready events for:
  - desktop Python runtime resolution (`mode`, `available`),
  - local service supervisor startup (`baseUrl`, `runtimeBaseUrl`).

Result: the login-critical pre-window startup contract no longer models or permits Python/supervisor initialization, while deferred warmup observability is clearer.

## Story C.2.4 implementation update

Studio shell, system runtime, and image workflow/system persistence runtime module loading is now deferred from pre-login startup to post-login warmup composition:

- `electron/main/main.ts` no longer statically imports `createDeferredDesktopFeatureRuntime` at module load time.
- deferred feature runtime factory loading now happens through `ensureDeferredDesktopFeatureRuntimeFactory()` using dynamic import inside `composePostLoginRuntime(...)`.
- studio shell repositories/APIs, system runtime execution stores/audit repositories, and image workflow system persistence adapters remain owned by `DeferredDesktopFeatureRuntime` lazy `ensure*` composition paths and are still allocated on first feature demand.
- disposal/reset now also clears the deferred factory reference during runtime teardown so lifecycle reset after shutdown/logout stays coherent.

Result: login-critical pre-window startup avoids both eager runtime object graph construction and eager loading of the studio/system/image deferred runtime module.

## Story C.2.5 implementation update

Desktop connectivity monitoring is now deferred out of pre-login startup:

- `bootstrapAuthShell()` no longer starts `DesktopConnectivityStateService` monitoring.
- connectivity monitoring startup is now tied to the first accepted post-login warmup request in `ensurePostLoginWarmupStarted(...)`.
- auth/bootstrap connectivity IPC now returns a controlled pre-warmup fallback (`connecting`) with explicit deferred-monitoring detail until post-login warmup starts.
- pre-warmup offline-mode toggle requests return the same controlled deferred fallback payload instead of attempting to emulate post-login connectivity behavior.
- runtime disposal now explicitly stops deferred connectivity monitoring before clearing runtime state, preserving deterministic shutdown/logout teardown behavior.

Result: login-capable startup avoids recurring connectivity probe activity while renderer connectivity consumers retain stable, explicit pre-warmup behavior.

## Story C.3.3 implementation update

Startup observability now includes explicit timing + memory checkpoints across pre-login and deferred runtime boundaries so deferred startup impact is measurable and regressions are easier to spot:

- pre-login/auth-minimal host:
  - `desktop-startup.identity-auth-host-readiness` now emits startup-memory checkpoints at `start` and `ready`.
- first window readiness:
  - `desktop-startup.main-window-creation` now emits `first-window-ready-to-show`.
  - `desktop-startup.host-bootstrap` now emits `renderer-first-window-ready`.
- post-login warmup:
  - `desktop-startup.post-login-warmup` now emits `deferred-feature-runtime-container-ready` after deferred runtime container composition.
- deferred runtime first-use groups (timed + memory-checkpointed in `DeferredDesktopFeatureRuntime`):
  - workflow persistence (`desktop-startup.deferred-feature-runtime.workflow-persistence`, `workflow-persistence-ready`)
  - execution/workflow run persistence (`...execution-history`, `...workflow-run-history`)
  - studio/runtime backends (`...studio-shell-backend-api`, `...system-studio-backend-api`, `...system-runtime-backend-api`)

Instrumentation stays focused on high-value phase and first-use boundaries rather than per-request logging.

## Story C.3.4 implementation update

Deferred-runtime startup boundary regression safeguards now explicitly lock non-auth runtime groups out of pre-login startup:

- `electron/main/DesktopStartupContract.ts` now treats the following runtime groups as mandatory pre-login forbidden scope:
  - `service-supervisor`
  - `python-runtime-resolution`
  - `workflow-persistence`
  - `execution-history`
  - `workflow-run-history`
  - `studio-shell-backend-api`
  - `system-studio-backend-api`
  - `system-runtime-backend-api`
  - `desktop-connectivity-monitor`
- startup contract validation now fails loudly if this deferred-runtime guard list is removed or narrowed.
- new focused Electron main regression coverage (`electron/main/tests/MainDeferredRuntimeStartupBoundary.test.ts`) asserts:
  - `bootstrapAuthShell()` does not activate those deferred runtime groups,
  - connectivity monitoring starts only from accepted post-login warmup,
  - Python resolution + service-supervisor startup remain post-login composition work,
  - workflow/studio/system backend activation remains on-demand through deferred runtime `ensure*` paths.

Result: non-auth runtime scope cannot silently drift back into pre-login startup without direct startup contract or test failures.

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
- host replacement during login transition (removed in favor of one authoritative host across the desktop session),
- bulk preload IPC registration unrelated to auth,
- repository/backend composition for workflow/studio/runtime features before login render.
