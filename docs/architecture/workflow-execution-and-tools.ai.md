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
- The current migration now covers the immediate workflow execution path, workflow `startExecution(...)`, the direct tool execution path, tuning-dataset example generation, preparation-only model creation, the truthful long-running local model-training lifecycle when the runtime can report real status/progress/cancellation, and a narrow MCP server-operation slice for connect/reconnect/disconnect/local-server creation.
- The current migration now covers the immediate workflow execution path, workflow `startExecution(...)`, the direct tool execution path, tuning-dataset example generation, preparation-only model creation, a dependency-aware model flow (`model preparation -> local model training`) for local-gradient runs, and a narrow MCP server-operation slice for connect/reconnect/disconnect/local-server creation including a real dependency-aware local-server `create -> connect` plan.
- The engine understands dependency-aware execution units, persisted execution runs, SQLite-backed desktop history with schema versioning, plan transitions, execution-run list/detail projections, and lightweight history query use cases.
- Flow-related run lookup is now explicit through `executionFlowId` metadata plus a related-run use case, so UI/debugging features can query related runs from the execution substrate instead of feature-specific helpers.
- Execution-plan metadata now includes a lightweight explicit runtime capability profile (`supportsProgressEvents`, `supportsPollingProgress`, `supportsCancellation`, `supportsIntermediateArtifacts`, `supportsPartialResults`, `supportsReconnectOrResume`, `supportsMultiUnitComposition`) so higher layers can keep truthfulness language aligned with what a runtime really supports.
- The workflow adapter wraps the existing workflow executor instead of rewriting runtime selection or strategy internals.
- Workflow/model/dataset/MCP-specific payloads are still preserved as artifacts, but execution-native summaries now carry the data that generic history/reporting flows need first.

## Runtime orchestration update
- Delegated workflow execution selection can now consult the shared runtime dependency orchestrator before choosing a delegated strategy.
- When the delegated workflow runtime gate is unavailable, selection falls back to a compatible interpreted strategy instead of pretending delegated execution is still ready.
- Selection reasons now surface skipped delegated paths and orchestration detail so workflow provenance stays truthful about why fallback execution was chosen.
- The unified execution engine preserves delegated/scaffolded/hybrid/unavailable provenance instead of replacing it with generic plan state.

## What is not migrated yet
- Broader MCP tool/discovery orchestration, scheduling, and distributed execution are still outside this slice even though plan-backed workflow runs, dataset generation runs, model-preparation runs, truthful local model-training runs, and narrow MCP server-operation runs are now durable.
- The reason is truthfulness: the current MCP runtime can honestly report a single server-operation result, but not yet a richer durable lifecycle for broader MCP orchestration without invented progress/cancellation states.

## Important phrasing
Use "workflow-first", "tool projection", and "truthful execution provenance" when describing the product design.


## MCP registry and capability foundation (Direction 3, first slice)
- MCP tools now have a first-class registry foundation (install/register, list/detail, enable/disable, and safe removal with dependency blocking).
- Tool definitions now use a machine-readable capability contract that includes stable identity, display metadata, version, input/output schema, side-effect class, auth requirements, optional cost/execution metadata, tags/categories, and optional runtime binding (`serverId` + `toolName`).
- Registration validates definition contracts before persistence; runtime execution can validate input/output contracts against installed definitions at the use-case boundary.
- Capability introspection query use cases can filter tools by schema type, side effects, auth requirements, tags, categories, and enabled status to support future planner/agent selection.
- Safe removal currently blocks uninstall when persisted workflows reference a tool (via MCP tool-call node descriptor or server/tool mapping), returning structured `unsafe-removal` errors for UI surfacing.

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
- If asked what should migrate next, answer: execution areas that still cannot report real progress/cancellation truthfully yet, especially MCP/runtime-backed orchestration beyond the current narrow server-operation slice.
- If asked whether Direction 1 is finished, answer: "done enough that the execution substrate is no longer the obvious bottleneck; the next focus should likely move to Direction 2 unless a new truthful runtime-backed slice is clearly ready."
