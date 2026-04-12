# AI Companion: Control Plane Composition Refactor Target Module Map

Feature: 2  
Epic: 2.1  
Story: 2.1.1

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
