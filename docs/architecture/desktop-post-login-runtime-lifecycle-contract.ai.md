# AI Companion: Desktop Post-Login Runtime Lifecycle Contract

Feature: C  
Epic: C.1  
Story: C.1.3

## Purpose
- Define the explicit post-login runtime orchestration contract so deferred runtime never drifts back into pre-login startup.
- Make warmup trigger behavior, lifecycle status semantics, and teardown/reset behavior implementation-ready across main/preload/renderer.

## Canonical boundary
- `DesktopPostLoginRuntimeLifecycle`
- trigger request: `DesktopPostLoginWarmupRequest`
- status read model: `DesktopPostLoginRuntimeStatus`
- states: `unavailable`, `warming`, `ready`, `failed`
- activation modes: `auth-success-warmup`, `lazy-feature-demand`

## Layer responsibilities
- main (`electron/main`):
  - owns lifecycle transitions and authoritative status payload.
  - owns warmup orchestration (`ensurePostLoginWarmupStarted` -> `bootstrapPostLoginRuntime`).
  - owns deferred feature IPC readiness gate and runtime disposal/reset transitions.
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

