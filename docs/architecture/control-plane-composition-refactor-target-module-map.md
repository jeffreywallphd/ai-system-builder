# Control Plane Composition Module Map and Extension Guide

Feature: 2  
Epic: 2.4  
Story: 2.4.3

## Purpose

Document the final implemented authoritative control-plane composition model on `dev` so contributors can safely extend startup and module composition without reintroducing a monolithic host structure.

## Scope

This guide covers:

- authoritative server composition contracts and module map in `src/hosts/server/composition/contracts/`
- staged startup orchestration in `src/hosts/server/AuthoritativeServerBootstrapOrchestrator.ts`
- runtime composition modules in `src/hosts/server/composition/`
- host entrypoint and orchestration boundary in `src/hosts/server/AuthoritativeServerCompositionRoot.ts`

Out of scope:

- route handler/business logic internals in domain/application layers
- historical migration narratives already captured in baselines

## Final Implemented Composition Model (Dev Branch)

The implemented control-plane composition model is contract-first and bounded by explicit module seams.

### Contract and orchestration anchors

- Module contracts and IDs: `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleContracts.ts`
- Module dependency and stage ownership map: `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleMap.ts`
- Startup state/readiness model: `src/hosts/server/composition/contracts/AuthoritativeServerBootstrapPipelineStateModel.ts`
- Startup stage execution orchestrator: `src/hosts/server/AuthoritativeServerBootstrapOrchestrator.ts`
- Host composition root (orchestration boundary): `src/hosts/server/AuthoritativeServerCompositionRoot.ts`

### Implemented bounded modules

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

### Runtime module extraction surfaces used by `IdentityServerHost.ts`

- `ServerIdentitySessionTrustedDeviceCompositionModule.ts`
- `ServerWorkspaceAuthorizationCompositionModule.ts`
- `ServerDeploymentPolicyCompositionModule.ts`
- `ServerSecretCompositionModule.ts`
- `ServerCertificateCompositionModule.ts`
- `ServerNodeTrustCompositionModule.ts`
- `ServerTlsMaterialCompositionModule.ts`
- `ServerStorageAssetCompositionModule.ts`
- `ServerImageMediaCompositionModule.ts`
- `ServerGeneratedResultCompositionModule.ts`
- `ServerAuditDiagnosticsPlatformCompositionModule.ts`
- `ServerExecutionNodeManagementCompositionModule.ts`
- `ServerRunSchedulingCompositionModule.ts`
- `ServerRunOrchestrationCompositionModule.ts`
- `ServerOrchestrationRecoveryCompositionModule.ts`

## Bootstrap Stages, Readiness, and Lifecycle Rules

### Shared host bootstrap stage order (authoritative)

1. `configuration`
2. `dependencies`
3. `logging`
4. `security`
5. `persistence`
6. `feature-registration`

### Authoritative staged startup state model order (authoritative)

1. `configuration-load`
2. `security-material-resolution`
3. `persistence-initialization`
4. `migration-execution`
5. `subsystem-composition`
6. `readiness-verification`
7. `transport-startup`
8. `shutdown-preparation`

### Startup and shutdown invariants

- Startup can only transition to ready transport after `readiness-verification` succeeds for blocking checks.
- Degraded non-blocking checks are surfaced explicitly in startup readiness reports.
- Shutdown cleanup order is explicit and deterministic via `AuthoritativeServerRuntimeDisposalModuleOrder`:
  1. `transport`
  2. `persistenceBootstrap`
- Startup-failure cleanup and normal shutdown consume the same composed disposal-plan semantics.

## Composition Dependency Rules (Story 2.1.4)

### Allowed dependencies for composition modules

- Composition modules may depend only on explicit upstream outputs and shared startup/lifecycle contracts declared by `AuthoritativeServerCompositionModuleMap`.
- Composition modules may compose infrastructure adapters and application services through typed contracts.
- Cross-cutting startup diagnostics can be consumed through `ServerDiagnosticsCompositionModule` outputs.

### Disallowed dependencies for composition modules

- Composition modules must not absorb business logic.
- Composition modules must not absorb route logic.
- Composition modules must not become ad hoc helper buckets.
- Composition modules must not bypass typed contracts through hidden module internals or process-global state.
- Top-level host startup files must not re-inline extracted module responsibilities.

### Explicit allowed module dependency map

Allowed `dependsOn` relationships are:

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

New cross-module dependencies are disallowed unless `AuthoritativeServerCompositionModuleMap`, contracts, tests, and this doc are updated together.

## Naming And Placement Conventions (Story 2.1.4)

- Module implementations belong in `src/hosts/server/composition/`.
- Module contracts belong in `src/hosts/server/composition/contracts/`.
- Module names use `Server<Capability>CompositionModule`.
- Module contract names use `Server<Capability>CompositionModuleContract`.
- Typed artifacts must use explicit `*CompositionModuleInput` and `*CompositionModuleOutput` names.
- Module-specific helper code stays colocated with one module responsibility.

## Contributor Extension Workflow

When adding new control-plane composition behavior:

1. Decide whether behavior belongs in an existing module or a new `Server<Capability>CompositionModule`.
2. Add or update typed contract surfaces in `AuthoritativeServerCompositionModuleContracts.ts`.
3. Add or update module descriptors/dependencies/stage ownership in `AuthoritativeServerCompositionModuleMap.ts`.
4. Wire composition in `AuthoritativeServerBootstrapOrchestrator.ts` (or module implementation files) without changing domain/application ownership boundaries.
5. Keep `AuthoritativeServerCompositionRoot.ts` orchestration-only.
6. Update tests:
   - `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts`
   - affected module tests in `src/hosts/server/tests/`
   - `dev/tests/ControlPlaneCompositionDependencyGuardrails.test.ts` when documentation contracts change
7. Update this guide and `src/hosts/server/composition/README.md` in the same change.

## Re-Centralization Prevention Checklist

- Keep `AuthoritativeServerCompositionRoot.ts` orchestration-only.
- Prevent `IdentityServerHost.ts` from accumulating cross-domain startup composition that belongs in bounded modules.
- Require every new module to declare stage ownership, produced artifacts, disposal responsibilities, and dependencies in `AuthoritativeServerCompositionModuleMap`.
- Reject changes that bypass contract types for convenience wiring.
- Keep startup and lifecycle behavior validated by contract-level tests before merge.

## Related Files

- `src/hosts/server/composition/README.md`
- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/host-bootstrap-pipeline.md`
- `docs/architecture/host-service-registration-composition-rules.md`

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
