# Desktop Post-Login Runtime Deferral Boundary

Feature: C  
Epic: C.1  
Story: C.1.1

## Purpose

Define a stable implementation contract for what is allowed on the desktop pre-login critical path, what must start immediately after successful authentication, and what must remain on-demand.

This note extends the Feature A/B auth-first split and removes the need for follow-on stories to re-decide startup scope.

## Baseline constraints carried from Feature A and Feature B

The following are already established and remain mandatory:

- Pre-login startup is auth-first and must stay bounded to `bootstrapAuthShell()` + `registerAuthIpc()` + `createMainWindow()`.
- Pre-login server scope is the auth-minimal identity host (`startAuthMinimalServerHostAssembly(...)`), not broad authoritative host startup.
- Post-login warmup begins only after renderer authentication success paths request warmup (`startPostLoginWarmup`).
- Deferred feature preload APIs are guarded; when runtime is not ready, preload returns explicit unavailable behavior rather than silently constructing feature infrastructure.

## Startup category contract

### 1) Pre-login auth-shell startup (critical path)

Must complete before first login-capable render:

- pre-login storage provisioning scope (`auth-shell-pre-login`)
- auth-minimal identity host startup and `identityApiBaseUrl` derivation
- auth/bootstrap context projection for preload (`DesktopAuthBootstrapContext`)
- trusted-device transport bootstrap projection
- auth/bootstrap IPC registration only (bootstrap, storage, secrets, connectivity state, deferred readiness probe, post-login warmup trigger)
- main window creation and renderer load

Forbidden in this category:

- Python runtime resolution
- desktop service supervisor startup
- feature IPC registration for workflows/runs/studio/system/model files/registry/agents/canonical assets
- eager composition of workflow, studio shell, system runtime, or registry feature infrastructure

### 2) Post-login immediate warmup (after authentication)

Starts after successful authentication and may run while authenticated UI is already visible.

Allowed responsibilities:

- full storage provisioning scope (`full-runtime`)
- Python runtime resolution
- desktop service supervisor startup
- runtime config upgrade from auth-shell projection to full desktop runtime values
- registration of deferred feature IPC channels that remain process-lifetime bindings

Failure behavior for this category:

- warmup failures are terminal to desktop runtime startup (main process logs and exits after disposal)
- until warmup completes, deferred preload surfaces remain unavailable by contract

### 3) On-demand feature startup (first feature use)

Must be initialized lazily at first actual use of the feature surface, not as part of warmup.

Allowed responsibilities:

- workflow persistence object creation (`ensureWorkflowPersistence`)
- execution history infrastructure (`ensureExecutionHistory`)
- workflow-run history infrastructure (`ensureWorkflowRunHistory`)
- studio shell/system studio/system runtime backend graph creation (`ensureStudioShellBackendApi`, `ensureSystemStudioBackendApi`, `ensureSystemRuntimeBackendApi`)
- image workflow/system persistence adapters used by studio/system paths
- canonical registry runtime assembly (`CanonicalRegistryRuntimeProvider.ensureCanonicalRegistryRuntime` dynamic imports and graph)
- agent runtime and agent repositories (`DesktopAgentRuntimeProvider.ensureAgentStudioBackendApi`)

Failure behavior for this category:

- fail only the requested feature path with explicit error payloads/unavailable state
- do not retroactively block pre-login or authenticated shell startup once warmup succeeded

## Legacy `bootstrapDesktopRuntime()` responsibility mapping

`bootstrapDesktopRuntime()` was the previous eager startup gate reviewed in `docs/startup-memory-review.md`. The same responsibilities now map to this boundary contract as follows.

| Responsibility (legacy eager set) | Current implementation anchor | Boundary category | Story C target state |
| --- | --- | --- | --- |
| Python runtime resolution | `bootstrapPostLoginRuntime()` -> `resolveDesktopPythonRuntime(...)` | Post-login immediate warmup | Keep post-login; do not move to pre-login |
| Service supervisor startup | `bootstrapPostLoginRuntime()` -> `DesktopServiceSupervisor.start()` | Post-login immediate warmup | Keep post-login; do not move to pre-login |
| Connectivity monitoring | `bootstrapAuthShell()` -> `DesktopConnectivityStateService.startMonitoring(...)` | Pre-login auth-shell startup | Keep pre-login for auth/offline UX continuity |
| Workflow persistence infrastructure | `createDeferredDesktopFeatureRuntime()` + `ensureWorkflowPersistence()` | On-demand feature startup | Keep lazy; avoid eager warmup construction |
| Execution history infrastructure | `createDeferredDesktopFeatureRuntime()` + `ensureExecutionHistory()` | On-demand feature startup | Keep lazy; avoid eager warmup construction |
| Workflow-run history infrastructure | `createDeferredDesktopFeatureRuntime()` + `ensureWorkflowRunHistory()` | On-demand feature startup | Keep lazy; avoid eager warmup construction |
| Studio shell/system runtime/image persistence infrastructure | `DeferredDesktopFeatureRuntime` ensure APIs | On-demand feature startup | Keep lazy; avoid eager warmup construction |
| Model file operations | IPC handlers currently bound in `bootstrapPostLoginRuntime()` | Post-login immediate warmup now; on-demand feature startup target | Move handler registration behind dedicated model-files activation trigger |
| Feature IPC registration (non-auth) | `registerDeferredFeatureIpc(...)` inside `bootstrapPostLoginRuntime()` | Post-login immediate warmup now; mixed long-term | Split into: post-login core IPC group vs per-feature on-demand registration groups |
| Canonical registry runtime | `CanonicalRegistryRuntimeProvider.ensureCanonicalRegistryRuntime(...)` | On-demand feature startup | Keep lazy; preserve dynamic import posture |
| Agent runtime and repos | `DesktopAgentRuntimeProvider.ensureAgentStudioBackendApi(...)` | On-demand feature startup | Keep lazy; preserve first-use initialization |

## Post-login/on-demand split for follow-on implementation stories

The implementation target for Feature C follow-on work is:

- Post-login immediate warmup should initialize only shared runtime prerequisites needed before any deferred feature can run (storage full-runtime, Python runtime, supervisor, runtime-config upgrade, readiness plumbing).
- Feature-specific infrastructure should initialize only when its IPC surface is first invoked.
- Feature IPC registration should be segmented so registration itself does not force unrelated runtime graph creation.

Minimum segmentation target:

- warmup/core deferred registration group: readiness probe, warmup state, feature activation router
- on-demand activation groups:
  - workflows/execution history/workflow-run history
  - studio shell/system runtime/image persistence
  - model files
  - canonical registry/canonical assets
  - agents

## Story C.2.1 implementation checkpoint

`electron/main/main.ts` now encodes the split above with explicit composition seams:

- `composePostLoginRuntime(...)` for post-login shared warmup prerequisites.
- `createOnDemandFeatureCompositionPaths(...)` for first-use feature runtime composition consumed by deferred IPC handlers.

This keeps pre-login bootstrap unchanged, keeps post-login warmup focused on shared runtime prerequisites, and makes on-demand feature composition paths explicit in main-process code.

## Observability and validation contract

Boundary compliance must remain observable and testable:

- pre-login logs continue to use `desktop-startup.pre-login-auth-shell-bootstrap`, `desktop-startup.identity-auth-host-readiness`, and `desktop-startup.main-window-creation`
- post-login warmup logs continue to use `desktop-startup.post-login-warmup` and `desktop-startup.deferred-feature-registration`
- preload deferred guards continue returning explicit unavailable errors until deferred feature runtime readiness is true
- startup contract tests continue asserting main-window creation precedes service-supervisor startup and pre-login initializer scope excludes workflow/studio/system runtime

## Implementation decisions fixed by this note

This story fixes these decisions for Epic C.1:

- pre-login remains auth-shell only; no runtime/service/feature expansion is permitted
- Python runtime and supervisor are post-login only
- workflow persistence, execution history, studio shell/system runtime/image persistence, canonical registry runtime, and agent runtime are on-demand
- model file operations and broad feature IPC registration are no longer assumed to be blanket post-login eager; they are explicit candidates for on-demand activation in Feature C follow-on stories

These decisions are now the default architecture contract for startup deferral work.
