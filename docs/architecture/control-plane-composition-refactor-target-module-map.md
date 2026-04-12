# Control Plane Composition Refactor Target Module Map

Feature: 2  
Epic: 2.1  
Story: 2.1.1

## Purpose

Define the current authoritative server composition state on `dev` and the target bounded module map for Feature 2 so later refactoring stories can move implementation safely without changing production behavior.

## Scope And Non-Goals

- In scope: authoritative server host composition (`src/hosts/server/AuthoritativeServerCompositionRoot.ts`, `src/hosts/server/IdentityServerHost.ts`), staged bootstrap sequencing, host-level dependency contracts, and migration seams.
- In scope: auth-minimal pre-login composition relationship (`src/hosts/server/AuthMinimalServerHostEntrypoint.ts`).
- Non-goal: introducing a second architecture or changing control-plane authority boundaries.
- Non-goal: behavior changes in startup, transport, persistence, policy enforcement, or orchestration.

## Current-State Audit (Dev Branch)

### Top-Level Host Composition Reality

`createAuthoritativeServerCompositionRoot(...)` currently owns both orchestration and substantial startup composition detail:

- Startup stage orchestration, lifecycle transitions, and cleanup orchestration.
- Host bootstrap stage handlers across `configuration`, `dependencies`, `security`, `persistence`, and `feature-registration`.
- Service-plan composition and route-plan composition.
- Persistence runtime creation, migration start, and persistent platform service composition.
- Deployment policy bootstrap resolution and startup artifact wiring.
- Optional ComfyUI/run-execution adapter composition gating.
- Startup diagnostics summary, span aggregation, correlation propagation, and baseline regression warning emission.

The file is currently high-complexity (`~838` lines) even after initial stage extraction.

### Runtime Host Composition Reality

`startIdentityServerHost(...)` currently remains a broad composition surface (`~2368` lines) with many inlined responsibilities:

- Configuration and bootstrap loading (`config-load`, identity provider policy, startup identity defaults).
- Security and trust bootstrap (secret service composition, CA readiness checks, managed TLS material resolution, transport trust wiring).
- Persistence adapter materialization across identity, workspace, authorization, node trust, certificate, storage, asset, image-asset, generated-result, and orchestration repositories.
- Policy and authorization composition (decision evaluators, mutation services, deployment policy read/write APIs).
- Orchestration composition and startup recovery (`orchestration-recovery`) plus audit-ledger startup reconciliation.
- Asset/media/computed-result composition (storage adapters, encryption policy/key services, preview pipelines).
- Node/runtime management composition (node trust APIs, execution node management APIs, run execution update APIs).
- Observability and diagnostic logger adaptation across secrets, orchestration, deployment policy, audit ledger, encryption, image assets.
- Transport assembly and server startup (`server-start`) through `createIdentityHttpServer(...)`.

### Existing Positive Seams

The following seams already exist and should be preserved and expanded instead of bypassed:

- Shared host pipeline and lifecycle contracts (`src/hosts/bootstrap/HostBootstrapPipeline.ts`, `src/hosts/lifecycle/HostLifecycleCoordinator.ts`).
- Typed authoritative stage contracts (`src/hosts/server/AuthoritativeServerBootstrapStageContracts.ts`).
- Dedicated config/security stage modules (`AuthoritativeServerConfigBootstrapStage.ts`, `AuthoritativeServerSecurityBootstrapStage.ts`).
- Stage-order enforcement and status reporting (`AuthoritativeServerBootstrapStageOrchestrator.ts`).
- Route-family plan composition seams (`AuthoritativeServerApiRouteComposition.ts`, `AuthMinimalServerApiRouteComposition.ts`).
- Auth-minimal startup specialization through composition overrides (not a separate authority model).

## Target Composition Module Map (Feature 2)

### Host Root Responsibilities To Keep

The top-level host composition root should retain only:

- Host lifecycle and startup phase transitions.
- Shared bootstrap pipeline wiring and authoritative stage orchestration.
- Artifact handoff boundaries between modules.
- Startup coverage assertions (service coverage, route-family coverage, required stage artifacts).
- Startup diagnostics summary emission and failure-safe cleanup orchestration.

### Composition Modules To Create/Strengthen

1. `ServerStartupConfigurationCompositionModule`
- Owns deployment profile/environment/capability resolution and startup tracer/runtime metadata setup.
- Produces: deployment profile, normalized environment, capabilities, runtime metadata, tracer.

2. `ServerSecurityBootstrapCompositionModule`
- Owns secret-service bootstrap, secret safety assertions, CA startup validation, managed TLS material resolution policy, and transport trust baseline setup inputs.
- Produces: security bootstrap state and security runtime dependencies consumed later by transport/runtime modules.

3. `ServerPersistenceBootstrapCompositionModule`
- Owns persistence runtime setup, migrations, persistent-platform-service composition, and disposal contracts.
- Produces: persistence runtime handle + persistent platform services.

4. `ServerPolicyBootstrapCompositionModule`
- Owns deployment policy bootstrap resolution and policy context resolver composition.
- Produces: deployment policy bootstrap bundle used by workspace/run/deployment APIs.

5. `ServerServicePlanCompositionModule`
- Owns host service registration plan composition/validation and capability-gated service-map construction.
- Produces: authoritative service registration plan.

6. `ServerRoutePlanCompositionModule`
- Owns authoritative/auth-minimal route-family registration plan composition and coverage assertions.
- Produces: route registration plan.

7. `ServerExecutionAdapterCompositionModule`
- Owns optional ComfyUI execution infrastructure and run-execution adapter registration composition.
- Produces: run execution adapter bundle when enabled.

8. `ServerControlPlaneApiCompositionModule`
- Owns composition of identity/workspace/authorization/node/security/storage/asset/media/generated-result/run/deployment/audit APIs from provided dependencies.
- Produces: transport backend bundle (without starting HTTP server).

9. `ServerOrchestrationRecoveryCompositionModule`
- Owns run orchestration startup reconciliation and audit ledger startup reconciliation.
- Produces: startup recovery summary artifacts and observability events.

10. `ServerTransportCompositionModule`
- Owns `createIdentityHttpServer(...)` invocation, trust validators, secure transport policy application, server factory selection, and start/stop binding.
- Produces: started server runtime handle.

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
- Owns startup span naming consistency, operational logger adapters, startup summary payload shaping, baseline recording/regression checks, and correlation-id propagation.
- Produces: diagnostics hooks used by host root and modules.

## Dependency Contracts

Each module should expose a narrow input/output contract (port-style DTOs) with no hidden process-global coupling.

Required contract direction:

1. `StartupConfiguration` ->
2. `SecurityBootstrap` + `ServicePlan` + `RoutePlan` + `ExecutionAdapter` (gated) ->
3. `PersistenceBootstrap` ->
4. `PolicyBootstrap` ->
5. `ControlPlaneApiComposition` + `OrchestrationRecovery` ->
6. `TransportComposition`

Cross-cutting diagnostics should be injectable from `DiagnosticsComposition` into all modules, not reimplemented per module.

## Startup Stage Mapping And Ordering Constraints

Shared host bootstrap pipeline order remains authoritative and unchanged:

1. `configuration`
2. `dependencies`
3. `logging`
4. `security`
5. `persistence`
6. `feature-registration`

Authoritative staged decomposition order remains authoritative and unchanged:

1. `services`
2. `security`
3. `persistence`
4. `transport`

Constraint rules:

- No transport startup before: route plan coverage + service coverage + persistence + deployment policy bootstrap + security baseline success.
- No orchestration recovery after server listen: recovery remains pre-listen startup work.
- Auth-minimal mode must continue using the same host composition root with scoped module outputs (reduced route/service/persistence scope and execution adapters disabled).

## Risky Seams Requiring Explicit Migration Guardrails

1. TLS material resolution seam
- Risk: fallback/partial material can start server in unintended transport posture.
- Guardrail: explicit typed `TlsRuntimeMaterialResolutionResult` with policy outcome enum (`disabled`, `resolved`, `required-but-unavailable`) and fail-fast rules.

2. Secret bootstrap and fallback seam
- Risk: permissive fallback can silently degrade secret protections.
- Guardrail: explicit secret bootstrap outcome contract and startup policy checks before dependent module composition.

3. Orchestration recovery seam
- Risk: moving recovery later/earlier can change run-state behavior or duplicate recovery.
- Guardrail: dedicated pre-listen module with idempotence contract and startup artifact assertions.

4. Diagnostics wiring seam
- Risk: regression in startup observability/correlation can reduce incident triage quality.
- Guardrail: centralized diagnostics module with contract tests for summary event shape and correlation propagation.

## Safe Migration Order (Behavior-Preserving)

1. Extract module contracts only
- Introduce typed input/output contracts and adapters around existing logic without moving behavior.

2. Extract diagnostics composition module
- Move logger adapters + summary/baseline logic first; validate startup summary parity.

3. Extract transport composition module
- Move `createIdentityHttpServer(...)` assembly and start/stop handling behind module contract.

4. Extract orchestration recovery module
- Isolate run/audit startup reconciliation with unchanged invocation timing.

5. Extract control-plane API composition module
- Move backend API assembly blocks from `startIdentityServerHost(...)` into module factories by domain cluster.

6. Extract policy, persistence, and security modules
- Move bootstrap internals behind contracts while preserving existing stage order and artifacts.

7. Reduce top-level host root to orchestration-only
- Keep lifecycle + stage ordering + assertions + cleanup only.

8. Enforce parity guardrails
- Keep existing startup harness and host composition tests green; add module-level contract tests as extraction lands.

## Cross-Cutting Concerns That Must Not Stay Buried In Top-Level Host

- Security bootstrap posture and TLS policy outcomes.
- Deployment policy bootstrap readiness contract.
- Orchestration/audit startup recovery outcomes.
- Startup diagnostics/summary/correlation/baseline regression policy.
- Service and route coverage enforcement contracts.

These concerns stay explicit as module outputs/validators and are consumed by the host root, not hidden in ad hoc inline code.

## Migration Completion Signals For Follow-On Stories

- `AuthoritativeServerCompositionRoot.ts` becomes orchestration-focused and materially smaller.
- `IdentityServerHost.ts` composition logic is segmented into bounded composition modules.
- Auth-minimal startup remains a constrained variant of the same authoritative composition architecture.
- Startup and runtime behavior parity is demonstrated by existing and new composition contract tests.

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
