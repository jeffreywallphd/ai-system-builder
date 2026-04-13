# Desktop Post-Login Runtime Lifecycle Contract

Feature: C  
Epic: C.1  
Story: C.1.3

## Purpose

Define the concrete orchestration contract for post-login runtime startup, status tracking, renderer safety checks, and teardown so deferred runtime remains outside the pre-login critical path.

This contract is implementation-oriented and mapped to current seams in:

- `electron/main/main.ts`
- `electron/main/AuthBootstrapIpcRegistration.ts`
- `electron/preload.ts`
- `electron/shared/DesktopContracts.ts`
- `src/ui/runtime/DesktopPostLoginWarmup.ts`
- `src/ui/App.tsx`

## Lifecycle Boundary Name

Canonical boundary name for this feature slice:

- `DesktopPostLoginRuntimeLifecycle`

Contract surfaces:

- runtime warmup trigger request: `DesktopPostLoginWarmupRequest`
- runtime lifecycle status read model: `DesktopPostLoginRuntimeStatus`
- canonical runtime contract source: `src/application/common/DesktopControlPlaneRuntimeContracts.ts`
- canonical shared runtime availability response contracts: `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- runtime capability phases:
  - `pre-login`
  - `warming`
  - `ready`
  - `failed`
- runtime transport phases:
  - `unavailable`
  - `binding`
  - `available`
  - `failed`
- activation modes:
  - `auth-success-warmup`
  - `lazy-feature-demand`

## Story 1.2.1 runtime availability response contracts

Shared runtime lifecycle response shapes now define explicit stateful payloads for readiness and guarded runtime endpoint contracts so callers do not depend on transport outages to infer capability state.

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

## Responsibility Split

Main process (`electron/main`):

- owns lifecycle state transitions and authoritative status.
- owns warmup orchestration (`createPostLoginRuntimeActivationService(...).startPostLoginWarmup(...)` -> `createPostLoginRuntimeDependencyActivator(...).activateDependencies(...)`).
- owns deferred feature IPC readiness gate (`deferredFeatureIpcReady`).
- owns teardown/reset transitions during desktop runtime disposal through `createDesktopRuntimeDisposalCoordinator(...)`.
- composes focused runtime-control modules for lifecycle and connectivity:
  - `electron/main/DesktopPostLoginRuntimeStatusStore.ts`
  - `electron/main/DesktopConnectivityRuntimeController.ts`
  - `electron/main/runtime/PostLoginRuntimeActivationService.ts`
  - `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`
  - `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`

Preload (`electron/preload.ts`):

- exposes lifecycle-safe runtime bridge APIs.
- guards deferred feature APIs until ready.
- returns controlled unavailable behavior for deferred APIs before readiness.

Renderer (`src/ui`):

- triggers auth-success warmup requests after authentication outcomes.
- reads lifecycle status through preload runtime bridge when UI needs explicit runtime status semantics.
- treats deferred bridge unavailable errors and non-ready status as non-fatal state, not startup crashes.

## Trigger Contract

### 1. Auth-success warmup trigger

Renderer triggers `startPostLoginWarmup(...)` after successful auth/session restore/refresh:

- trigger sources:
  - `explicit-login`
  - `session-restore`
  - `session-refresh`
  - `unknown`

Main behavior:

1. if warmup is already in flight, join existing promise (no duplicate bootstrap).
2. if runtime activation is already `ready`, ignore duplicate start requests (idempotent steady state).
3. otherwise set lifecycle state to `warming` with activation mode `auth-success-warmup`.
4. execute post-login runtime bootstrap.
5. if activation fails, return activation state to retryable idle.

### 2. Lazy feature-demand trigger

Lazy trigger source is reserved for feature-first activation paths:

- trigger source: `feature-demand`
- activation mode: `lazy-feature-demand`

When a feature route or IPC surface first requires deferred runtime and auth-success warmup has not already started:

1. main process issues the same warmup orchestration path as auth-success startup.
2. lifecycle status transitions to `warming` with `lazy-feature-demand`.
3. readiness semantics remain identical (`ready` only after deferred feature IPC registration is complete).

## Story C.2.2 deferred infrastructure scope

Post-login warmup is now the only allowed runtime path for:

- desktop Python runtime resolution (`resolveDesktopPythonRuntime(...)`)
- local managed service-supervisor startup (`DesktopServiceSupervisor.start()`)

Pre-login startup contract checks now enforce that:

- startup boot sequencing excludes Python runtime resolution and service-supervisor startup
- `bootstrapAuthShell()` does not compose Python runtime or service-supervisor logic

Warmup diagnostics now include explicit deferred startup logs for Python runtime resolution and supervisor startup readiness.

## Story C.2.5 deferred connectivity monitoring lifecycle

Connectivity monitoring now follows the same deferred lifecycle boundary as other non-auth runtime services:

- pre-login auth-shell bootstrap does not start recurring connectivity probes.
- monitoring starts when post-login warmup is first accepted (`startPostLoginWarmup(...)` in `PostLoginRuntimeActivationService`).
- renderer connectivity reads through auth/bootstrap IPC receive a controlled pre-warmup fallback state until monitoring starts.
- renderer offline-mode write attempts before monitoring startup receive the same fallback state rather than partial pre-login monitoring emulation.
- runtime teardown (`disposeDesktopRuntimeResources()`) explicitly stops connectivity monitoring before resetting runtime state, so quit/logout shutdown paths remain deterministic.

## Story C.3.1 preload and IPC surface split contract

Desktop bridge exposure is now explicitly separated into two surfaces:

- `window.aiLoomDesktop.auth`
  - always available during pre-login startup
  - includes bootstrap metadata, storage, secrets, connectivity, and runtime lifecycle probe/trigger APIs
- `window.aiLoomDesktop.features`
  - deferred feature bridge surface
  - APIs are guarded until deferred runtime is ready
  - first deferred feature use issues a `feature-demand` warmup trigger through the existing runtime warmup channel

Compatibility rule:

- legacy root aliases (for example `window.aiLoomDesktop.workflows`) may remain for transition compatibility, but renderer integrations should resolve through `auth` and `features` as the canonical contract.

## Story C.3.2 renderer deferred runtime readiness/failure handling

Renderer feature-entry handling now enforces deferred runtime readiness without introducing a monolithic post-login blocker:

- `src/ui/layout/AppLayout.tsx` now applies a feature-entry boundary before `Outlet` rendering for deferred-runtime-dependent routes:
  - `/build*`
  - `/explore*`
  - `/run*`
  - `/assets*`
  - `/workflows/*`
  - `/studio-shell/*`
- `src/ui/runtime/DeferredRuntimeFeatureGate.ts` now:
  - reads lifecycle status through `auth.runtime.getPostLoginRuntimeStatus()` (with legacy fallback),
  - requests `feature-demand` warmup on gated route entry,
  - polls lifecycle status while warmup is in progress,
  - maps `warming`, `unavailable`, and `failed` into controlled surface presentation states.

Behavioral contract:

- authenticated login flow stays fast and unchanged;
- only deferred-dependent feature entries show localized warmup/failure states;
- failure/unavailable messaging stays user-readable while including concise diagnostics (`runtime state`, `reason`, `updatedAt`, optional failure message) for developers;
- retry action is exposed at the feature boundary and re-requests deferred warmup without resetting the entire app shell.

## Story C.3.3 startup instrumentation contract

Deferred runtime lifecycle observability now includes explicit startup timing and memory checkpoints at major lifecycle boundaries:

- pre-login/auth shell critical-path checkpoints:
  - auth shell phase instrumentation remains in `desktop-startup.pre-login-auth-shell-bootstrap`.
  - authoritative control-plane host readiness phase now includes startup-memory checkpoints at `start` and `ready`.
- renderer first-window readiness checkpoints:
  - `desktop-startup.main-window-creation` checkpoint: `first-window-ready-to-show`.
  - `desktop-startup.host-bootstrap` checkpoint: `renderer-first-window-ready`.
- post-login warmup composition checkpoint:
  - `desktop-startup.post-login-warmup` checkpoint: `deferred-feature-runtime-container-ready`.
- deferred runtime first-use service groups:
  - workflow persistence (`workflow-persistence-ready`).
  - execution/workflow run persistence (`execution-history-ready`, `workflow-run-history-ready`).
  - studio/runtime backends (`studio-shell-backend-api-ready`, `system-studio-backend-api-ready`, `system-runtime-backend-api-ready`).

All deferred first-use group checkpoints emit paired startup timing (`[ai-loom][startup]`) and memory (`[ai-loom][startup-memory]`) logs using dedicated deferred runtime timing phase names under `desktop-startup.deferred-feature-runtime.*`.

## Story C.3.4 startup boundary regression safeguards

Deferred runtime lifecycle protection now includes explicit startup guardrails that fail loudly when non-auth runtime work is reintroduced into pre-login startup:

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
- startup contract validation now throws if that required deferred-runtime guard list is removed or narrowed.
- focused Electron main regression coverage now verifies:
  - `bootstrapAuthShell()` does not activate those deferred runtime groups,
  - connectivity monitoring starts only from accepted post-login warmup,
  - Python runtime resolution and service-supervisor startup remain post-login composition work,
  - workflow/studio/system backends remain on-demand via deferred runtime `ensure*` activators.

## Story C.3.5 runtime-control extraction seam

To reduce scattered mutable state in `electron/main/main.ts` while preserving behavior:

- post-login lifecycle status transitions are hosted by `createDesktopPostLoginRuntimeStatusStore(...)`.
- auth IPC status reads (`getPostLoginRuntimeStatus`) delegate to this store.
- deferred connectivity placeholder generation, auth IPC serialization, offline-mode write handling, and monitoring start/stop lifecycle are hosted by `createDesktopConnectivityRuntimeController(...)`.
- monitoring still starts only when post-login warmup is accepted, and still provisions probe token lookup from persisted storage before starting monitor probes.

Story C.3.6 further extracts runtime lifecycle machinery from the Electron composition root:

- post-login runtime warmup orchestration now lives in `electron/main/runtime/PostLoginRuntimeActivationService.ts`.
- post-login runtime dependency activation/composition details now live in `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`.
- shutdown/disposal sequencing and state reset details now live in `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`.
- `electron/main/main.ts` now primarily composes dependencies and delegates warmup/disposal orchestration to those modules.

## Story C.3.7 continuous listener availability regression coverage

Runtime lifecycle regression coverage now explicitly guards continuous control-plane listener availability across capability-state transitions:

- `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` now verifies transport identity continuity (`boundAddress` and `boundPort`) across:
  - `pre-login`
  - `warming`
  - `ready`
  - `failed`
- `electron/main/tests/MainPreLoginControlPlaneHostStartup.test.ts` now verifies bind-once host reuse semantics remain explicit in `ensureDesktopControlPlaneHostBound(...)`:
  - persisted runtime reuse branch remains in place,
  - bind-start and bind-ready reasons remain explicit,
  - reuse reason (`authoritative-host-bind-reused`) remains explicit.
- `electron/main/tests/MainDeferredRuntimeStartupBoundary.test.ts` now verifies post-login warmup capability activation does not perform listener rebinding by asserting warmup flow excludes transport rebinding markers and bind/start entrypoints.

Contract intent:

- capability transitions are not treated as transport outages,
- one authoritative listener identity remains stable for the desktop session while capabilities warm and fail/retry,
- regression coverage fails if stop-and-rebind behavior returns to warmup paths.

## Story 1.3.2 activation idempotency and join semantics

- `PostLoginRuntimeActivationService` now models activation with explicit states (`idle`, `activating`, `ready`) instead of inferring state from transport continuity.
- Concurrent warmup requests from `explicit-login`, `session-restore`, `session-refresh`, and `feature-demand` all join one in-flight activation promise.
- After activation reaches `ready`, repeated warmup requests are no-ops and must not re-run capability activation, connectivity monitor startup, or runtime dependency activation.
- Activation failure returns the service to `idle`, allowing subsequent warmup requests to retry without replacing the control-plane listener.

## Story 1.2.2 runtime route-family registration continuity

Desktop control-plane host startup now keeps runtime route families registered from initial bind:

- `electron/main/main.ts` now passes `composeDesktopAuthoritativeServerApiRouteRegistrationPlan()` into authoritative host bootstrap.
- runtime route-family registration no longer depends on post-login host replacement.
- pre-login and warming requests are still blocked by capability-state checks (stateful unavailable responses) until post-login warmup activates deferred runtime capabilities.
- non-desktop startup paths continue using `composeAuthoritativeServerApiRouteRegistrationPlan()` defaults unless they explicitly opt in.

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

## Status Contract

### Authoritative status probe (main -> preload -> renderer)

- IPC channel: `ai-loom-desktop-runtime:get-post-login-runtime-status`
- preload bridge: `runtime.getPostLoginRuntimeStatus()`

Status payload: `DesktopPostLoginRuntimeStatus`

- required:
  - `state`
  - `updatedAt`
- optional context:
  - `activationMode`
  - `triggerSource`
  - `requestedAt`
  - `unavailableReason`
  - `failure`

### Readiness probe compatibility

- Existing boolean readiness probe remains:
  - IPC channel: `ai-loom-desktop-runtime:is-feature-api-ready`
  - preload bridge: `runtime.isDeferredFeatureApiReady()`

Contract rule:

- `isDeferredFeatureApiReady() === true` implies lifecycle `state === ready`.
- renderer code that only needs binary readiness may continue using the boolean probe.
- renderer code that needs warmup/failure visibility should use `getPostLoginRuntimeStatus()`.
- runtime readiness must be inferred from capability phase (`ready`), not from transport listener existence alone.

### Deferred feature API guard behavior

Before readiness:

- sync deferred APIs throw explicit unavailable errors.
- async deferred APIs reject with explicit unavailable errors.
- workflow persistence status returns degraded deferred-state payload.

After readiness:

- guarded APIs execute against registered deferred IPC handlers.

## Failure Contract

Warmup/bootstrap failures transition lifecycle state to `failed` and attach structured failure metadata:

- `failure.message`
- `failure.failedAt`
- `failure.retryable` (current contract: `true`)

Failure handling remains explicit:

- main logs failure with context.
- startup path keeps deterministic shutdown/fail-fast behavior when warmup failure is unrecoverable.

## Teardown and Reset Contract

### Application quit

During desktop runtime disposal (for host stop/app quit):

1. lifecycle state transitions to `unavailable` with reason `shutting-down`.
2. runtime resources are stopped/disposed.
3. lifecycle state is reset to `unavailable` with reason `pre-login`.

### Logout

Contract target for authenticated logout:

1. renderer logout flow requests runtime reset.
2. main disposes post-login runtime resources without tearing down pre-login auth shell.
3. lifecycle state transitions to `unavailable` with reason `logged-out`.
4. next authenticated session may re-trigger warmup through auth-success or lazy feature demand.

This story defines the logout reset contract boundary and status semantics so follow-on stories can implement logout-triggered runtime reset without re-deciding lifecycle behavior.

## Story 1.3.3 Python runtime resolution activation stage

- Python runtime resolution is now an explicit post-login activation stage owned by `electron/main/runtime/PythonRuntimeResolutionActivationStage.ts`.
- Stage lifecycle reporting is surfaced through `DesktopPostLoginRuntimeStatus.activationStages` with explicit `pending` -> `running` -> `ready|blocked` transitions for `python-runtime-resolution`.
- `PostLoginRuntimeDependencyActivator` now executes Python resolution through that stage wrapper, preserving existing packaged and development resolver behavior while adding explicit stage-level observability and error reporting.
- Route-family runtime lifecycle snapshots now include activation-stage status so backend runtime capability guard responses can report when Python runtime resolution is currently blocking readiness.
- Guard diagnostics now expose optional stage-level blocking fields (`blockingActivationStageId`, `blockingActivationStageState`, `blockingActivationStageDetail`) without changing existing runtime availability contract versioning.
- Regression coverage now includes:
  - `electron/main/tests/PythonRuntimeResolutionActivationStage.test.ts` for successful and blocked resolution paths.
  - `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` stage transition/read-model coverage.
  - `src/infrastructure/transport/http-server/identity/tests/RuntimeCapabilityGuardMiddleware.test.ts` stage-aware blocking diagnostics.
