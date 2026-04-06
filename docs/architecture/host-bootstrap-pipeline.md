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
