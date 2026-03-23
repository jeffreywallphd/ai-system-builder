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

The purpose of this slice is still not to replace the current truthful workflow runtime stack. Instead, it provides a small inner execution abstraction that now acts as a reusable execution substrate while preserving the current workflow runtime behavior through adapters. The same substrate now also carries the truthful local model-training lifecycle when the runtime can honestly report submission, progress, cancellation, and terminal state.

### New inner-layer execution concepts

The execution slice now uses two small execution-native contract families:

- `domain/execution/ExecutionPlan.ts` for plan/unit identity, dependency ordering, and statuses (`pending`, `ready`, `running`, `completed`, `failed`, `skipped`, `cancelled`)
- `domain/execution/ExecutionRun.ts` plus `application/execution/ExecutionContracts.ts` for run snapshots, unit transitions, execution-native provenance, diagnostics, and result/event attachments

This taxonomy is intentionally small. It is sufficient for workflow execution plans, truthful model/dataset runtime-backed runs, persisted run history, and a narrow MCP server-operation slice today without overcommitting the system to a speculative generalized MCP orchestration framework.

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

- **migrated now:** direct workflow execution from `ExecuteWorkflowUseCase.execute(...)`, workflow `startExecution(...)`, direct tool execution from `RunToolUseCase.execute(...)`, tuning-dataset example generation from `DefaultTuningDatasetStudioApplicationService.generateExamplesFromSource(...)`, preparation-only model creation from `DefaultModelTrainingApplicationService.submitJob(...)`, truthful local-gradient model-training runs from that same service when the Python runtime can report real lifecycle state, and the narrow MCP server-operation slice (`connect`, `reconnect`, `disconnect`, and local-server creation) when those actions run through the Python-backed MCP runtime manager
- **not yet migrated:** broader MCP tool orchestration, MCP discovery/catalog refresh flows, or broader asynchronous/scheduled/distributed execution paths outside the current truthful runtime-backed slices

The remaining MCP areas stay out of scope for Direction 1 because the current runtime integration can report a single server-operation result honestly, but it does not yet expose a richer durable lifecycle for broader MCP discovery/catalog/tool orchestration without inventing progress or cancellation semantics.

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
`infrastructure/execution/WorkflowExecutionUnitHandler.ts` is the workflow execution-unit handler, `infrastructure/execution/DatasetGenerationExecutionUnitHandler.ts` is the dataset-generation execution-unit handler, and `infrastructure/execution/McpServerOperationExecutionUnitHandler.ts` is the narrow MCP server-operation handler.

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

Plan-backed runs are also now persisted as durable execution-run records. In desktop-backed modes the preferred structured source of truth is now a SQLite execution-run repository reached either directly in outer-layer Node/Electron composition or through the desktop preload bridge. Browser/local-storage and filesystem JSON repositories remain degraded fallbacks. The records capture run identity, plan identity, unit states, status transitions, timestamps, final status, cancellation support, filtering metadata, engine-native terminal/diagnostic summaries, and truthful execution provenance metadata. Lightweight application query use cases can now list and load those run records without reaching into infrastructure directly.

That matters because the abstraction is meant to standardize execution flow without flattening the truthfulness model or discarding execution history.

## Execution-native projection and history surfaces

The application layer now includes an execution-run projection service that derives UI-facing summaries such as:
- current active unit label/id
- completed units vs total units
- progress labels and percentages, preferring runtime-reported progress when a truthful long-running runtime actually exposes it
- terminal/error/diagnostic summaries
- execution-path truthfulness summaries
- duration and metadata context summaries

The renderer consumes those projected summaries through a thin `ExecutionHistoryService`, a reusable `ExecutionHistoryPanel`, and a reusable execution-run detail panel instead of reconstructing run semantics ad hoc inside feature pages. Workflow editor history, dataset-generation history, and model-training history now all read from the same durable execution-run query path and can drill into unit-level/timeline detail from the persisted run record.
The MCP page now uses that same durable history/detail path for runtime-backed server operations instead of relying only on transient page-local mutation state.

## Artifact guidance inside the execution engine

Artifacts are still preserved because product-specific callers sometimes need the original workflow result, dataset-generation result, or model-preparation job payload. But artifacts are no longer the main reporting surface for general orchestration and UI history.

Execution-unit results and durable run records now also carry engine-native summaries (`outputSummary`, `terminalSummary`, `diagnosticsSummary`), lightweight unit metadata (for example truthful model-training progress/checkpoint/artifact counts and MCP runtime/server state facts), and structured provenance/metadata. That means reporting, storage, filtering, and history/detail views can rely on execution-native fields first, while artifacts remain optional rich attachments for feature reconstruction.

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

1. Keep MCP migration narrow and truthful: extend only the next MCP/runtime-backed operation that can honestly report start/result/failure without inventing lifecycle detail.
2. Extend execution-run history/detail usage into any remaining runtime-backed reporting surfaces that still assemble summaries ad hoc.
3. Expand cancellation/progress modeling only where an actual runtime can report richer unit-level state truthfully.
4. Keep converging composition helpers so unified execution-engine wiring and execution-run persistence continue to share one path across renderer, registry, and bootstrap entry points.

That is "done enough" for Direction 1: the unified execution engine is no longer limited to workflows/model-training/dataset generation, the next truthful MCP-backed slice now persists through the same durable substrate, and generic history/detail surfaces can inspect it without feature-specific summary logic. The next likely architectural focus is Direction 2 work above this substrate rather than broadening Direction 1 into speculative orchestration.

## TODO

- Tool running, model/dataset runs, and the narrow MCP server-operation slice now share the same engine seam and persisted run model, but broader composition still has multiple roots. Further convergence should happen incrementally instead of through a giant rewrite.
- The interpreted fallback is clearly useful, but the product docs should eventually define which node types are expected to be fully trustworthy under scaffold execution versus only under delegated runtimes.
