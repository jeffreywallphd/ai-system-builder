# AI Companion: Desktop Auth-First Startup Boundary

Feature: A  
Epic: A.1  
Story: A.1.2

## Purpose

Define the startup split so Electron can render the login-capable window from a minimal auth bootstrap path, then move broader runtime initialization behind login or lazy feature demand.

## Current implementation (A.1.2)

`electron/main/main.ts` now uses explicit startup phases:

- `bootstrapAuthShell()` runs storage + auth identity bootstrap + trusted-device bootstrap context.
- `registerAuthIpc()` binds auth/bootstrap IPC only.
- `createMainWindow()` runs immediately after auth-shell bootstrap.
- `bootstrapPostLoginRuntime()` runs after window creation to start service supervisor and compose broader runtime services.
- `registerDeferredFeatureIpc()` gates non-auth IPC registration so feature surfaces are clearly post-login/deferred.

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
- desktop storage bridge (`getItem/setItem/removeItem`) for `ai-loom.identity.session.v1`

Not required pre-login:

- bootstrap storage-path metadata
- service-supervisor details
- python runtime details
- workflow/studio/agent/model/registry runtime initialization

## Major work to move off critical path

- full desktop runtime bootstrap before window creation,
- broad authoritative host startup as a startup gate,
- bulk preload IPC registration unrelated to auth,
- repository/backend composition for workflow/studio/runtime features before login render.
