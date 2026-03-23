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
Workflow -> ExecuteWorkflowUseCase -> WorkflowExecutor -> strategy selection -> Python delegated or interpreted fallback -> provenance-rich result.

## Important phrasing
Use "workflow-first" and "tool projection" when describing the product design.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
