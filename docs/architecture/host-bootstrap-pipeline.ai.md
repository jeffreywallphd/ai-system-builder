# AI Companion: Host Bootstrap Pipeline and Startup Context

## Purpose
- Introduce one shared host bootstrap pipeline for server, desktop, hybrid, web, and worker runtimes.
- Make initialization order explicit and testable.
- Keep host-specific startup extensions bounded without duplicating common startup wiring.

## New startup context model
- Implemented in `src/hosts/bootstrap/HostBootstrapPipeline.ts`.
- `HostStartupContext` carries:
  - validated host boot config
  - deployment profile metadata
  - environment map
  - enabled host capabilities
  - host-specific configuration payload
  - lifecycle hooks
  - stage artifact handoff helpers (`setArtifact` / `getArtifact`)

## Unified bootstrap stage contract
- Canonical stage order is fixed:
  1. `configuration`
  2. `dependencies`
  3. `logging`
  4. `security`
  5. `persistence`
  6. `feature-registration`
- Stage composition: `composeHostBootstrapPipeline(...)`
- Stage execution: `executeHostBootstrapPipeline(...)`
- Execution history is deterministic (`sequence`, stage id, status, timestamps).

## Host customization boundary
- Hosts extend startup by:
  - overriding canonical stage handlers, and/or
  - inserting host-specific stages with `runAfterStageId`.
- Shared stage order remains authoritative while runtime-specific wiring stays host-local.

## Authoritative server adoption
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now composes startup through the shared pipeline.
- Startup context is built from boot + deployment profile + environment.
- Bootstrap `dependencies` now composes host-aware service registration plans and `feature-registration` enforces authoritative service coverage before runtime host start.
- Identity server runtime start happens in `feature-registration` stage.
- Existing lifecycle transition semantics are preserved (`composing -> starting -> ready -> stopping -> stopped`) with fail-safe failure transition handling.

## Desktop host adoption
- `src/hosts/desktop/DesktopHostCompositionRoot.ts` now composes startup through the shared pipeline.
- Startup context is built from boot + deployment profile + environment.
- Bootstrap `dependencies` now composes host-aware desktop service registration plans and `feature-registration` enforces desktop required-service coverage before runtime host start.
- Desktop runtime start/stop is delegated through host-owned adapter callbacks while preserving lifecycle transition semantics (`composing -> starting -> ready -> stopping -> stopped`).

## Hybrid host adoption
- `src/hosts/hybrid/HybridHostCompositionRoot.ts` now composes startup through the shared pipeline.
- Startup context is built from boot + deployment profile + environment.
- Bootstrap `dependencies` now composes host-aware hybrid service registration plans and `feature-registration` enforces hybrid required-service coverage before runtime host start.
- Hybrid startup enforces explicit capability composition rules for desktop-facing and node/runtime capabilities while keeping control-plane authority delegated to authoritative server host mode.
- Hybrid runtime start/stop is delegated through host-owned adapter callbacks while preserving lifecycle transition semantics (`composing -> starting -> ready -> stopping -> stopped`).

## Web host adoption
- `src/hosts/web/WebHostCompositionRoot.ts` now composes startup through the shared pipeline.
- Startup context is built from boot + deployment profile + environment.
- Bootstrap `dependencies` now composes host-aware web service registration plans and `feature-registration` enforces web required-service coverage before runtime host start.
- Web runtime start/stop is delegated through host-owned adapter callbacks while preserving lifecycle transition semantics (`composing -> starting -> ready -> stopping -> stopped`).

## Worker host adoption
- `src/hosts/worker/WorkerHostCompositionRoot.ts` now composes startup through the shared pipeline.
- Startup context is built from boot + deployment profile + environment.
- Bootstrap `dependencies` now composes host-aware worker service registration plans and `feature-registration` enforces worker required-service coverage before runtime host start.
- Worker startup enforces explicit `node-execution` + `worker-runtime` capability composition and carries node-registration capability context for runtime startup.
- Worker runtime start/stop is delegated through host-owned adapter callbacks while preserving lifecycle transition semantics (`composing -> starting -> ready -> stopping -> stopped`).

## Host lifecycle management and shutdown coordination (story 12.3.1)
- Added `src/hosts/lifecycle/HostLifecycleCoordinator.ts` as a shared lifecycle management seam for all host composition roots.
- Shared lifecycle behavior now includes:
  - explicit startup transition and startup-completed signaling
  - readiness marker capture at startup completion
  - consistent shutdown-requested/shutdown-completed lifecycle events
  - sequential cleanup hook execution with cleanup success/failure event recording
  - startup-failure cleanup coordination and deterministic failure transition/error propagation
- Server, desktop, hybrid, web, and worker composition roots now consume this coordinator rather than implementing host-local lifecycle transition logic independently.

## Contributor guidance
- Put reusable setup in canonical stages.
- Keep host-specific startup in host customization stages.
- Use startup-context artifacts for stage handoff.
- Do not move domain/application business logic into host startup code.
- Keep stage-order tests and customization tests updated with changes.

## Test coverage
- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/hosts/lifecycle/tests/HostLifecycleCoordinator.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/web/tests/WebHostCompositionRoot.test.ts`
- `src/hosts/worker/tests/WorkerHostCompositionRoot.test.ts`
