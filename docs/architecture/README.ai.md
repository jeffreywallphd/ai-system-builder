# AI Companion: Architecture Overview

## Purpose
Use this file as the shortest reliable orientation before reading the human architecture docs.

## What the system is
- AI Loom Studio is a desktop-first React + Electron product with a clean-architecture-inspired core.
- Main layers:
  - `domain/` = business entities and validation
  - `application/` = use cases, orchestration, ports, projections
  - `infrastructure/` = adapters, runtime integrations, repositories, execution strategies, DI
  - `ui/` + `electron/` = presentation and desktop host

## Most important composition roots
- Renderer/manual composition: `ui/composition/createUiDependencies.ts`
- Generic DI composition: `infrastructure/composition/ApplicationBootstrap.ts`
- Desktop host bootstrap: `electron/main/main.ts`
- Renderer provider bootstrapping: `ui/composition/AppProviders.tsx`

## Most important execution path
1. UI store/service calls application use case.
2. Use case validates/assembles context.
3. Executor selects a strategy.
4. Strategy delegates to Python runtime or interpreted fallback.
5. Result includes provenance describing what really happened.

## Architectural caveats to remember
- The architecture is clean-architecture-flavored, not strict/academic.
- The UI composition is manual and still duplicates some infrastructure bootstrap logic, although runtime dependency orchestration plus more of the execution-engine wiring are now shared across both composition roots.
- Browser fallback adapters still matter even though the product intent is desktop-first.
- Electron preload currently exposes synchronous IPC-based bridges.

## Best files to cite when answering architecture questions
- `domain/workflows/Workflow.ts`
- `domain/services/WorkflowValidator.ts`
- `application/workflows/ExecuteWorkflowUseCase.ts`
- `application/tools/RunToolUseCase.ts`
- `application/context/WorkflowContextService.ts`
- `infrastructure/execution/TruthfulWorkflowExecutor.ts`
- `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`
- `ui/composition/createUiDependencies.ts`
- `electron/main/main.ts`

## TODO
- If asked for the "single" architecture entry point, explain that there are currently multiple composition roots and name them explicitly.
