# Run Orchestration Execution Command Building and Adapter Dispatch Seams

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.4: Implement execution command building and backend adapter dispatch seams

## Purpose

Define a canonical application-layer execution command and a replaceable dispatch adapter seam so authoritative orchestration can dispatch assigned runs without depending on backend-specific payload shapes.

## Implemented files

- `src/application/runs/ports/RunExecutionDispatchPorts.ts`
- `src/application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase.ts`
- `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`
- `src/application/runs/tests/BuildAssignedRunExecutionCommandUseCase.test.ts`
- `src/application/runs/tests/DispatchAssignedRunExecutionUseCase.test.ts`
- `src/infrastructure/execution/runs/RunExecutionDispatchRouter.ts`
- `src/infrastructure/execution/runs/LocalWorkerRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/runs/RemoteRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`
- `src/infrastructure/execution/tests/RunExecutionDispatchAdapters.contract.test.ts`

## Canonical execution command

`BuildAssignedRunExecutionCommandUseCase` transforms an assigned canonical run record into one canonical execution command by composing:

- authoritative run identity and submission metadata
- authoritative assignment and queue linkage
- validated submission snapshot inputs (`runtimeTarget`, `tags`, `parameters`, metadata)
- validated storage/resource/policy references
- durable dispatch-attempt reservation metadata (`attemptId`, `reservationOwner`, `claimToken`, `preparedAt`)

Command building is fail-closed with explicit typed errors for:

- missing run
- invalid lifecycle state (must be `assigned`)
- missing assignment metadata
- missing queue or submission-snapshot metadata
- missing dispatch attempt
- assignment/attempt node mismatch

## Dispatch seam design

Application contracts define one dispatch boundary:

- `IRunExecutionDispatchPort` for orchestration-owned dispatch
- `IRunExecutionBackendAdapter` for backend-specific infrastructure implementations

Canonical commands include a normalized backend kind:

- `local-worker`
- `remote-dispatch`
- `comfyui`

Application orchestration depends only on canonical command/receipt contracts. It does not depend on any backend payload DTO shape.

## Infrastructure adapter isolation

Backend payload translation is isolated in infrastructure adapters:

- `LocalWorkerRunExecutionDispatchAdapter`
- `RemoteRunExecutionDispatchAdapter`
- `ComfyUiRunExecutionDispatchAdapter`

`RunExecutionDispatchRouter` is an infrastructure dispatcher that routes by canonical backend kind and forwards canonical commands to one registered adapter implementation per backend.

Each adapter emits one canonical dispatch receipt while keeping backend request structures private to infrastructure.

## Extensibility posture

Adding a backend now requires:

1. implementing one `IRunExecutionBackendAdapter` in infrastructure
2. registering it with `RunExecutionDispatchRouter`
3. extending backend-kind resolution rules in command building when needed

No application-layer orchestration signatures need to change for additional backend payload formats.

## Test coverage highlights

- application tests validate canonical command construction from assigned run + dispatch attempt and typed failure behavior
- application tests validate dispatch use case calls through the adapter seam without backend payload coupling
- infrastructure contract tests validate adapter translation behavior for all supported backend kinds and router registration/routing behavior

