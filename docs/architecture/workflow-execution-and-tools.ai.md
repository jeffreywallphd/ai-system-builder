# AI Companion: Workflow Execution and Tools

## Core fact
Published tools are projected workflows, not a separate execution system.

## Main files
- Workflow execution orchestration: `application/workflows/ExecuteWorkflowUseCase.ts`
- Unified execution engine: `application/execution/UnifiedExecutionEngine.ts`
- Execution domain model: `domain/execution/ExecutionPlan.ts`
- Workflow execution unit adapter: `infrastructure/execution/WorkflowExecutionUnitHandler.ts`
- Tool run orchestration: `application/tools/RunToolUseCase.ts`
- Tool projection: `application/projection/WorkflowToolProjectionService.ts`
- Strategy selector/executor: `infrastructure/execution/TruthfulWorkflowExecutor.ts`
- Runtime selector: `application/execution/WorkflowRuntimeSelector.ts`
- Python strategy: `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- Fallback strategy: `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`
- Node execution adapter: `infrastructure/interpreted/execution/LangChainNodeExecutor.ts`

## Short execution narrative
Workflow -> `ExecuteWorkflowUseCase` -> one-unit `ExecutionPlan` -> `UnifiedExecutionEngine` -> `WorkflowExecutionUnitHandler` -> `TruthfulWorkflowExecutor` -> orchestration-aware strategy selection -> Python delegated or interpreted fallback -> provenance-rich result.

## Unified execution engine slice
- The current migration now covers the immediate workflow execution path and the direct tool execution path.
- The engine understands dependency-aware execution units and plan transitions, but only one real handler exists today: workflow execution.
- The workflow adapter wraps the existing workflow executor instead of rewriting runtime selection or strategy internals.

## Runtime orchestration update
- Delegated workflow execution selection can now consult the shared runtime dependency orchestrator before choosing a delegated strategy.
- When the delegated workflow runtime gate is unavailable, selection falls back to a compatible interpreted strategy instead of pretending delegated execution is still ready.
- Selection reasons now surface skipped delegated paths and orchestration detail so workflow provenance stays truthful about why fallback execution was chosen.
- The unified execution engine preserves delegated/scaffolded/hybrid/unavailable provenance instead of replacing it with generic plan state.

## What is not migrated yet
- Dataset generation, model creation/training, MCP orchestration, scheduling, and distributed execution are not part of this slice.
- `ExecuteWorkflowUseCase.startExecution(...)` is still backed by the existing workflow executor handle path.

## Important phrasing
Use "workflow-first", "tool projection", and "truthful execution provenance" when describing the product design.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
- If asked what should migrate next, answer: the plan-aware `startExecution(...)` path first, then the next real runtime-backed product area that can reuse execution units without speculative abstraction.
