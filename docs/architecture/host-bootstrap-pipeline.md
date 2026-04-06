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

- `boot`: validated host boot configuration from `application/common/HostCompositionContracts.ts`
- `deploymentProfile`: profile id, environment name, release channel, region, metadata
- `environment`: normalized environment map for startup decisions
- `enabledCapabilities`: host-scoped capability set for startup gating
- `hostConfiguration`: host-specific configuration payload (for example server host options)
- `lifecycleHooks`: optional stage and pipeline lifecycle hooks
- artifact helpers (`setArtifact`, `getArtifact`, `listArtifactKeys`) for stage handoff

### Unified bootstrap pipeline stages

Canonical stage ids are fixed and shared across hosts:

1. `configuration`
2. `dependencies`
3. `logging`
4. `security`
5. `persistence`
6. `feature-registration`

The framework composes those stages through `composeHostBootstrapPipeline(...)` and executes them through `executeHostBootstrapPipeline(...)` with deterministic stage history (`sequence`, `stageId`, `status`, timestamps).

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

## Contributor startup-sequence guidance

When extending host startup:

1. Add reusable behavior to canonical stage handlers first.
2. Use host-specific stages only for runtime-specific wiring.
3. Pass cross-stage results through startup-context artifacts; do not leak global mutable state.
4. Keep domain/application business rules in inner layers; startup stages should only orchestrate composition and adapter initialization.
5. Add/adjust tests that assert stage order and customization behavior.

## Tests

- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/web/tests/WebHostCompositionRoot.test.ts`
- `src/hosts/worker/tests/WorkerHostCompositionRoot.test.ts`
