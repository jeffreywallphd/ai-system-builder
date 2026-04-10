# Desktop Auth-First Startup Boundary

Feature: A  
Epic: A.1-A.3  
Story: A.1.2-A.1.3, A.2.1-A.2.3, A.3.1-A.3.3

## Purpose

Define an explicit Electron startup boundary so the first login-capable window is created from a minimal auth bootstrap surface, with non-auth runtime moved to post-login or deferred feature initialization.

## Current startup behavior (as implemented in A.1.2)

`electron/main/main.ts` now uses explicit startup phase entrypoints:

1. `bootstrapAuthShell()` initializes storage, auth identity bootstrap, and trusted-device/session bootstrap data.
2. `registerAuthIpc()` registers auth/bootstrap IPC only.
3. `createMainWindow()` runs immediately after auth-shell phase completion.
4. `bootstrapPostLoginRuntime()` starts service supervisor and composes broader desktop runtime.
5. `registerDeferredFeatureIpc()` registers non-auth feature IPC after post-login runtime bootstrap starts.

This removes full feature/runtime initialization from the first-render gate while preserving desktop auth bootstrap behavior.

## Story A.2.1 storage initialization split

Pre-login startup now initializes desktop storage in an auth-shell scope (`auth-shell-pre-login`) that provisions only:

- app data root directory
- storage directory containing persistent key/value SQLite state

This scope supports:

- session bootstrap persistence (`ai-loom.identity.session.v1`)
- secure desktop trust/bootstrap reads from persistent key/value storage
- auth-shell local secret/session state

Pre-login no longer eagerly creates:

- runtime directory
- logs directory
- models directory
- assets directory

Post-login runtime bootstrap explicitly upgrades storage initialization to full runtime scope (`full-runtime`) before feature/runtime service composition. This preserves existing full provisioning behavior for later phases while reducing first-render critical path work.

## Story A.2.2 auth IPC registration split

Auth/bootstrap IPC registration is now isolated into a dedicated module:

- `electron/main/AuthBootstrapIpcRegistration.ts` owns pre-login auth/bootstrap IPC channel binding.
- `electron/main/main.ts` delegates pre-login registration through that module while feature/runtime IPC handlers remain in deferred post-login registration.

Pre-login registration remains limited to:

- bootstrap sync retrieval
- desktop storage `getItem/setItem/removeItem`
- secrets availability/read/write/remove
- auth connectivity state read/write endpoints

## Story A.2.3 preload + deferred API guard split

Preload now separates always-available auth/bootstrap APIs from deferred feature APIs:

- Always available at renderer startup:
  - `bootstrap`
  - `storage`
  - `secrets`
  - `connectivity`
  - `runtime.isDeferredFeatureApiReady()`
- Deferred/guarded:
  - workflows, execution runs, workflow run summaries, model files, canonical assets, studio shell, registry, agents

Deferred APIs are now guarded in preload and return controlled unavailable behavior until post-login runtime IPC registration completes:

- async deferred APIs reject with a stable, explicit unavailable error
- sync deferred APIs throw explicit unavailable errors
- workflow persistence status reports a degraded deferred state instead of crashing startup composition

Auth/bootstrap IPC now also includes a readiness probe channel (`ai-loom-desktop-runtime:is-feature-api-ready`) so preload can gate deferred APIs without forcing broad startup initialization.

## Story A.3.1 service supervisor + Python runtime warmup split

Desktop startup now defers Python runtime resolution and supervisor startup until after authentication:

- `bootstrapAuthShell()` no longer resolves desktop Python runtime details.
- Pre-login runtime config bootstrap uses auth-shell-only config creation and omits service supervisor/Python runtime details.
- Post-login warmup resolves Python runtime and starts `DesktopServiceSupervisor` before deferred feature IPC is marked ready.
- Warmup is triggered through a dedicated auth/bootstrap IPC signal (`ai-loom-desktop-runtime:start-post-login-warmup`) emitted after renderer authentication state becomes authenticated.

This preserves trusted-device/session bootstrap behavior while removing Python/supervisor startup from the first-render login critical path.

## Story A.3.2 workflow/studio/system backend runtime defer split

Workflow/studio/system persistence repositories and backend APIs are now deferred behind a dedicated lazy feature-runtime container:

- `electron/main/DeferredDesktopFeatureRuntime.ts` owns deferred composition for:
  - workflow persistence
  - execution run history and workflow run history
  - studio shell persistence and backend API
  - system studio backend API
  - system runtime backend API and runtime audit/execution stores
  - image workflow persistence adapters used by studio/system runtime flows
- `bootstrapPostLoginRuntime()` now creates this container and registers deferred IPC handlers without eagerly building those graphs.
- Deferred IPC handlers resolve dependencies through `ensure*` lazy initializers on first feature use.
- Disposal routes through one container-level `dispose()` path so lazily created repositories/adapters remain lifecycle-coherent.

Result: post-login warmup no longer eagerly allocates workflow/studio/system backend object graphs.

## Story A.3.3 renderer-auth success warmup trigger

Post-login warmup now starts from renderer authentication success paths with explicit trigger provenance:

- `src/ui/App.tsx` requests warmup on:
  - explicit sign-in success (`explicit-login`),
  - restored session bootstrap success (`session-restore`),
  - authenticated visibility refresh (`session-refresh`).
- `src/ui/runtime/DesktopPostLoginWarmup.ts` coalesces concurrent warmup requests and suppresses duplicate requests after completion, so repeated auth-success events remain idempotent from renderer-side triggering.
- preload and auth bootstrap IPC now pass a narrow warmup request payload (`triggerSource`, optional `requestedAt`) to the main process.
- main-process warmup request handling logs trigger provenance and whether the request started warmup, joined an in-flight warmup, or was ignored after startup.

Result: authenticated routes can render immediately while deferred warmup runs in the background, and warmup trigger behavior is directly observable in desktop logs.

## Story A.3.4 startup regression checks and phased initialization logging

Startup observability now uses explicit phased log identifiers so startup regressions can be attributed to the correct phase:

- `desktop-startup.pre-login-auth-shell-bootstrap`
- `desktop-startup.identity-auth-host-readiness`
- `desktop-startup.main-window-creation`
- `desktop-startup.post-login-warmup`
- `desktop-startup.deferred-feature-registration`

Main-process logs now emit both timing and memory checkpoints for those phases using:

- `[ai-loom][startup]` for start/end/checkpoint timing records
- `[ai-loom][startup-memory]` for memory snapshots at phase checkpoints

Regression checks now codify the boot contract in main-process tests:

- pre-login startup boot sequence excludes Python runtime resolution and service-supervisor startup,
- pre-login bootstrap initializer set excludes workflow/studio/system runtime dependencies,
- preload sync bootstrap call is tied to the shared auth-bootstrap IPC channel contract.

This allows developers to distinguish slow pre-login auth-shell startup from slower post-login warmup directly from logs.

## Story B.2.1 auth-minimal host startup path

Pre-login server startup now uses a dedicated auth-minimal server entrypoint:

- `src/hosts/server/AuthMinimalServerHostEntrypoint.ts`
- `startAuthMinimalServerHostAssembly(...)` from `electron/main/main.ts`

The auth-minimal path preserves host lifecycle/startup pipeline behavior while narrowing pre-login startup to auth-critical route registration and persistence composition needed for desktop identity/session bootstrap.

## Story B.3.1 auth-minimal host integration in Electron main

Electron pre-login startup now explicitly identifies auth-minimal host usage in startup diagnostics and contracts:

- `electron/main/main.ts` pre-login startup logs now emit auth-minimal host start/ready messages.
- `bootstrapAuthShell()` keeps deriving `identityApiBaseUrl` from the auth-minimal host runtime address (`http://{address}`) so renderer auth/bootstrap flows keep the same API base URL contract.
- pre-login runtime handle naming in Electron main now uses auth-minimal host terminology (`AuthMinimalServerHostRuntimeHandle` / `authMinimalServerRuntime`) instead of authoritative naming.
- shutdown/disposal continues stopping the auth-minimal host through the existing pre-login cleanup path (`disposeDesktopRuntimeResources()`).

Regression safeguards for this boundary now include:

- startup contract pre-login initializer naming now encodes `auth-minimal-identity-host`,
- tests assert Electron main starts `startAuthMinimalServerHostAssembly(...)`,
- tests assert Electron main does not call `startAuthoritativeServerHostAssembly(...)` in the pre-login path.

## Story B.3.2 trusted-device and session-bootstrap preservation on auth-minimal host

Auth-minimal pre-login host now preserves the desktop security-sensitive auth/bootstrap behavior expected before login:

- `src/hosts/server/AuthMinimalIdentityServerHost.ts` now composes transport trust validation (`ValidateTransportConnectionTrustUseCase` with HTTP/WebSocket transport adapters) on auth-minimal startup, while preserving desktop loopback bypass semantics for desktop-client transport.
- auth-minimal host integration tests now verify:
  - local desktop login succeeds through auth-minimal host routes,
  - saved-session validation (`GET /api/v1/identity/session`) works for desktop sessions,
  - session actor-context hydration (`GET /api/v1/identity/session/context`) resolves workspace context,
  - required trusted-device login fails with controlled auth errors when trust bootstrap state is missing,
  - required trusted-device login succeeds when trusted-device binding is present,
  - thin-client session validation is rejected by transport trust enforcement.
- desktop trust bootstrap connectivity diagnostics now expose specific prerequisite failure details for missing trusted-device binding, missing pin reference, and expired pin material.

## Story B.3.3 auth-minimal pre-login scope-creep regression guards

Auth-minimal startup now enforces the pre-login boundary in code and surfaces its scope during development startup:

- `src/hosts/server/AuthMinimalServerApiRouteComposition.ts` now treats auth-minimal route coverage as an exclusive contract, not only a minimum contract:
  - required family remains `identity-auth`,
  - any additional route family now fails startup coverage assertion.
- `src/hosts/server/AuthMinimalServerHostEntrypoint.ts` now enforces a narrowed service composition contract:
  - only auth-minimal service IDs are composed for startup plan coverage,
  - unexpected or forbidden control-plane service IDs fail startup with explicit errors.
- auth-minimal persistence composition now asserts forbidden non-auth persistence surfaces are absent (authorization, node/execution, certificate/secrets metadata, storage/asset/run/audit/deployment repositories).
- development startup diagnostics now emit structured scope events so expansion is observable without debugging internals:
  - `auth-minimal-server.startup.route-scope`
  - `auth-minimal-server.startup.service-scope`
  - `auth-minimal-server.startup.persistence-scope`

Regression tests now verify these guardrails and fail loudly when route or service scope widens.

## Story C.1.3 post-login runtime lifecycle contract

Post-login runtime orchestration now has an explicit lifecycle contract boundary documented in:

- `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`

This contract defines:

- warmup trigger behavior for auth-success and lazy feature-demand activation,
- authoritative main-process lifecycle state tracking (`unavailable`, `warming`, `ready`, `failed`),
- renderer-safe lifecycle status/readiness probes exposed through preload,
- deterministic teardown/reset expectations for logout and application quit.

## Story C.2.1 post-login and on-demand runtime composition split

Desktop main-process runtime startup now separates post-login shared warmup composition from on-demand feature composition paths:

- `composePostLoginRuntime(...)` now owns post-login shared prerequisites only:
  - full-runtime storage provisioning
  - Python runtime resolution
  - service supervisor startup
  - full runtime-config projection and deferred runtime container creation
- `createOnDemandFeatureCompositionPaths(...)` now defines explicit first-use feature composition paths used by deferred IPC handlers for:
  - workflow/execution/workflow-run persistence
  - studio shell/system runtime backends
  - canonical registry runtime composition
  - agent runtime composition

Result: `bootstrapPostLoginRuntime(...)` is now a thin orchestration seam that composes post-login prerequisites and delegates feature graph activation to named on-demand composition paths, rather than acting as a single broad runtime bootstrap unit.

## Story C.2.2 deferred Python runtime resolution and supervisor startup contract

Desktop startup contracts now explicitly enforce that Python runtime resolution and local service-supervisor startup remain outside pre-login boot:

- `DesktopStartupBootSequence` now contains only pre-login auth-shell startup steps and excludes service-supervisor startup.
- `DesktopPostLoginWarmupSequence` now defines ordered post-login warmup steps:
  - `python-runtime-resolution`
  - `service-supervisor-startup`
  - `deferred-feature-registration`
- startup contract validation now fails if Python runtime resolution or service-supervisor startup is introduced into pre-login boot sequencing.
- startup regression tests now verify:
  - `bootstrapAuthShell()` does not resolve desktop Python runtime,
  - `bootstrapAuthShell()` does not construct/start `DesktopServiceSupervisor`,
  - post-login runtime composition remains the only path that resolves Python runtime and starts the supervisor.
- post-login warmup logging now emits explicit runtime start/ready diagnostics for:
  - desktop Python runtime resolution (`mode`, `available`)
  - local service supervisor startup (`baseUrl`, `runtimeBaseUrl`)

This keeps login-critical startup free of Python/runtime supervisor initialization and improves warmup observability when deferred runtime comes online.

## Story C.3.3 startup timing and memory instrumentation for deferred runtime phases

Startup instrumentation now adds explicit timing and memory checkpoints that separate pre-login critical path work from deferred runtime cost:

- pre-login and auth-minimal host checkpoints:
  - auth-minimal host startup now emits startup-memory `start` + `ready` checkpoints in the `desktop-startup.identity-auth-host-readiness` phase.
- renderer first-window readiness checkpoints:
  - `desktop-startup.main-window-creation` now emits `first-window-ready-to-show` timing/memory checkpoint.
  - `desktop-startup.host-bootstrap` now emits `renderer-first-window-ready` timing/memory checkpoint.
- post-login warmup checkpoint:
  - `desktop-startup.post-login-warmup` now emits `deferred-feature-runtime-container-ready` once deferred feature runtime container composition is complete.
- deferred service-group checkpoints (on first feature demand):
  - workflow persistence:
    - timing phase `desktop-startup.deferred-feature-runtime.workflow-persistence`
    - checkpoint `workflow-persistence-ready`
  - execution and workflow-run persistence:
    - timing phases `desktop-startup.deferred-feature-runtime.execution-history` and `desktop-startup.deferred-feature-runtime.workflow-run-history`
    - checkpoints `execution-history-ready` and `workflow-run-history-ready`
  - studio/runtime backend groups:
    - timing phases `desktop-startup.deferred-feature-runtime.studio-shell-backend-api`, `...system-studio-backend-api`, `...system-runtime-backend-api`
    - checkpoints `studio-shell-backend-api-ready`, `system-studio-backend-api-ready`, `system-runtime-backend-api-ready`

Instrumentation remains scoped to major lifecycle checkpoints and first-use composition boundaries so startup diagnostics stay actionable instead of noisy.

## Story C.2.4 deferred studio/system/image runtime module loading

Studio shell, system runtime, and image workflow/system persistence infrastructure is now deferred from pre-login startup to post-login runtime composition at module-load level as well as object-construction level:

- `electron/main/main.ts` no longer statically imports `createDeferredDesktopFeatureRuntime` at process bootstrap.
- `composePostLoginRuntime(...)` now resolves that factory through `ensureDeferredDesktopFeatureRuntimeFactory()` and dynamic-imports `./DeferredDesktopFeatureRuntime` only when post-login warmup starts.
- studio shell repositories/APIs, system runtime execution stores/audit repositories, and image workflow system persistence adapters remain owned by `DeferredDesktopFeatureRuntime` lazy `ensure*` paths and are still created only on first feature access.
- teardown now clears the cached deferred runtime factory reference in addition to existing deferred runtime disposal/reset handling.

Result: the pre-login critical path no longer pays eager module-load cost for studio/system/image deferred runtime infrastructure.

## Story C.2.5 deferred connectivity monitoring startup

Desktop connectivity monitoring startup is now moved out of pre-login bootstrap:

- `bootstrapAuthShell()` no longer starts `DesktopConnectivityStateService` monitoring.
- connectivity monitoring now starts only when `ensurePostLoginWarmupStarted(...)` accepts the first post-login warmup request.
- auth/bootstrap connectivity IPC keeps returning a controlled fallback state before warmup starts:
  - state remains `connecting`
  - detail is explicit that connectivity monitoring is deferred to post-login warmup.
- offline-mode toggles through auth/bootstrap IPC now return the same controlled deferred fallback before warmup starts instead of attempting pre-login monitoring behavior.
- teardown remains explicit through `disposeDesktopRuntimeResources()` and now always stops deferred connectivity monitoring before resetting runtime state on shutdown/logout flows.

Result: pre-login startup no longer runs recurring connectivity probes, while renderer connectivity consumers keep a stable, explicit pre-warmup contract.

## Target startup phases

## 1) Pre-login startup (critical path)

Goal: reach a login-capable renderer as fast as possible, while preserving trusted-device/session bootstrap behavior.

Must run before first window render:

- Resolve preload path and create BrowserWindow (`main.ts`, `createMainWindow()`).
- Minimal persistent storage access required for auth/session state (`DesktopStorageDatabase` only for auth keys and session payload).
- Minimal identity API surface URL bootstrap (`runtimeConfig.identityApiBaseUrl`) for renderer auth client resolution (`src/ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`).
- Trusted-device transport bootstrap projection in `bootstrap.identityTransportTrust` (`src/infrastructure/security/DesktopTrustedDeviceTransportBootstrap.ts`).
- Auth-only IPC registration:
  - `ai-loom-desktop:get-bootstrap-sync`
  - `ai-loom-desktop-storage:getItem|setItem|removeItem`
  - `ai-loom-desktop-secrets:is-available|get|set|remove`
  - optional: connectivity read/write IPC if login surface keeps showing offline/auth transport state.

Planned module/function seams:

- `bootstrapAuthShell()` (new orchestration entrypoint)
- `registerAuthIpc()` (auth/bootstrap-only IPC)
- `createAuthBootstrapContext()` (narrow context projection)

## 2) Post-login warmup (non-critical path)

Goal: initialize runtime/services needed after authenticated shell entry without blocking first login render.

Move to post-login warmup:

- `DesktopServiceSupervisor` startup (`486-498`).
- Full desktop workflow/execution/studio repositories and backend API composition (`627-671`).
- Bulk IPC registration for workflows, execution history, studio shell, system runtime, agents, model files (`675-1087`).
- Connectivity monitor start, unless login UX requires continuous pre-login connectivity state (`557-560`).

Planned module/function seams:

- `bootstrapPostLoginRuntime()`
- `registerPostLoginIpc()`

Trigger options (implementation choice in later stories):

- renderer emits a one-time `ai-loom-desktop-auth:session-ready` event after successful session bootstrap, or
- main process starts warmup after first authenticated route confirmation.

## 3) On-demand feature initialization (lazy)

Goal: keep heavyweight feature infrastructure out of both pre-login and immediate post-login when not needed.

Keep lazy/on-demand:

- Canonical registry runtime dynamic imports (`ensureCanonicalRegistryRuntime()` already lazy by call-site; keep that posture).
- Agent runtime composition (`ensureAgentStudioBackendApi()` already lazy by call-site; keep that posture).
- Feature-specific IPC groups that are not needed for auth + initial shell route.

Planned module/function seams:

- `registerDeferredFeatureIpc()`
- `ensureFeatureRuntime(featureId)` helper for lazy runtime activation.

## Required bootstrap context for auth/session restoration

Preload/renderer auth path currently requires only a narrow subset of `DesktopBootstrapContext`.

Required:

- `bootstrap.runtimeConfig.identityApiBaseUrl`
  - Used by `resolveDesktopIdentityApiBaseUrl()` and `IdentityAuthService` HTTP client construction.
- `bootstrap.identityTransportTrust`
  - Used by `DesktopTrustedDeviceTransportBootstrap` to enforce trusted-device bootstrap preconditions and request shaping.
- optional auth-shell metadata:
  - `bootstrap.storage.appDataDirectory`
  - `bootstrap.environment.isPackaged`
- `storage` bridge (`getItem/setItem/removeItem`)
  - Used by `IdentityAuthSessionStore` for `ai-loom.identity.session.v1` persistence/restore.

Not required for pre-login auth bootstrap:

- full `bootstrap.storage` path metadata (`modelsDirectory`, `assetsDirectory`, etc.).
- `bootstrap.serviceSupervisor` details.
- `bootstrap.pythonRuntime` details.
- runtime config fields for service supervisor/Python/workflow path metadata.
- Any workflow/model/studio/agent/canonical runtime services.

## Story A.1.3 implementation updates

- `DesktopAuthBootstrapContext` now defines the preload bootstrap contract for pre-login auth/session restoration.
- `DesktopAuthBootstrapRuntimeConfig` is a projected runtime config subset that excludes service supervisor, Python runtime, workflow path metadata, and desktop storage runtime internals.
- `AppRuntimeConfig.resolveDefault()` remains backward-safe by materializing both legacy full bootstrap runtime payloads and the new auth-minimal runtime payload.

## Over-scoped pre-login dependencies to remove from critical path

Primary over-scope in current startup:

- Full desktop runtime bootstrap before window creation (`bootstrapDesktopRuntime()` gate).
- Broad authoritative server host startup before first render (replaced by `startAuthMinimalServerHostAssembly(...)` auth-minimal startup).
- Full preload bridge exposure on startup (`electron/preload.ts`) regardless of login/auth phase.
- Feature IPC registrations and repository composition that are unrelated to login/session validation.

Boundary target for authoritative server startup:

- pre-login should depend on an auth-minimal authoritative identity surface only;
- broader authoritative capabilities should start in post-login warmup or feature-specific demand paths.

## Proposed implementation map for follow-on stories

`electron/main/main.ts` split target:

1. `bootstrapAuthShell()`  
2. `installRendererContentSecurityPolicy()`  
3. `createMainWindow()`  
4. `bootstrapPostLoginRuntime()` (triggered after auth readiness)  
5. `registerDeferredFeatureIpc()` for lazy feature surfaces.

Suggested new module boundaries (names can be adjusted to repo conventions):

- `electron/main/bootstrap/bootstrapAuthShell.ts`
- `electron/main/bootstrap/bootstrapPostLoginRuntime.ts`
- `electron/main/ipc/registerAuthIpc.ts`
- `electron/main/ipc/registerDeferredFeatureIpc.ts`
- `electron/main/bootstrap/DesktopAuthBootstrapContext.ts` (narrow context contract/projection)

## Acceptance for this boundary note

This document sets the concrete target architecture for startup splitting so later stories can implement without re-deciding:

- pre-login responsibilities,
- post-login warmup responsibilities,
- on-demand responsibilities,
- minimal bootstrap data required for auth/session restoration,
- major startup work to move off first-render critical path.
