# AI Companion: Desktop Post-Login Runtime Lifecycle Contract

Feature: C  
Epic: C.1  
Story: C.1.3

## Purpose
- Define the explicit post-login runtime orchestration contract so deferred runtime never drifts back into pre-login startup.
- Make warmup trigger behavior, lifecycle status semantics, and teardown/reset behavior implementation-ready across main/preload/renderer.

## Canonical boundary
- `DesktopPostLoginRuntimeLifecycle`
- canonical runtime contract source: `src/application/common/DesktopControlPlaneRuntimeContracts.ts`
- canonical shared runtime availability response contracts: `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- trigger request: `DesktopPostLoginWarmupRequest`
- status read model: `DesktopPostLoginRuntimeStatus`
- capability phases: `pre-login`, `warming`, `ready`, `failed`
- transport phases: `unavailable`, `binding`, `available`, `failed`
- activation modes: `auth-success-warmup`, `lazy-feature-demand`

## Story 1.2.1 runtime availability response contracts

Shared runtime lifecycle response shapes now define explicit stateful payloads for both readiness and guarded runtime endpoint contracts without coupling callers to transport outages:

- canonical lifecycle states:
  - `unavailable`
  - `warming`
  - `ready`
  - `failed`
- readiness endpoints can return `RuntimeReadinessResponseContract` with a `runtime` lifecycle payload.
- guarded runtime endpoints can return `RuntimeGuardedEndpointUnavailableResponseContract` with endpoint identity + blocked lifecycle state.
- contracts include:
  - machine-readable blocking reason codes,
  - retryability and optional retry timing,
  - ISO timestamps (`checkedAt`, `updatedAt`, and state-specific timestamps),
  - optional diagnostics metadata for desktop-local troubleshooting.

## Layer responsibilities
- main (`electron/main`):
  - owns lifecycle transitions and authoritative status payload.
  - owns warmup orchestration (`ensurePostLoginWarmupStarted` -> `createPostLoginRuntimeBootstrapper(...).bootstrap(...)`).
  - owns deferred feature IPC readiness gate and runtime disposal/reset transitions.
  - composes focused runtime-control modules for stateful lifecycle concerns:
    - `electron/main/DesktopPostLoginRuntimeStatusStore.ts`
    - `electron/main/DesktopConnectivityRuntimeController.ts`
    - `electron/main/runtime/PostLoginRuntimeBootstrapper.ts`
    - `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`
- preload (`electron/preload.ts`):
  - exposes runtime status/readiness probes and warmup trigger bridge.
  - enforces deferred API guards until runtime is ready.
- renderer (`src/ui`):
  - emits auth-success warmup triggers.
  - reads runtime status when it needs more than binary readiness.
  - handles deferred unavailable behavior as controlled state.

## Trigger contract
- auth-success trigger sources:
  - `explicit-login`
  - `session-restore`
  - `session-refresh`
  - `unknown`
- lazy trigger source:
  - `feature-demand`

Main trigger semantics:
1. join if warmup already in flight,
2. ignore if warmup already started/completed,
3. otherwise transition to `warming` with activation mode derived from trigger,
4. bootstrap post-login runtime once and reuse the same in-flight promise.

## Story C.2.2 runtime infrastructure boundary

The deferred warmup path is now the only contract-allowed location for:

- desktop Python runtime resolution (`resolveDesktopPythonRuntime(...)`)
- local managed service startup (`DesktopServiceSupervisor.start()`)

Pre-login contract guardrails now require:

- pre-login startup sequence does not include Python runtime resolution or service-supervisor startup,
- `bootstrapAuthShell()` remains free of Python/supervisor composition logic.

Operational diagnostics now explicitly log deferred warmup start/ready details for both Python runtime resolution and service-supervisor startup.

## Story C.2.5 connectivity monitoring lifecycle boundary

Connectivity monitoring now uses the deferred runtime lifecycle contract:

- pre-login auth-shell startup no longer starts recurring connectivity monitoring probes.
- monitoring starts only once post-login warmup is accepted (`ensurePostLoginWarmupStarted(...)`).
- pre-warmup renderer connectivity reads return a controlled fallback payload (`connecting`) with explicit deferred-monitoring detail.
- pre-warmup offline-mode write attempts return the same fallback payload, preventing partial pre-login monitoring emulation.
- runtime disposal/teardown explicitly stops connectivity monitoring before runtime reset so quit/logout lifecycle remains deterministic.

## Story C.3.1 preload and IPC surface split boundary

Desktop preload bridge exposure is now split into canonical namespaces:

- `window.aiLoomDesktop.auth`
  - always available during pre-login startup
  - contains bootstrap context, storage, secrets, connectivity, and runtime lifecycle probes/triggers
- `window.aiLoomDesktop.features`
  - deferred feature bridge groups
  - guarded until deferred feature IPC readiness is true
  - first guarded access emits a `feature-demand` warmup request through the runtime warmup channel

Compatibility constraint:

- legacy root aliases can remain temporarily for compatibility, but new renderer integration should consume `auth` and `features` namespaces as the authoritative contract.

## Status/readiness exposure
- status channel:
  - `ai-loom-desktop-runtime:get-post-login-runtime-status`
  - preload runtime bridge: `getPostLoginRuntimeStatus()`
- readiness channel:
  - `ai-loom-desktop-runtime:is-feature-api-ready`
  - preload runtime bridge: `isDeferredFeatureApiReady()`

Contract rule:
- readiness `true` implies status `ready`.
- renderer may continue using readiness for binary gating.
- renderer should use status probe for warming/failed/unavailable awareness.
- runtime readiness must be inferred from capability phase (`ready`), not transport listener existence; transport continuity is reported separately in `status.transport`.

## Story C.3.2 renderer readiness/failure boundary

Renderer now applies a deferred-runtime feature-entry boundary instead of assuming post-login runtime is immediately ready:

- `src/ui/runtime/DeferredRuntimeFeatureGate.ts`
  - resolves runtime bridge from `window.aiLoomDesktop.auth.runtime` (legacy fallback supported),
  - requests `feature-demand` warmup on first gated feature entry,
  - polls lifecycle status until `ready`,
  - maps lifecycle states into controlled surface states (`loading`, `disconnected`, `error`) with retry support.
- `src/ui/layout/AppLayout.tsx`
  - gates deferred-runtime-dependent routes at the `Outlet` boundary:
    - `/build*`, `/explore*`, `/run*`, `/assets*`, `/workflows/*`, `/studio-shell/*`
  - renders existing `SurfaceStatePanel` status presentation and a localized retry action when runtime is unavailable/failed.

Contract intent:

- login remains fast (no new global post-login blocking screen),
- deferred feature entry points no longer race deferred runtime warmup,
- failures/unavailability are surfaced in a controlled way that is clear to users and actionable for developers.

## Story C.3.3 startup instrumentation boundary

The runtime lifecycle contract now includes explicit timing + memory checkpoints that separate critical-path startup from deferred/runtime-on-demand work:

- pre-login/authoritative control-plane host:
  - auth-shell phase remains instrumented under `desktop-startup.pre-login-auth-shell-bootstrap`.
  - authoritative control-plane host readiness now logs startup-memory at `start` and `ready` in `desktop-startup.identity-auth-host-readiness`.
- first-window readiness:
  - `desktop-startup.main-window-creation` now logs `first-window-ready-to-show`.
  - `desktop-startup.host-bootstrap` now logs `renderer-first-window-ready`.
- post-login warmup:
  - `desktop-startup.post-login-warmup` now logs `deferred-feature-runtime-container-ready` after deferred container composition.
- deferred first-use service groups (in `DeferredDesktopFeatureRuntime`):
  - workflow persistence
  - execution/workflow run persistence
  - studio shell backend
  - system studio/runtime backends

Each first-use group now emits paired `[ai-loom][startup]` timing and `[ai-loom][startup-memory]` checkpoints using `desktop-startup.deferred-feature-runtime.*` timing phases.

## Story C.3.4 startup boundary regression safeguards

The deferred runtime lifecycle contract now includes explicit regression guardrails that prevent non-auth runtime groups from drifting back into pre-login startup:

- startup contract guard list (`PreLoginStartupForbiddenRuntimeGroups`) now explicitly requires:
  - `service-supervisor`
  - `python-runtime-resolution`
  - `workflow-persistence`
  - `execution-history`
  - `workflow-run-history`
  - `studio-shell-backend-api`
  - `system-studio-backend-api`
  - `system-runtime-backend-api`
  - `desktop-connectivity-monitor`
- startup contract validation fails if this required guard list is removed or narrowed.
- focused Electron main regression coverage now asserts:
  - `bootstrapAuthShell()` does not activate those runtime groups,
  - connectivity monitoring starts only once post-login warmup is accepted,
  - Python runtime resolution and service-supervisor startup remain in post-login composition,
  - workflow/studio/system backends remain lazy through deferred runtime `ensure*` paths.

## Story C.3.5 runtime-control extraction boundary

- Post-login runtime lifecycle state transitions now flow through `createDesktopPostLoginRuntimeStatusStore(...)` instead of ad hoc mutable status variables in `main.ts`.
- Deferred connectivity lifecycle behavior (placeholder state creation, auth IPC serialization, offline-mode fallback/write handling, monitoring start/stop ownership) now flows through `createDesktopConnectivityRuntimeController(...)`.
- Contract semantics remain unchanged:
  - deferred placeholder detail text remains stable,
  - monitoring starts only after warmup acceptance,
  - probe token lookup still resolves through persisted bootstrap storage.

## Story C.3.6 bootstrap/disposal module extraction boundary

- Post-login runtime bootstrap/composition internals are now centralized in `electron/main/runtime/PostLoginRuntimeBootstrapper.ts`.
- Runtime teardown/reset sequencing internals are now centralized in `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`.
- `electron/main/main.ts` remains the composition root that decides when warmup/disposal runs, while delegating lifecycle implementation details to those dedicated modules.

## Story C.3.7 continuous listener availability regression coverage

- Runtime lifecycle regression coverage now explicitly protects continuous control-plane listener availability across capability-state transitions.
- `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` now verifies transport identity continuity (`boundAddress`/`boundPort`) across:
  - `pre-login`
  - `warming`
  - `ready`
  - `failed`
- `electron/main/tests/MainPreLoginControlPlaneHostStartup.test.ts` now verifies bind-once host reuse semantics remain explicit in `ensureDesktopControlPlaneHostBound(...)` via:
  - persisted runtime reuse path,
  - bind-start/bind-ready transition reasons,
  - reuse transition reason (`authoritative-host-bind-reused`).
- `electron/main/tests/MainDeferredRuntimeStartupBoundary.test.ts` now verifies post-login warmup capability activation does not trigger listener rebinding by asserting warmup flow excludes transport rebinding markers and bind/start entrypoints.

Contract intent:

- capability lifecycle transitions must not be modeled as transport outages,
- the desktop session retains one authoritative listener identity while runtime capabilities warm and fail/retry,
- tests fail if stop-and-rebind behavior is introduced into warmup pathways.

## Story 1.2.2 runtime route-family registration continuity

Desktop control-plane host startup now composes runtime route families at initial host bind instead of relying on post-login host replacement:

- `electron/main/main.ts` uses `composeDesktopAuthoritativeServerApiRouteRegistrationPlan()` when bootstrapping the authoritative host.
- runtime route-family registration remains continuous across pre-login, warming, and ready phases.
- lifecycle-aware capability gating continues to block deferred runtime families before activation with explicit unavailable responses.
- non-desktop startup paths keep default route-plan behavior unless they explicitly request runtime route-family inclusion.

## Story 1.2.4 backend runtime-state authority wiring

- Backend runtime capability guarding now reads desktop lifecycle state from the same post-login runtime status store used by auth IPC (`postLoginRuntimeStatusStore.getStatus()`).
- Authoritative server host composition projects that status source into route-family availability resolution so runtime guarded families evaluate availability from `capabilityPhase` (`pre-login` -> `warming` -> `ready` -> `failed`) instead of a duplicate backend-only lifecycle model.
- Capability activation remains the registration/ownership seam for deferred route families, while lifecycle gating state is now sourced from the authoritative desktop runtime lifecycle contract.

## Story 1.2.6 runtime read/mutation guard consistency

- Runtime lifecycle guarding now resolves endpoint-aware route-family intent for overlapping runtime prefixes before evaluating availability.
- Guarded runtime lifecycle responses now cover:
  - run submission (`/api/v1/runtime/runs/start`, image-system run submission),
  - run reads (run list/detail/status, queue reads),
  - run mutations (cancel/retry, queue dequeue),
  - image runtime routes that depend on deferred runtime activation.
- Non-ready runtime requests now consistently return structured runtime-unavailable payloads (`RuntimeGuardedEndpointUnavailableResponseContract`) instead of falling back to generic route-family errors.
- Readiness-state bypass remains limited to execution-readiness reads so lifecycle status can still be observed while other runtime read/mutation endpoints stay explicitly guarded.

## Story 1.2.7 typed diagnostics for blocking runtime dependencies

- Runtime lifecycle blocking responses now include typed diagnostics in `RuntimeAvailabilityResponseContract.diagnostics` with stable renderer-safe fields:
  - `lifecycleState`
  - `blockingDependencyCategory`
  - `retryable`
  - optional `summary`, `routeFamilyId`, `capabilityId`, `lifecyclePhase`, and `transportPhase`
- Blocking dependency categories are normalized to controlled values:
  - `authentication`
  - `capability-activation`
  - `runtime-supervisor`
  - `control-plane-transport`
  - `unknown`
- Desktop route-family availability now carries runtime lifecycle snapshots sourced from authoritative post-login runtime status (capability phase + transport/supervisor indicators) instead of placeholder guard metadata.
- Runtime capability guard mapping now derives diagnostics from those lifecycle snapshots so responses identify whether blocking is caused by auth/session phase, capability activation warmup, runtime supervisor failure, or control-plane transport state.
- Execution readiness state-driven bypass surfaces the same typed lifecycle diagnostics in both `runtimeLifecycle` and readiness-level diagnostics, preserving observability without leaking internal error internals.

## Deferred API behavior
- before readiness:
  - async deferred APIs reject with explicit unavailable errors,
  - sync deferred APIs throw explicit unavailable errors,
  - workflow persistence status returns degraded deferred payload.
- after readiness:
  - deferred API calls route through registered feature IPC handlers.

## Failure behavior
- warmup/bootstrap failure transitions lifecycle to `failed` with:
  - failure message
  - failure timestamp
  - retryable flag
- failures remain visible through status probe and main-process logs.

## Teardown/reset behavior
- app quit / host stop:
  - transition to `unavailable(shutting-down)` before disposal
  - dispose runtime resources
  - reset to `unavailable(pre-login)` for clean bootstrap baseline
- logout contract target:
  - dispose/reset post-login runtime while retaining auth-shell
  - transition to `unavailable(logged-out)`
  - allow next session to re-trigger warmup via auth-success or lazy feature demand

## Related implementation seams
- `electron/main/main.ts`
- `electron/main/AuthBootstrapIpcRegistration.ts`
- `electron/preload.ts`
- `electron/shared/DesktopContracts.ts`
- `src/ui/runtime/DesktopPostLoginWarmup.ts`
- `src/ui/App.tsx`
