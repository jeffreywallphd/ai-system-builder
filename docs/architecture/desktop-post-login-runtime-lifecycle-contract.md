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
- runtime status states:
  - `unavailable`
  - `warming`
  - `ready`
  - `failed`
- activation modes:
  - `auth-success-warmup`
  - `lazy-feature-demand`

## Responsibility Split

Main process (`electron/main`):

- owns lifecycle state transitions and authoritative status.
- owns warmup orchestration (`ensurePostLoginWarmupStarted` -> `bootstrapPostLoginRuntime`).
- owns deferred feature IPC readiness gate (`deferredFeatureIpcReady`).
- owns teardown/reset transitions during desktop runtime disposal.

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
2. if warmup already started/completed, ignore duplicate start requests.
3. otherwise set lifecycle state to `warming` with activation mode `auth-success-warmup`.
4. execute post-login runtime bootstrap.

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
- monitoring starts when post-login warmup is first accepted (`ensurePostLoginWarmupStarted(...)`).
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

