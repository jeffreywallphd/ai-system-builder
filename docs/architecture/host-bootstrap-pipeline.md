# Host Bootstrap Pipeline and Startup Context

This note documents the shared host bootstrap framework introduced for Story 12.1.2.

## Intent

- Provide one reusable startup pipeline for all host runtime kinds.
- Make startup stage order explicit, predictable, and testable.
- Keep shared bootstrapping separate from host-specific startup behavior.
- Preserve clean architecture boundaries by keeping business logic out of host boot files.

## Contracts and implementation

### Shared startup context model

`src/hosts/bootstrap/HostBootstrapPipeline.ts` now defines `HostStartupContext` with:

- `boot`: validated host boot configuration from `src/application/common/HostCompositionContracts.ts`
- `deploymentProfile`: profile id, environment name, release channel, region, metadata
- `environment`: normalized environment map for startup decisions
- `enabledCapabilities`: host-scoped capability set for startup gating
- `hostConfiguration`: host-specific configuration payload (for example server host options)
- `lifecycleHooks`: optional stage and pipeline lifecycle hooks
- artifact helpers (`setArtifact`, `getArtifact`, `listArtifactKeys`) for stage handoff

### Shared startup configuration resolution

`src/infrastructure/config/HostStartupConfiguration.ts` now centralizes deployment-profile-aware startup resolution and validation for all host composition roots:

- canonical deployment profile ids: `home`, `classroom`, `organization`
- shared environment keys:
  - `AI_LOOM_DEPLOYMENT_PROFILE`
  - `AI_LOOM_ENVIRONMENT_NAME`
  - `AI_LOOM_RELEASE_CHANNEL`
  - `AI_LOOM_DEPLOYMENT_REGION`
  - `AI_LOOM_ENABLED_CAPABILITIES`
- explicit normalization and validation for profile id, environment name, release channel, and enabled capabilities
- one resolver (`resolveHostStartupConfiguration(...)`) consumed by server, desktop, hybrid, web, and worker roots so profile/environment/capability decisions stay explicit and testable rather than scattered across host-specific environment checks

### Unified bootstrap pipeline stages

Canonical stage ids are fixed and shared across hosts:

1. `configuration`
2. `dependencies`
3. `logging`
4. `security`
5. `persistence`
6. `feature-registration`

The framework composes those stages through `composeHostBootstrapPipeline(...)` and executes them through `executeHostBootstrapPipeline(...)` with deterministic stage history (`sequence`, `stageId`, `status`, timestamps).

### Startup span tracer utility (story 1.1.1)

`src/hosts/bootstrap/startupTracer.ts` adds a reusable startup tracing utility for stage-level observability:

- nested startup spans with explicit parent/child hierarchy
- start/stop timing with structured duration metadata (`durationMs`, `startedAt`, `endedAt`)
- metadata capture and merge on span completion/failure
- failure tagging with structured error payloads
- sensitive-value protection through metadata/error redaction and pino redaction paths

The tracer emits structured events:

- `startup.span.completed`
- `startup.span.failed`

### Host-specific customization seam

Hosts can customize startup without duplicating shared stages by:

- overriding specific canonical stage handlers
- appending host-specific stages with `runAfterStageId`

This keeps the common startup sequence stable while preserving host-level extensibility.

## Authoritative server integration

`src/hosts/server/AuthoritativeServerCompositionRoot.ts` now uses the shared bootstrap pipeline:

- builds a startup context from boot configuration + deployment profile + environment
- composes canonical stages and optional host-specific customization stages
- starts the production identity server during `feature-registration`
- records host lifecycle transitions around pipeline execution (`composing -> starting -> ready`)
- preserves existing stop/failure semantics
- composes host-aware service registration plans during `dependencies` and validates authoritative control-plane service coverage before `feature-registration`

## Desktop host integration

`src/hosts/desktop/DesktopHostCompositionRoot.ts` now also uses the shared bootstrap pipeline:

- builds a startup context from desktop boot configuration + deployment profile + environment
- composes host-aware desktop service registration plans during `dependencies`
- validates required desktop service coverage before `feature-registration`
- starts and stops desktop runtime through host-owned adapter callbacks while preserving deterministic lifecycle transitions

## Hybrid host integration

`src/hosts/hybrid/HybridHostCompositionRoot.ts` now also uses the shared bootstrap pipeline:

- builds a startup context from hybrid boot configuration + deployment profile + environment
- composes host-aware hybrid service registration plans during `dependencies`
- validates required hybrid service coverage before `feature-registration`
- enforces explicit capability-composition rules for desktop-facing plus node/runtime capabilities
- rejects direct local authoritative ownership in hybrid composition root and keeps intentional authoritative execution delegated through authoritative server host assembly mode
- starts and stops hybrid runtime through host-owned adapter callbacks while preserving deterministic lifecycle transitions

## Web host integration

`src/hosts/web/WebHostCompositionRoot.ts` now also uses the shared bootstrap pipeline:

- builds a startup context from web boot configuration + deployment profile + environment
- composes host-aware web service registration plans during `dependencies`
- validates required web service coverage before `feature-registration`
- starts and stops thin-client web runtime composition through host-owned adapter callbacks while preserving deterministic lifecycle transitions

## Worker host integration

`src/hosts/worker/WorkerHostCompositionRoot.ts` now also uses the shared bootstrap pipeline:

- builds a startup context from worker boot configuration + deployment profile + environment
- composes host-aware worker service registration plans during `dependencies`
- validates required worker service coverage before `feature-registration`
- enforces explicit execution capability composition (`node-execution` + `worker-runtime`) before runtime startup
- starts and stops worker runtime execution through host-owned adapter callbacks while preserving deterministic lifecycle transitions

## Host lifecycle management and shutdown coordination (story 12.3.1)

`src/hosts/lifecycle/HostLifecycleCoordinator.ts` now centralizes lifecycle orchestration behavior used by server, desktop, hybrid, web, and worker composition roots:

- standardized startup transitions (`configured -> composing -> starting -> ready`) and explicit startup completion events
- readiness markers recorded when feature-registration startup completes
- consistent shutdown flow with explicit shutdown-requested/shutdown-completed events
- sequential cleanup hook execution with deterministic `cleanup-completed` / `cleanup-failed` event emission
- startup-failure cleanup hooks and consistent `failed` transition/error propagation semantics

All host composition roots now delegate lifecycle phase management, readiness signaling, shutdown coordination, and cleanup sequencing to this shared coordinator while keeping host-specific runtime startup logic local to each root.

## Contributor startup-sequence guidance

When extending host startup:

1. Add reusable behavior to canonical stage handlers first.
2. Use host-specific stages only for runtime-specific wiring.
3. Pass cross-stage results through startup-context artifacts; do not leak global mutable state.
4. Keep src/domain/application business rules in inner layers; startup stages should only orchestrate composition and adapter initialization.
5. Add/adjust tests that assert stage order and customization behavior.

## Tests

- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/hosts/bootstrap/tests/startupTracer.test.ts`
- `src/hosts/lifecycle/tests/HostLifecycleCoordinator.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/web/tests/WebHostCompositionRoot.test.ts`
- `src/hosts/worker/tests/WorkerHostCompositionRoot.test.ts`
- `src/infrastructure/config/tests/HostStartupConfiguration.test.ts`
