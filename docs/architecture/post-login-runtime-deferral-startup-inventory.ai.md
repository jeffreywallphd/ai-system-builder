# AI Companion: Desktop Startup Eager Service and Repository Inventory

Feature: C  
Epic: C.1  
Story: C.1.2

Primary reference: `docs/architecture/post-login-runtime-deferral-startup-inventory.md`

## Goal

Document concrete startup-time service/repository/backend initialization points and classify them into:

- must remain pre-login,
- start after login,
- lazy/on-demand,
- eliminate or simplify.

## Core implementation outcome

- Added a constructor/factory and call-site inventory covering `electron/main/main.ts` and `electron/main/DeferredDesktopFeatureRuntime.ts`.
- Included the requested runtime responsibilities:
  - `DesktopServiceSupervisor`
  - workflow persistence
  - execution run repositories
  - workflow run summary repositories
  - `StudioShellBackendApi`
  - `SystemStudioBackendApi`
  - `SystemRuntimeBackendApi`
  - image persistence adapters
  - connectivity monitoring
  - canonical registry runtime
  - agent runtime
- Captured dependency chains so follow-on stories can sequence runtime activation safely.
- Identified concrete simplify/eliminate candidates (monolithic deferred IPC registration and eager deferred-runtime container creation).

## Refactor sequencing anchors

- Group A: fixed pre-login auth-shell dependencies.
- Group B: post-login shared prerequisites only.
- Group C: studio/system/image dependency chain with workflow-run history kept independently lazy (shared by adapter).
- Group D: canonical registry and agent lazy runtimes with explicit dependency ordering.
