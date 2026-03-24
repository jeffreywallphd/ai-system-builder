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
- The UI composition is manual and still duplicates some infrastructure bootstrap logic, but execution-engine assembly, MCP server-operation handler registration, and runtime dependency orchestration now share clearer outer-layer helpers across renderer/bootstrap/registry paths, and durable execution history now includes a reusable detail surface instead of list-only projections.
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

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers have a stable contract without duplicating policy semantics.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2, inner foundation only) now includes an execution-oriented planning contract: `domain/agents/AgentPlan.ts` (dependency-aware plan/step model + validation), `application/agents/contracts/AgentPlanningStrategy.ts` (strategy contract/descriptor seam) plus `application/agents/services/DeterministicAgentPlanningStrategy.ts` (first deterministic strategy), and bounded planning-loop evaluation contracts in `application/agents/contracts/AgentPlanningLoop.ts` without adding a parallel runtime or UI loop.

## TODO
- If asked for the "single" architecture entry point, explain that there are currently multiple composition roots and name them explicitly.
