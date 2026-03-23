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
- The current migration now covers the immediate workflow execution path, workflow `startExecution(...)`, the direct tool execution path, tuning-dataset example generation, preparation-only model creation, and the truthful long-running local model-training lifecycle when the runtime can report real status/progress/cancellation.
- The engine understands dependency-aware execution units, persisted execution runs, SQLite-backed desktop history with schema versioning, plan transitions, execution-run list/detail projections, and lightweight history query use cases.
- The workflow adapter wraps the existing workflow executor instead of rewriting runtime selection or strategy internals.
- Workflow/model/dataset-specific payloads are still preserved as artifacts, but execution-native summaries now carry the data that generic history/reporting flows need first.

## Runtime orchestration update
- Delegated workflow execution selection can now consult the shared runtime dependency orchestrator before choosing a delegated strategy.
- When the delegated workflow runtime gate is unavailable, selection falls back to a compatible interpreted strategy instead of pretending delegated execution is still ready.
- Selection reasons now surface skipped delegated paths and orchestration detail so workflow provenance stays truthful about why fallback execution was chosen.
- The unified execution engine preserves delegated/scaffolded/hybrid/unavailable provenance instead of replacing it with generic plan state.

## What is not migrated yet
- MCP orchestration, scheduling, and distributed execution are still outside this slice even though plan-backed workflow runs, dataset generation runs, model-preparation runs, and truthful local model-training runs are now durable.

## Important phrasing
Use "workflow-first", "tool projection", and "truthful execution provenance" when describing the product design.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
- If asked what should migrate next, answer: execution areas that still cannot report real progress/cancellation truthfully yet, especially MCP/runtime-backed orchestration outside the current local-training slice.
