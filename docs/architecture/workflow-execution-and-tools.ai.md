# AI Companion: Workflow Execution and Tools

## Core fact
Published tools are projected workflows, not a separate execution system.

## Main files
- Workflow execution orchestration: `application/workflows/ExecuteWorkflowUseCase.ts`
- Tool run orchestration: `application/tools/RunToolUseCase.ts`
- Tool projection: `application/projection/WorkflowToolProjectionService.ts`
- Strategy selector/executor: `infrastructure/execution/TruthfulWorkflowExecutor.ts`
- Runtime selector: `application/execution/WorkflowRuntimeSelector.ts`
- Python strategy: `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- Fallback strategy: `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`
- Node execution adapter: `infrastructure/interpreted/execution/LangChainNodeExecutor.ts`

## Short execution narrative
Workflow -> ExecuteWorkflowUseCase -> WorkflowExecutor -> orchestration-aware strategy selection -> Python delegated or interpreted fallback -> provenance-rich result.

## Runtime orchestration update
- Delegated workflow execution selection can now consult the shared runtime dependency orchestrator before choosing a delegated strategy.
- When the delegated workflow runtime gate is unavailable, selection falls back to a compatible interpreted strategy instead of pretending delegated execution is still ready.
- Selection reasons now surface skipped delegated paths and orchestration detail so workflow provenance stays truthful about why fallback execution was chosen.

## Important phrasing
Use "workflow-first" and "tool projection" when describing the product design.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
