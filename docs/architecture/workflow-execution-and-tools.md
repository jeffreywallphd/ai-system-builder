# Workflow Execution and Tools

This document covers the most important vertical slice in the product: how authored workflows become executable artifacts, how published workflows become tools, and how runtime selection works across Python, interpreted fallback, and MCP-driven capabilities.

## Architectural idea

The system is **workflow-native**. A workflow is the primary authored artifact. Other surfaces are derived from that:

- a workflow can be validated
- a workflow can be executed
- a workflow can be projected into a form-like authoring view
- a workflow can be projected into a user-facing tool definition
- a workflow can be exposed as a capability in the tool ecosystem

This is one of the strongest architectural choices in the repository because it avoids fragmenting the product into unrelated "workflow" and "tool" systems.

## Unified execution engine slice

The repository now has a thin unified execution engine slice whose **primary contract is execution-native rather than workflow-specific**.

The purpose of this slice is still not to replace the current truthful workflow runtime stack. Instead, it provides a small inner execution abstraction that now acts as a reusable execution substrate while preserving the current workflow runtime behavior through adapters.

### New inner-layer execution concepts

The execution slice now uses two small execution-native contract families:

- `domain/execution/ExecutionPlan.ts` for plan/unit identity, dependency ordering, and statuses (`pending`, `ready`, `running`, `completed`, `failed`, `skipped`, `cancelled`)
- `domain/execution/ExecutionRun.ts` plus `application/execution/ExecutionContracts.ts` for run snapshots, unit transitions, execution-native provenance, diagnostics, and result/event attachments

This taxonomy is intentionally small. It is sufficient for workflow execution plans and persisted run history today without overcommitting the system to speculative dataset/model/MCP shapes.

### New application-layer engine

`application/execution/UnifiedExecutionEngine.ts` now executes and starts `ExecutionPlan` runs by:

- determining which units are ready based on dependency completion
- delegating each unit to a matching execution-unit handler
- collecting unit transitions, unit results, and execution-native events
- persisting durable execution-run snapshots when an execution-run repository is configured
- carrying forward truthful provenance when a unit handler produces it

The engine still runs units sequentially and is intentionally conservative. It is a clean seam and durable run coordinator, not a scheduler or distributed orchestration layer.

### Workflow path now routed through the engine

`application/workflows/ExecuteWorkflowUseCase.ts` now builds a one-unit execution plan for **both** the immediate workflow run path and the `startExecution(...)` path, then submits that plan to the unified execution engine.

The migrated path is still deliberately narrow:

- **migrated now:** direct workflow execution from `ExecuteWorkflowUseCase.execute(...)`, workflow `startExecution(...)`, direct tool execution from `RunToolUseCase.execute(...)`, and tuning-dataset example generation from `DefaultTuningDatasetStudioApplicationService.generateExamplesFromSource(...)`
- **not yet migrated:** model creation/training, MCP orchestration, or broader asynchronous/scheduled execution paths

This gives the codebase one real production seam for synchronous workflow runs, started workflow runs, and a second non-workflow execution-backed product area without forcing a broad refactor.

## Execution flow for workflows

### 1. A workflow enters through a UI service/store
In the renderer, stores call services such as `ui/services/WorkflowService.ts`, which then use application-layer use cases.

### 2. The application use case prepares execution
`application/workflows/ExecuteWorkflowUseCase.ts` is responsible for:
- applying property overrides
- validating the workflow before execution
- resolving workflow context metadata via `WorkflowContextService`
- building a one-unit `ExecutionPlan`
- delegating that plan to the unified execution engine

This remains the central orchestration point for workflow runs.

### 3. The execution engine delegates product-specific work to thin adapters
`infrastructure/execution/WorkflowExecutionUnitHandler.ts` is the workflow execution-unit handler, and `infrastructure/execution/DatasetGenerationExecutionUnitHandler.ts` is the dataset-generation execution-unit handler.

Their job is intentionally thin:
- accept an execution unit from the engine
- adapt that unit back into the existing product-specific request type (`IWorkflowExecutionInput` or `DatasetGenerationRequest`)
- call the existing product-specific runtime service
- map truthful product-specific provenance into execution-native engine contracts
- preserve original product-specific payloads as attached artifacts for product-facing callers

This preserves the existing runtime-aware execution stacks while establishing a canonical execution seam above them.

### 4. The executor chooses a strategy
`infrastructure/execution/TruthfulWorkflowExecutor.ts` still selects an execution strategy via `WorkflowRuntimeSelector`.

This is important because the system does **not** assume one runtime path. Instead, it chooses a compatible strategy and records why that strategy was selected.

The selector is now orchestration-aware for delegated execution. When the shared runtime dependency orchestrator reports that delegated workflow execution is still starting, unavailable, or otherwise not ready, the selector can skip that delegated path and truthfully fall back to a compatible interpreted strategy.

### 5. A concrete strategy runs the workflow
Today the main strategies are:

- **Python delegated execution** via `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- **Interpreted scaffold fallback** via `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

The delegated strategy serializes workflow nodes/connections into the Python runtime request. The interpreted strategy topologically sorts the graph, resolves node execution context, runs nodes one at a time, and accumulates outputs/provenance.

### 6. Provenance and run history stay truthful
The unified execution engine does **not** replace existing provenance language. Instead, the workflow unit handler maps workflow provenance into execution-native provenance fields and preserves workflow-specific payloads as attached artifacts so the caller can still tell whether execution was:
- delegated
- scaffolded/interpreted
- hybrid
- unavailable or degraded

Plan-backed runs are also now persisted as durable execution-run records. Those records capture run identity, plan identity, unit states, status transitions, timestamps, final status, error details, and truthful execution provenance metadata. Lightweight application query use cases can now list and load those run records without reaching into infrastructure directly.

That matters because the abstraction is meant to standardize execution flow without flattening the truthfulness model or discarding execution history.

## Why the executor is called "truthful"

The naming in `TruthfulWorkflowExecutor` is not cosmetic. The design intent is that the system should report what actually happened during execution instead of collapsing all runs into a single generic "success" story.

That principle shows up in several ways:
- strategy descriptors advertise their default provenance
- the selector returns a selection reason
- delegated selection can now include orchestration-backed skip/fallback reasons
- delegated failures can still report that no fallback actually ran
- scaffolded execution reports itself as scaffolded fallback
- the unified execution engine preserves those strategy/result facts instead of replacing them with generic plan status alone

For desktop tooling, this is a healthy architectural choice because users need to understand runtime quality, not just outcomes.

## Tool architecture: workflows projected as tools

### Publishing model
Tool metadata lives on the workflow metadata object (`isPublishedAsTool`, `toolTitle`, `toolDescription`, `toolCategory`, `toolSlug`). This means tool publication is a property of a workflow rather than a separate top-level entity.

### Projection model
The application layer provides projection services:
- `application/projection/WorkflowProjectionService.ts`
- `application/projection/WorkflowToolProjectionService.ts`

These services adapt the workflow into different external representations:
- a form-oriented projection for workflow editing
- a tool definition / runnable tool schema for end-user tool running

### Running a tool
`application/tools/RunToolUseCase.ts` performs tool execution by:
1. loading the tool definition
2. loading the source workflow from the workflow repository
3. applying tool input onto the workflow projection
4. optionally assembling workflow context
5. executing the resulting workflow through the workflow executor

Architecturally, this is elegant because **tool execution reuses workflow execution instead of bypassing it**.

Tool running now uses the same unified execution-engine seam as direct workflow execution, while still reusing workflow projection and the existing truthful workflow executor underneath.

## Tool capability ecosystem

Beyond "run this published workflow as a tool," the system also has a broader capability model.

### Capability catalogs
The infrastructure composes a `CompositeToolCapabilityCatalog` from providers such as:
- workflow-projected tools
- static local capabilities
- MCP-discovered capabilities

### Capability executors
Execution is similarly composed through `CompositeToolCapabilityExecutor` with provider-specific executors.

This enables one UI surface to discover and invoke capabilities from multiple backends while still preserving provider identity.

## MCP as part of the execution/tool architecture

MCP is treated as an infrastructure-backed capability source, not as the core authored model.

That is an important boundary:
- workflows remain the authored first-class artifact
- MCP augments the environment with runtime-discovered tools and servers
- tool capability catalogs merge workflow, local, and MCP providers into one surface

This keeps the platform extensible without making external runtimes the center of the authoring model.

## Node execution context and context injection

The interpreted execution path relies on a node execution context resolver and a node executor. `LangChainNodeExecutor` is a particularly important adapter because it:
- reads node properties
- resolves workflow context text and context fragments
- incorporates document/chunk/tool data
- can incorporate MCP tool-call configuration
- returns node-level outputs and provenance

This means the execution architecture is not just graph traversal; it is also a context-assembly pipeline.

## What this design gets right

### Workflow-first product identity
The system has a strong workflow-first center, and tools/capabilities are built around it.

### Explicit degradation model
Fallbacks are modeled explicitly instead of being hidden.

### Extensibility through strategy/provider composition
Execution strategies and capability providers can be swapped or extended without rewriting application use cases.

### Inner-to-outer migration seam
The new execution engine slice starts in the domain/application layers and adapts the existing infrastructure stack outward, which matches the project’s architecture guidance better than a UI-first or runtime-first refactor would.

## Recommended next migration steps

1. Migrate the next real execution-backed product area after dataset generation, most likely model-training preparation or another runtime-backed preparation path.
2. Surface the new execution-run query use cases into whichever UI/reporting flows need durable history beyond existing dataset generation batch views.
3. Expand cancellation/progress modeling only where an actual runtime can report richer unit-level state truthfully.
4. Keep converging composition helpers so unified execution-engine wiring and execution-run persistence continue to share one path across renderer, registry, and bootstrap entry points.

## TODO

- Tool running and workflow execution now share the same engine seam and persisted run model, but broader composition still has multiple roots. Further convergence should happen incrementally instead of through a giant rewrite.
- The interpreted fallback is clearly useful, but the product docs should eventually define which node types are expected to be fully trustworthy under scaffold execution versus only under delegated runtimes.
