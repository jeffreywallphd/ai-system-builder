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
- The current migration now covers the immediate workflow execution path, workflow `startExecution(...)`, the direct tool execution path, and tuning-dataset example generation.
- The engine understands dependency-aware execution units, persisted execution runs, plan transitions, and lightweight history query use cases.
- The workflow adapter wraps the existing workflow executor instead of rewriting runtime selection or strategy internals.
- Workflow-specific events/results are preserved as attached artifacts while the engine boundary itself stays execution-native.

## Runtime orchestration update
- Delegated workflow execution selection can now consult the shared runtime dependency orchestrator before choosing a delegated strategy.
- When the delegated workflow runtime gate is unavailable, selection falls back to a compatible interpreted strategy instead of pretending delegated execution is still ready.
- Selection reasons now surface skipped delegated paths and orchestration detail so workflow provenance stays truthful about why fallback execution was chosen.
- The unified execution engine preserves delegated/scaffolded/hybrid/unavailable provenance instead of replacing it with generic plan state.

## What is not migrated yet
- Model creation/training, MCP orchestration, scheduling, and distributed execution are still outside this slice even though plan-backed workflow runs and dataset generation runs are now durable.

## Important phrasing
Use "workflow-first", "tool projection", and "truthful execution provenance" when describing the product design.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
- If asked what should migrate next, answer: the next real runtime-backed product area after dataset generation, most likely model-training preparation.
