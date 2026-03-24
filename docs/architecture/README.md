# Architecture Overview

AI Loom Studio is organized around a clean-architecture-style core for desktop-first tooling. The codebase separates **business meaning**, **application orchestration**, **host/runtime adapters**, and **UI delivery** so that workflows, tools, context packages, model management, and managed runtimes can evolve without forcing all concerns into the renderer or the Electron host.

This documentation describes the architecture **as implemented today**, not as an idealized target. Where the implementation appears to drift from the product's core intentions, each document includes a **TODO** section so the current state is transparent.

## Core architectural intent

At a high level, the system aims to provide:

- A stable **domain core** for workflows, nodes, models, assets, context packages, tools, managed services, and tuning datasets.
- An **application layer** that exposes explicit use cases and service orchestration over domain models and ports.
- An **infrastructure layer** that binds those ports to concrete implementations such as filesystem storage, browser storage, Electron bridges, Python runtime clients, MCP runtime adapters, and execution engines.
- A **presentation/host layer** that delivers the product through a React renderer and an Electron desktop shell.
- A runtime model that can truthfully distinguish between **delegated execution** and **fallback/interpreted execution**, rather than pretending every run used the same engine.

## The main architectural layers

### 1. Domain
The `domain/` tree contains the business model and validation logic. It defines the language of the product: workflows, nodes, connections, model compatibility, workflow validation, managed services metadata, tuning-dataset entities, and more. The domain is intentionally free of Electron, browser, and storage details.

Representative files:
- `domain/workflows/Workflow.ts`
- `domain/services/WorkflowValidator.ts`
- `domain/services/NodeCompatibilityService.ts`
- `domain/models/Model.ts`
- `domain/tuning-datasets/TuningDatasetEntities.ts`

### 2. Application
The `application/` tree defines use cases, application services, DTOs, projection services, and ports/interfaces. This is the layer that answers questions like:
- "How do we execute a workflow?"
- "How do we run a published workflow as a tool?"
- "How do we preview workflow context?"
- "How do we install or search models?"

It depends inward on the domain and outward only through interfaces/ports.

Representative files:
- `application/workflows/ExecuteWorkflowUseCase.ts`
- `application/tools/RunToolUseCase.ts`
- `application/context/WorkflowContextService.ts`
- `application/ports/interfaces/*`
- `application/projection/*`

### 3. Infrastructure
The `infrastructure/` tree implements the concrete adapters that make the application layer usable in real environments. This includes:
- filesystem repositories
- browser-storage repositories
- desktop bridge repositories
- Python runtime adapters
- MCP integration
- execution strategies
- dependency registration/composition

Representative files:
- `infrastructure/composition/ApplicationBootstrap.ts`
- `infrastructure/composition/InfrastructureRegistry.ts`
- `infrastructure/filesystem/LocalWorkflowRepository.ts`
- `infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`
- `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

### 4. Presentation and hosts
The system has two delivery surfaces working together:

- **React renderer (`ui/`)**: pages, stores, UI services, composition helpers, and components.
- **Electron desktop host (`electron/`)**: main-process startup, preload bridge, local storage/bootstrap services, and desktop-only capabilities.

The host decides what capabilities exist; the UI composes the dependencies it needs for the current runtime mode.

Representative files:
- `ui/composition/createUiDependencies.ts`
- `ui/composition/AppProviders.tsx`
- `ui/routes/AppRouter.tsx`
- `electron/main/main.ts`
- `electron/preload.ts`
- `electron/shared/DesktopContracts.ts`

## Architectural reading order

If you are new to the codebase, this is the most useful order for understanding it:

1. **Read the domain contracts and aggregates first** to learn the product language.
2. **Read the application use cases and ports** to see how that language is orchestrated.
3. **Read the execution/runtime adapters** to understand how the product actually runs.
4. **Read the UI composition root** to see what the renderer instantiates in practice.
5. **Read the Electron main/preload layer** to understand the desktop-specific bridge.

## Key architectural characteristics

### Desktop-first, but with browser fallbacks
The product is described as desktop tooling, and the Electron host is the canonical shell. At the same time, the renderer composition supports browser-style fallbacks for persistence and some runtime behavior. That creates a pragmatic architecture in which desktop is the intended home, but degraded/browser-backed execution remains possible.

### Clean architecture with pragmatic seams
The codebase clearly follows clean architecture concepts:
- domain models are separated from adapters
- use cases depend on ports
- infrastructure implements ports
- the UI talks mostly through services/use cases/stores

However, the implementation is intentionally pragmatic rather than dogmatic. Some UI services still mutate domain objects directly for convenience, and the UI has its own manual composition root in addition to the infrastructure DI bootstrap.

### Feature slices built on shared layers
Within the broad architecture, several feature slices are implemented end-to-end through the same layering approach:
- workflows and nodes
- tools and MCP integration
- context engineering and context packages
- model management and training
- managed services/runtime orchestration
- tuning dataset studio

## Runtime modes in practice

The runtime is not a single path. The system currently supports multiple execution/storage modes depending on configuration and host availability:

- **Desktop + Electron bridge** for durable local storage and model-file access.
- **Desktop + managed local Python runtime** for delegated execution and managed services.
- **Browser/development fallback** for local storage-backed persistence and reduced capabilities.
- **Truthful execution selection**, where the executor chooses a compatible strategy and records provenance instead of hiding degraded behavior.

## Where to go next

- For the inner clean-architecture core, read [`domain-and-application-core.md`](./domain-and-application-core.md).
- For layer boundaries and dependency rules, read [`layers-and-boundaries.md`](./layers-and-boundaries.md).
- For execution, tools, MCP, and runtime selection, read [`workflow-execution-and-tools.md`](./workflow-execution-and-tools.md).
- For host/runtime composition and desktop delivery, read [`desktop-runtime-and-hosts.md`](./desktop-runtime-and-hosts.md).
- For UI composition and state flow, read [`presentation-and-state.md`](./presentation-and-state.md).

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers use a stable contract without reinterpreting nested policy structure.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2 inner-foundation slice) now includes an execution-oriented agent planning contract: validated dependency-aware plan/step models in `domain/agents/AgentPlan.ts`, planning strategy contracts in `application/agents/contracts/AgentPlanningStrategy.ts` + `application/agents/services/DeterministicAgentPlanningStrategy.ts`, and bounded evaluation/replan signal contracts in `application/agents/contracts/AgentPlanningLoop.ts`.
- Agent/execution bridging remains unified-engine-native via `application/agents/contracts/AgentExecutionMapping.ts`, including direct mapping from `AgentPlan` into `ExecutionPlan` units plus per-unit payload metadata (asset inputs and step-output references).
- Direction 4 (Phase 3 inner slice) adds asset-driven memory seams for agents without introducing a second runtime:
  - typed memory retrieval seam (`application/agents/contracts/AgentMemoryRetrieval.ts`, `application/agents/services/AgentMemoryRetrievalService.ts`);
  - bounded session working-memory model (`domain/agents/AgentWorkingMemory.ts`, `application/agents/services/AgentWorkingMemoryService.ts`);
  - bounded memory write pipeline (`application/agents/services/AgentMemoryWriteService.ts`);
  - explicit memory policy controls on agent memory config (`domain/agents/AgentMemory.ts`) for retrieval/write/retention behavior.
  - retrieval now remains deterministic and asset-version-backed while honoring policy/type/tag/metadata/recency constraints (and excluding session-only types from durable retrieval paths).
  - execution read models now include bounded working-memory snapshots and memory-write outcomes so later evaluation/replanning layers can consume session context without introducing a second orchestration model.
  - memory policy retention is now operationally enforced in the write pipeline via bounded durable-capacity gating.

## TODO

- The repository still contains **two composition stories**: the generic DI bootstrap in `infrastructure/composition/` and the renderer-specific manual composition in `ui/composition/createUiDependencies.ts`. Execution-engine wiring, execution-run persistence, MCP server-operation handler registration, and execution-history/detail projection services now share more of the same outer-layer path across those roots, but broader composition convergence is still future work.
- The product intent appears desktop-first, yet a meaningful amount of durability and orchestration still routes through browser-style adapters. That is practical, but the desired "source of truth" between desktop-native persistence and browser fallback should be documented in product terms more explicitly.
