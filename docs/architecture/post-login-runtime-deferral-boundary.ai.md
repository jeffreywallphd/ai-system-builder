# AI Companion: Desktop Post-Login Runtime Deferral Boundary

Feature: C  
Epic: C.1  
Story: C.1.1

## Purpose

Define the implementation boundary for desktop startup deferral so follow-on Feature C stories can execute without re-deciding scope.

This note is additive to Feature A/B startup decisions.

## Carry-forward constraints from Feature A/B

Keep these fixed:

- pre-login startup remains auth-shell only (`bootstrapAuthShell`, `registerAuthIpc`, `createMainWindow`)
- pre-login identity surface remains auth-minimal host startup
- post-login warmup starts from renderer auth-success trigger paths
- preload deferred feature APIs remain guarded until deferred runtime readiness is true

## Startup category contract

### Pre-login auth-shell startup

Allowed before login render:

- auth-shell-pre-login storage initialization
- auth-minimal identity host startup and `identityApiBaseUrl` bootstrap
- trusted-device transport bootstrap projection
- auth/bootstrap IPC surface only (bootstrap/storage/secrets/connectivity/readiness/warmup trigger)
- first main window creation and renderer load

Forbidden pre-login:

- Python runtime resolution
- service supervisor startup
- non-auth feature IPC registration
- eager workflow/studio/system/registry/agent runtime graph creation

### Post-login immediate warmup

Allowed after authentication:

- full-runtime storage provisioning
- Python runtime resolution
- `DesktopServiceSupervisor` startup
- runtime config upgrade to full desktop runtime values
- registration of deferred feature IPC channel groups

Failure posture:

- warmup failure is terminal for desktop runtime startup
- deferred preload feature APIs remain unavailable until warmup/registration completes

### On-demand feature startup

Initialize only on first feature use:

- workflow persistence runtime (`ensureWorkflowPersistence`)
- execution history runtime (`ensureExecutionHistory`)
- workflow-run history runtime (`ensureWorkflowRunHistory`)
- studio shell/system studio/system runtime backends and image persistence adapters
- canonical registry runtime dynamic-import graph (`ensureCanonicalRegistryRuntime`)
- agent runtime/repositories (`ensureAgentStudioBackendApi`)

Failure posture:

- fail only requested feature flow with explicit errors
- do not regress login/auth shell startup behavior

## Legacy eager mapping from `bootstrapDesktopRuntime()`

The legacy eager startup responsibilities map to this contract as follows:

| Responsibility | Current anchor | Category | Target direction |
| --- | --- | --- | --- |
| Python runtime resolution | `bootstrapPostLoginRuntime` | Post-login warmup | Keep post-login |
| Service supervisor startup | `bootstrapPostLoginRuntime` | Post-login warmup | Keep post-login |
| Connectivity monitoring | `bootstrapAuthShell` | Pre-login auth-shell | Keep pre-login for auth/offline diagnostics |
| Workflow persistence + execution history + workflow-run history infra | `DeferredDesktopFeatureRuntime` ensure methods | On-demand | Keep lazy |
| Studio shell/system runtime/image persistence infra | `DeferredDesktopFeatureRuntime` ensure methods | On-demand | Keep lazy |
| Model file operations | IPC registration in `bootstrapPostLoginRuntime` | Post-login now; on-demand target | Move to feature activation boundary |
| Feature IPC registration | `registerDeferredFeatureIpc(...)` | Post-login now; split target | Segment into core warmup IPC + on-demand feature IPC groups |
| Canonical registry runtime | `ensureCanonicalRegistryRuntime` | On-demand | Keep lazy |
| Agent runtime | `ensureAgentStudioBackendApi` | On-demand | Keep lazy |

## Follow-on story implementation target

For Feature C implementation stories:

- post-login warmup should only prepare shared runtime prerequisites
- feature-specific infrastructure should stay first-use lazy
- non-auth IPC should be split into smaller activation groups so registration does not become a monolith

Suggested activation groups:

- workflows/execution/workflow-runs
- studio shell/system runtime/image persistence
- model files
- canonical assets/registry
- agents

## Observability/validation continuity

Keep these protections:

- phased startup logging (`desktop-startup.*` pre-login and post-login identifiers)
- preload deferred-API explicit unavailable behavior until readiness
- startup contract checks that enforce pre-login scope and sequence ordering

## Fixed decisions for Epic C.1

This note fixes the boundary so follow-on stories do not re-open scope:

- pre-login remains auth-shell only
- Python runtime + supervisor are post-login only
- workflow/studio/system/image/registry/agent runtime is on-demand
- model file operations and broad feature IPC registration are explicit on-demand split targets
