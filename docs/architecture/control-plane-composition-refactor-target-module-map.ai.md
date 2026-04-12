# AI Companion: Control Plane Composition Refactor Target Module Map

Feature: 2  
Epic: 2.1  
Story: 2.1.3

## Purpose

Capture the current authoritative server composition state on `dev` and define the target bounded composition module map for Feature 2 refactoring with behavior parity.

## Current Composition Audit (Dev)

### Current top-level host composition load

`src/hosts/server/AuthoritativeServerCompositionRoot.ts` currently combines host orchestration with significant startup composition detail:

- Shared bootstrap stage handler composition.
- Service/route coverage plan composition.
- Persistence runtime and persistent-platform-service startup wiring.
- Deployment policy bootstrap resolution.
- Optional execution adapter composition.
- Startup diagnostics summary/correlation/baseline emission.

### Current runtime host composition load

`src/hosts/server/IdentityServerHost.ts` remains a broad inline composition boundary:

- Config/bootstrap resolution and identity startup defaults.
- Secret + CA + trust/TLS bootstrap logic.
- Persistence adapter materialization for multiple domains.
- Authorization/policy/deployment composition.
- Node management, storage/asset/media, and run orchestration composition.
- Orchestration + audit startup recovery.
- Observability logger adaptation.
- HTTP transport assembly/startup.

### Existing seams to preserve and expand

- `HostBootstrapPipeline` and `HostLifecycleCoordinator`.
- `AuthoritativeServerBootstrapStageContracts`.
- Config/security stage modules + orchestrator.
- Route plan composition seams for authoritative and auth-minimal startup.

## Target Module Map

Host root should retain only orchestration-level concerns:

- lifecycle/stage flow
- artifact handoff
- coverage assertions
- startup summary and cleanup coordination

Bounded composition modules:

1. `ServerStartupConfigurationCompositionModule`
2. `ServerSecurityBootstrapCompositionModule`
3. `ServerPersistenceBootstrapCompositionModule`
4. `ServerPolicyBootstrapCompositionModule`
5. `ServerServicePlanCompositionModule`
6. `ServerRoutePlanCompositionModule`
7. `ServerExecutionAdapterCompositionModule`
8. `ServerControlPlaneApiCompositionModule`
9. `ServerOrchestrationRecoveryCompositionModule`
10. `ServerTransportCompositionModule`
11. `ServerDiagnosticsCompositionModule`

## Story 2.1.2 Implementation Scaffold

Story 2.1.2 adds the initial bounded composition contract scaffold under:

- `src/hosts/server/composition/README.md`
- `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleContracts.ts`
- `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleMap.ts`
- `src/hosts/server/composition/contracts/index.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts`

This scaffold intentionally does not move runtime behavior yet. It introduces:

- explicit typed input/output contracts for all target modules;
- lifecycle/disposal contract hooks for composition modules;
- an ordered module map with dependency direction, stage ownership hints, produced artifacts, and disposal responsibilities;
- regression coverage to keep module-map shape and dependency ordering stable for follow-on extraction stories.

## Story 2.1.3 Staged Bootstrap Pipeline and Startup State Model

Story 2.1.3 adds an explicit staged bootstrap model and typed startup/readiness states for the authoritative control-plane startup boundary:

- `src/hosts/server/composition/contracts/AuthoritativeServerBootstrapPipelineStateModel.ts`
- `src/hosts/server/tests/AuthoritativeServerBootstrapPipelineStateModel.test.ts`

Canonical bootstrap stage order for control-plane startup:

1. `configuration-load`
2. `security-material-resolution`
3. `persistence-initialization`
4. `migration-execution`
5. `subsystem-composition`
6. `readiness-verification`
7. `transport-startup`
8. `shutdown-preparation`

State model coverage:

- stage execution state: `pending`, `running`, `success`, `failed`, `skipped`
- stage readiness state: `not-ready`, `ready`, `degraded`
- pipeline readiness derivation:
  - `ready` only when readiness verification and transport startup are successful
  - `degraded` when any stage fails
  - `not-ready` otherwise

Incremental-adoption safety:

- stage definitions are explicit and immutable;
- each stage declares module ownership and current host/authoritative stage bindings;
- `shutdown-preparation` is intentionally marked `planned`, allowing staged adoption without destabilizing current startup behavior.

## Dependency And Stage Contracts

Contract direction:

1. configuration ->
2. security + service/route plans + execution adapter registration ->
3. persistence ->
4. deployment policy bootstrap ->
5. control-plane API composition + startup recovery ->
6. transport start

Ordering constraints remain unchanged:

- Shared stages: `configuration -> dependencies -> logging -> security -> persistence -> feature-registration`
- Authoritative staged order: `services -> security -> persistence -> transport`
- Transport start requires coverage assertions and prerequisite artifacts.
- Orchestration recovery remains pre-listen.
- Auth-minimal remains same architecture with scoped outputs.

## Composition Dependency Rules (Story 2.1.4)

### Allowed dependencies for composition modules

- Compose infrastructure adapters and application services through explicit typed module contracts.
- Depend only on shared host startup/lifecycle contracts and declared prior module outputs in `AuthoritativeServerCompositionModuleMap`.
- Consume cross-cutting diagnostics through `ServerDiagnosticsCompositionModule`.

### Disallowed dependencies for composition modules

- Must not absorb business logic (keep policy/rules in domain/application).
- Must not absorb route logic (keep transport route handlers/DTO mapping in route-family modules).
- Must not become ad hoc helper buckets.
- Must not bypass typed contracts via process-global state or unrelated module internals.
- Must not re-inline extracted composition concerns into top-level host startup files.

### Explicit allowed module dependency map

1. `ServerStartupConfigurationCompositionModule` -> `[]`
2. `ServerSecurityBootstrapCompositionModule` -> `[ServerStartupConfigurationCompositionModule]`
3. `ServerPersistenceBootstrapCompositionModule` -> `[ServerStartupConfigurationCompositionModule, ServerSecurityBootstrapCompositionModule]`
4. `ServerPolicyBootstrapCompositionModule` -> `[ServerStartupConfigurationCompositionModule, ServerPersistenceBootstrapCompositionModule]`
5. `ServerServicePlanCompositionModule` -> `[ServerStartupConfigurationCompositionModule]`
6. `ServerRoutePlanCompositionModule` -> `[ServerStartupConfigurationCompositionModule]`
7. `ServerExecutionAdapterCompositionModule` -> `[ServerStartupConfigurationCompositionModule]`
8. `ServerControlPlaneApiCompositionModule` -> `[ServerStartupConfigurationCompositionModule, ServerSecurityBootstrapCompositionModule, ServerPersistenceBootstrapCompositionModule, ServerPolicyBootstrapCompositionModule, ServerServicePlanCompositionModule, ServerRoutePlanCompositionModule, ServerExecutionAdapterCompositionModule]`
9. `ServerOrchestrationRecoveryCompositionModule` -> `[ServerStartupConfigurationCompositionModule, ServerPolicyBootstrapCompositionModule]`
10. `ServerTransportCompositionModule` -> `[ServerControlPlaneApiCompositionModule, ServerOrchestrationRecoveryCompositionModule]`
11. `ServerDiagnosticsCompositionModule` -> `[ServerStartupConfigurationCompositionModule]`

New cross-module dependencies are disallowed unless the map, contracts, and composition contract tests are updated together.

## Naming And Placement Conventions (Story 2.1.4)

- Keep composition module implementations under `src/hosts/server/composition/` in module-oriented files/folders.
- Keep contracts in `src/hosts/server/composition/contracts/`.
- Use `Server<Capability>CompositionModule` and `Server<Capability>CompositionModuleContract` naming.
- Use explicit `*CompositionModuleInput` / `*CompositionModuleOutput` artifact names (avoid generic helper/context naming).
- Keep any helper code colocated with one module responsibility.

## Re-Centralization Prevention Checklist

- Keep `AuthoritativeServerCompositionRoot.ts` orchestration-only.
- Prevent `IdentityServerHost.ts` from becoming a second composition root after module extraction.
- Require new modules to declare stage ownership, produced artifacts, disposal responsibilities, and dependencies in module-map contracts.
- Require `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts` updates when module-map/dependency contracts change.

## High-Risk Seams

1. TLS runtime material resolution and fail-fast posture.
2. Secret bootstrap fallback semantics.
3. Orchestration recovery placement/idempotence.
4. Startup diagnostics and correlation wiring.

## Safe Migration Sequence

1. Extract contracts/adapters around existing logic.
2. Extract diagnostics composition.
3. Extract transport composition.
4. Extract orchestration recovery composition.
5. Extract control-plane API composition.
6. Extract policy/persistence/security composition.
7. Reduce host root to orchestration-only.
8. Keep parity via startup harness/composition tests.

## Cross-Cutting Concerns That Must Not Stay Buried

- TLS/transport trust posture outcomes.
- Secret bootstrap posture.
- Deployment policy readiness.
- Orchestration/audit recovery outcomes.
- Startup diagnostics/correlation/baseline policies.
- Service and route coverage assertions.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
