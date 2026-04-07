# AI Companion: Run Orchestration Execution Command Building and Adapter Dispatch Seams

## Story scope
Story 16.2.4 introduces canonical execution-command preparation and a backend adapter dispatch seam for assigned runs.

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
- Human doc: `docs/architecture/run-orchestration-execution-command-dispatch-seams.md`

## Core delivery
- Adds canonical execution command contracts in the application layer.
- Adds an application use case that builds canonical execution commands from authoritative assigned-run state + dispatch-attempt state.
- Adds an application dispatch use case that depends only on the execution dispatch port.
- Adds infrastructure backend adapters and router so backend translation stays outside application orchestration.

## Command building behavior
- Input: `runId` + optional `dispatchAttemptId`.
- Source data:
  - canonical run record + submission snapshot metadata,
  - queue entry,
  - durable dispatch attempt.
- Output: one `CanonicalRunExecutionCommand` including:
  - run identity/submission context,
  - queue + assignment claim data,
  - runtime target + parameters/tags/metadata,
  - storage/resource/policy references,
  - normalized backend kind.

## Safety/fail-closed behavior
Typed build errors now cover:
- run not found,
- invalid lifecycle state (must be `assigned`),
- missing assignment,
- missing queue entry,
- missing submission snapshot,
- dispatch attempt not found,
- assignment/dispatch-attempt node mismatch.

## Backend seam posture
- Application depends on `IRunExecutionDispatchPort`.
- Infrastructure implements per-backend adapters:
  - `local-worker`,
  - `remote-dispatch`,
  - `comfyui`.
- `RunExecutionDispatchRouter` routes by backend kind and rejects missing adapter registrations.
- Backend payload shapes stay infrastructure-only.

## Coverage added
- Application tests:
  - canonical command build success from assigned run state,
  - structured error on missing dispatch attempt,
  - dispatch use-case seam invocation behavior.
- Infrastructure contract tests:
  - local/remote/comfy adapter payload translation,
  - router backend routing and missing-adapter failure behavior.

