# Desktop Auth-First Startup Boundary

Feature: A  
Epic: A.1  
Story: A.1.1

## Purpose

Define an explicit Electron startup boundary so the first login-capable window is created from a minimal auth bootstrap surface, with non-auth runtime moved to post-login or deferred feature initialization.

## Current startup behavior (as implemented)

`electron/main/main.ts` currently runs one monolithic `bootstrapDesktopRuntime()` path before `createMainWindow()`:

1. Initializes desktop storage and runtime config (`460-556`).
2. Starts local service supervisor and full authoritative server host (`486-534`).
3. Builds `bootstrapContext` and starts connectivity monitoring (`547-560`).
4. Registers auth IPC plus broad workflow/runtime/agent/studio/registry/model-file IPC (`562-1290`).
5. Only after all of the above, creates the main window (`1327-1333`).

This makes first render depend on work that is not required for login/session restoration.

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
- `storage` bridge (`getItem/setItem/removeItem`)
  - Used by `IdentityAuthSessionStore` for `ai-loom.identity.session.v1` persistence/restore.

Not required for pre-login auth bootstrap:

- `bootstrap.storage` path metadata (`appDataDirectory`, `modelsDirectory`, etc.).
- `bootstrap.serviceSupervisor` details.
- `bootstrap.pythonRuntime` details.
- Any workflow/model/studio/agent/canonical runtime services.

## Over-scoped pre-login dependencies to remove from critical path

Primary over-scope in current startup:

- Full desktop runtime bootstrap before window creation (`bootstrapDesktopRuntime()` gate).
- Broad authoritative server host startup before first render (`startAuthoritativeServerHostAssembly(...)` as full host startup).
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
