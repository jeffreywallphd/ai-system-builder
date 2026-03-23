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

## Execution flow for workflows

### 1. A workflow enters through a UI service/store
In the renderer, stores call services such as `ui/services/WorkflowService.ts`, which then use application-layer use cases.

### 2. The application use case prepares execution
`application/workflows/ExecuteWorkflowUseCase.ts` is responsible for:
- applying property overrides
- validating the workflow before execution
- resolving workflow context metadata via `WorkflowContextService`
- delegating to `IWorkflowExecutor`

This is the central orchestration point for workflow runs.

### 3. The executor chooses a strategy
`infrastructure/execution/TruthfulWorkflowExecutor.ts` selects an execution strategy via `WorkflowRuntimeSelector`.

This is important because the system does **not** assume one runtime path. Instead, it chooses a compatible strategy and records why that strategy was selected.

### 4. A concrete strategy runs the workflow
Today the main strategies are:

- **Python delegated execution** via `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- **Interpreted scaffold fallback** via `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

The delegated strategy serializes workflow nodes/connections into the Python runtime request. The interpreted strategy topologically sorts the graph, resolves node execution context, runs nodes one at a time, and accumulates outputs/provenance.

### 5. Provenance is returned truthfully
The executor and strategies preserve provenance so the caller can tell whether execution was:
- delegated
- scaffolded/interpreted
- unavailable or degraded

This is a notable product-design fit for a tooling system where operator trust matters.

## Why the executor is called "truthful"

The naming in `TruthfulWorkflowExecutor` is not cosmetic. The design intent is that the system should report what actually happened during execution instead of collapsing all runs into a single generic "success" story.

That principle shows up in several ways:
- strategy descriptors advertise their default provenance
- the selector returns a selection reason
- delegated failures can still report that no fallback actually ran
- scaffolded execution reports itself as scaffolded fallback

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

## TODO

- Tool running and workflow execution currently share architecture well, but the surrounding composition is duplicated between `infrastructure/composition/InfrastructureRegistry.ts` and `ui/composition/createUiDependencies.ts`. Converging those registrations would reduce drift in this critical slice.
- The interpreted fallback is clearly useful, but the product docs should eventually define which node types are expected to be fully trustworthy under scaffold execution versus only under delegated runtimes.
