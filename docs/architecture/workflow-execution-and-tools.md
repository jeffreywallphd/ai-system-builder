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

### Lightweight runtime capability model

Execution plans now carry a lightweight explicit runtime capability profile in metadata (`supportsProgressEvents`, `supportsPollingProgress`, `supportsCancellation`, `supportsIntermediateArtifacts`, `supportsPartialResults`, `supportsReconnectOrResume`, `supportsMultiUnitComposition`).

This keeps capability claims small and truthful: higher layers can reason about what semantics are honestly available without inventing progress/cancellation behavior for runtimes that do not expose it.

### Direction 5 Epic 6 runtime progression (stories 6.19–6.20)

- Runtime execution records are now persisted as runtime-scoped metadata snapshots (execution identity, executed system/version identity, status, bounded trace/result summaries, timestamps, environment metadata, and version-aware execution references).
- Desktop system-runtime host wiring now uses a SQLite-backed execution-record store so status/result/trace views can reload across sessions.
- System-of-systems execution is now first-class through the same runtime stack: nested system nodes invoke recursive child executions via the existing orchestration seam, and parent records carry child execution linkage metadata.
- Boundaries remain explicit: this is still bounded runtime metadata persistence and recursive orchestration support, not a full replay/event-sourcing/distributed execution platform.

### Direction 5 Epic 6 runtime hardening (story 6.23)

- Runtime orchestration now enforces explicit bounded runtime-state retention (trace/log/error/progression retention caps) so iterative/autonomous runs remain stable under repeated progression.
- Runtime start requests now validate runtime safety bounds (`maxDepth`, `maxIterationsPerNode`, `maxPlanningCyclesPerNode`, and runtime-state retention limits) and fail cleanly with deterministic invalid-request semantics when pathological values are supplied.
- Runtime execution metadata persistence now includes bounded retention policies in both in-memory and SQLite execution stores (oldest records are pruned on overflow).
- This is bounded performance/stability hardening only; no distributed scheduling/queue/event-sourcing infrastructure was introduced.

### Direction 5 Epic 7 external invocation + audit slice (stories 7.15–7.16)

- External runtime invocation (API + tool bridge) now keeps system-of-systems execution lineage explicit on the same runtime stack: flat and nested systems both execute through existing version-aware orchestration paths, and status/result/start projections expose bounded parent/child execution linkage summaries.
- External invocation lineage remains version-aware and session/tenant/auth/access/quota bounded; nested system identity is preserved rather than flattened into opaque node output.
- Runtime execution audit now has a separate durable trail model (requested/accepted/completed/failed) that stores caller identity, tenant context, request source, system/version identity, execution/session ids, and bounded nested-child attribution where available.
- Audit records are intentionally distinct from runtime trace/log events and from asset version history; they are queryable through runtime backend seams without introducing a broader compliance platform.


### Direction 5 Epic 7 external resilience/rate-control slice (stories 7.17–7.18)

- External start/invocation paths now apply an explicit bounded external retry policy: retryable classification is limited to transport/internal failures, while auth/validation/quota/rate-limit failures fail fast.
- External replay/idempotency support is now bounded at start boundary, so repeated idempotency-key requests reuse the same execution identity instead of silently creating duplicate runs.
- Callback delivery retries are bounded by callback registration max-attempt settings and audited as retry-attempted/retry-exhausted outcomes.
- Callback signature generation is runtime-compatible (Web Crypto primary, Node crypto fallback) so browser-hosted runtime contracts do not depend on top-level Node crypto imports.
- External entrypoint rate limiting is now centralized at runtime API boundaries (caller/tenant/source-operation windows), remains separate from execution quota policy, and returns structured `rate-limit-exceeded` errors.

### Direction 5 Epic 7 external runtime alignment snapshot (stories 7.1–7.24)

Implemented now (external surface is real and bounded, not a second runtime architecture):
- External runtime interface contract, access control, API authentication integration, and execution quota/rate-limit checks on entry paths.
- External input validation/output serialization, execution session model, async start/poll flows, callback registration/delivery, streaming update subscriptions, request routing, tool-bridge invocation, and external SDK contract/reference client.
- External environment selection exposure, tenant-isolation enforcement, nested system-of-systems execution lineage, execution audit trail, retry classification/idempotent replay handling, and end-to-end + cross-system interop tests.
- External read-side safeguards now include bounded status/result shaping, short-lived status/poll response caching for burst polling patterns, bounded callback registration counts, bounded stream subscription/fan-out limits, and throttled stream emission cadence to reduce load amplification on hot paths.

Bounded/partial by design:
- Callback/streaming safeguards are in-process bounded guards (no distributed queue/event bus).
- Poll/status response caching is intentionally short-lived and caller/tenant scoped to reduce repeated resolution pressure without changing correctness semantics.
- Retry behavior is bounded and classification-based; it does not attempt long-horizon orchestration recovery.

Future work (not implemented in this epic):
- Distributed runtime backpressure infrastructure (external queues, distributed cache tiers, or cross-host stream brokers).
- Advanced observability/analytics platforms beyond current runtime/audit/read-model seams.

### Workflow path now routed through the engine

`application/workflows/ExecuteWorkflowUseCase.ts` now builds a one-unit execution plan for **both** the immediate workflow run path and the `startExecution(...)` path, then submits that plan to the unified execution engine.

The migrated path is still deliberately narrow:

- **migrated now:** direct workflow execution from `ExecuteWorkflowUseCase.execute(...)`, workflow `startExecution(...)`, direct tool execution from `RunToolUseCase.execute(...)`, tuning-dataset example generation from `DefaultTuningDatasetStudioApplicationService.generateExamplesFromSource(...)`, preparation-only model creation from `DefaultModelTrainingApplicationService.submitJob(...)`, a dependency-aware model flow (`model preparation -> local model training`) for local-gradient runs from that same service, and the narrow MCP server-operation slice (`connect`, `reconnect`, `disconnect`, local-server creation, and a dependency-aware local-server `create -> connect` plan) when those actions run through the Python-backed MCP runtime manager
- **not yet migrated:** broader MCP tool orchestration, MCP discovery/catalog refresh flows, or broader asynchronous/scheduled/distributed execution paths outside the current truthful runtime-backed slices

The remaining MCP areas stay out of scope for Direction 1 because the current runtime integration can report a single server-operation result honestly, but it does not yet expose a richer durable lifecycle for broader MCP discovery/catalog/tool orchestration without inventing progress or cancellation semantics.

This gives the codebase one real production seam for synchronous workflow runs, started workflow runs, and a second non-workflow execution-backed product area without forcing a broad refactor.

### Workflow Studio draft planning seam
- Workflow Studio now has a canonical draft-to-plan mapper in `application/workflow-studio/WorkflowDraftExecutionPlanMapper.ts`.
- `mapWorkflowDraftToExecutionPlan(...)` validates canonical draft integrity first (`validateWorkflowDraft`) and then emits deterministic ordered execution-plan elements for action steps and built-ins (`if-then`, `loop-iteration`, `delay-wait`, `manual-approval`) plus normalized ordered output plans.
- Execution alignment contracts are now explicit in `application/workflow-studio/WorkflowExecutionAlignmentContracts.ts` (execution request/context, trigger handoff, step sequencing metadata, input/output bindings, and validation-boundary result contracts).
- Workflow-to-execution translation now runs through `application/workflow-studio/WorkflowDefinitionExecutionPlanTranslator.ts`; `WorkflowDraftExecutionPlanMapper.ts` remains a compatibility export seam over that translator so canonical workflow-draft semantics stay single-sourced.
- Translation now includes canonical execution-context assembly (`application/workflow-studio/WorkflowExecutionContextAssemblyService.ts`) so runtime parameters, dataset/static bindings, trigger payloads, and session metadata resolve into one deterministic execution context with explicit unresolved-input issues at the pre-execution validation boundary.
- Output planning now fails before runtime when output contracts are unsupported or incompatible with execution planning (for example unknown destination types, output-type mismatches, or unsupported formats), instead of silently deferring these failures to runtime.
- Execution plans now emit explicit control-flow mapping descriptors (`controlFlowMappings`) for branch routing, loop execution, and manual outcome routing in addition to ordered step sequencing metadata, keeping control-flow semantics execution-ready without introducing a second runtime model.
- This mapper is planning-only: it creates explicit runtime-ready plan elements without adding a second runtime executor or speculative graph model.
- Stories 6.11-6.12 now extend that same seam into runtime + persistence behavior without introducing alternate workflow-draft representations:
  - `application/workflow-studio/WorkflowDraftExecutionRuntime.ts` executes mapped built-in plan elements deterministically (conditional branch, loop/iteration, delay/wait, manual approval) and emits explicit completed/skipped/failed/paused step traces.
  - `WorkflowStudioApplicationService.executeWorkflowDraft(...)` now routes canonical draft content through `deserialize -> plan mapper -> runtime executor` on the same workflow-studio contracts.
  - Built-in workflow drafts continue to persist as canonical serialized draft content and now have explicit SQLite-backed persistence/rehydration round-trip coverage for built-in type/config/order.
- Trigger runtime-readiness mapping is now explicit but bounded through `application/workflow-studio/WorkflowTriggerRuntimeMapper.ts`, which projects canonical trigger contracts/config (manual/user, temporal, state) into runtime-facing descriptors without adding a scheduler engine or trigger-owned execution path.
- State runtime descriptors now include explicit event semantics (`sourceType`, `eventCategory`, `subject`, plus optional criteria/filter metadata) so runtime mapping is planning-ready without introducing an event-bus execution engine.
- Trigger correctness now routes through a shared validation pipeline (`validateWorkflowDraftTriggers` and `application/workflow-studio/WorkflowTriggerValidationPipeline.ts`) that supports per-trigger config validation and workflow-level trigger checks before runtime mapping.
- Stories 7.11-7.12 now route trigger mapping through the same execution-plan seam: `mapWorkflowDraftToExecutionPlan(...)` includes trigger execution semantics produced by `application/workflow-studio/WorkflowDraftTriggerExecutionPlanner.ts` (manual/user invocation, temporal scheduling metadata, state-event metadata).
- Trigger planning consumes canonical validated draft content and fails safely when unsupported/invalid trigger semantics reach planning (no silent trigger drops).
- Execution-plan trigger semantics remain continuation-ready (manual trigger scope includes both `workflow-start` and `workflow-continuation`) so future human-approval resume/intermediate continuation behavior is not blocked by start-only assumptions.
- Pre-execution readiness validation is now a first-class canonical seam (`application/workflow-studio/WorkflowPreExecutionValidationPipeline.ts`) and runs before manual launch: authored workflow validation, pre-execution asset-version reference checks, and translation readiness are returned in one structured boundary result.
- Manual Workflow Studio run now uses that same canonical flow through desktop/backend contracts (`StudioShellBackendApi.runWorkflowDraft` -> `WorkflowStudioApplicationService.runWorkflowDraftManual`) instead of UI-local execution logic: validate readiness -> translate canonical plan -> launch through runtime executor.
- Workflow Studio launch feedback is now backend-authoritative (validation summary/issues + launch status projection), while wizard/canvas remain shared-draft authoring surfaces only.
- Asset-backed step execution binding is now explicit in the canonical translator seam (`application/workflow-studio/WorkflowAssetStepExecutionBindingService.ts`), producing deterministic per-step runtime bindings (`assetStepBindings`) for supported executable asset kinds (currently `agent-assistant`) and failing pre-execution when asset-backed bindings are unresolved or unsupported.
- Workflow draft runtime execution now has an explicit asset-invocation boundary (`WorkflowDraftExecutionRuntime.assetStepExecutor`) so asset-backed steps run through the same aligned plan/context/sequencing flow, with truthful explicit failures when no runtime invoker is configured for a required asset-backed step.
- Trigger-aware execution entry is now explicit and shared (`application/workflow-studio/WorkflowTriggerExecutionEntryService.ts` + `WorkflowStudioApplicationService.runWorkflowDraftTriggered`): manual/user, temporal, and state/data activations all route through one validation -> translation -> context assembly -> runtime launch path instead of separate trigger pipelines.
- Trigger activation semantics now enforce draft association and kind alignment at translation time (`trigger-activation-not-found`, `trigger-activation-kind-mismatch`) so trigger launches fail deterministically when activation context does not match authored trigger definitions.
- Workflow output handling now runs through a canonical runtime delivery seam (`application/workflow-studio/WorkflowExecutionOutputDeliveryService.ts`) that maps authored output plans into explicit delivery results for viewer, file-export, system-record, and prompt-response-chat destinations; output-delivery failures are explicit runtime issues instead of silent no-ops.
- Workflow output binding declarations are now explicit asset configuration (`application/contracts/ImageWorkflowOutputBindingConfiguration.ts`) and map into canonical output-binding descriptors used by write-plan resolution/materialization paths; this keeps target selection, write behavior, and target-specific options inspectable and reusable.
- Persisted workflow image records now include a typed lineage envelope (workflow/version/run, source image or dataset context, binding target, and output relationship metadata) across output/history/comparison dataset targets via `application/workflow-studio/WorkflowOutputRecordMaterializationService.ts`.
- Workflow Studio run orchestration now emits structured execution lifecycle/status reports (`queued` -> `running` -> `completed|failed`) with typed failure classification (`validation-failure`, `translation-failure`, `unsupported-configuration`, `runtime-failure`, `output-delivery-failure`, `launch-failure`) on the same manual/trigger entry path.
- Workflow Studio now also exposes a canonical pre-launch execution-readiness check over the same validation pipeline (`StudioShellBackendApi.assessWorkflowExecutionReadiness`) so UI launch eligibility/blocked state is based on backend validation truth rather than UI-local heuristics.
- Workflow run feedback projections now include bounded output handoff summaries (per-output destination/target delivery status) so Workflow Studio can report result delivery outcomes without exposing runtime-internal payload details.

Direction 5 Epic 6 stories 6.17–6.18 now keep system-runtime execution read integration bounded and version-aware:
- runtime executions are projected into registry system-detail read models as recent execution summaries (status/result/timestamps plus bounded trace-reference counts),
- registry remains read-only (no runtime command surface),
- execution planning/orchestration enforces version-pinned component references and records executed version maps on runtime status/result APIs for truthful lineage and reproducibility.

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
Flow-level querying is now also first-class through flow metadata (`executionFlowId`) and a related-run query use case so UI/debugging layers can resolve runs that belong to the same execution flow without manual feature-specific joins.

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

### Agent structured tool/memory configuration boundaries (Phase 6.5/6.6)
- Agent tool authoring remains on `AgentPolicy.toolAccess` (no parallel tool configuration model).
- Allowed tool ids must be canonical (`mcp:*:*` or `workflow:*`), MCP bindings must match canonical identity and be consistent with allowed tool ids, and scope constraints must target allowed tools with non-empty canonical scope identifiers.
- Agent memory authoring remains asset-native on `AgentMemoryConfiguration` and validates retrieval/writable/retrievable/session-only/retention combinations as one coherent backend-ready contract.
- New agent-facing artifacts/read models for these slices must classify via `CompositionTaxonomyClassifier` or project via `CompositionAssetContractResolver` instead of introducing agent-only presentation semantics.

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

## Direction 4 memory interaction with execution (Phase 3 completion note)

- Agent execution now carries a bounded working-memory snapshot through execution read models, including retrieved memory references, plan-asset references, and per-step execution-output summaries.

- Direction 4 Phase 4 now treats agent-targeted MCP tool calls as execution-native units (`mcp-tool-invocation`) via the existing execution plan seam and applies deterministic plan/execute-time governance checks against MCP registry/trust contracts (tool availability, permission/approval, sandbox, and basic schema expectations) without introducing a second orchestration path.
- Planner-side tool compatibility is now exposed through an explicit inner-layer selection seam (`AgentPlanToolSelectionService`), and MCP governance now returns deterministic decision classes (`allowed`, `approval-required`, `denied`, `unavailable`, `incompatible`) so both plan-time and pre-execution checks can reason about block/approval/failure behavior consistently.
- Phase 5 runtime now hardens execution-native streaming semantics through `AgentRunnerService`: deterministic event ordering across execution/session start, plan/governance/mapping milestones, per-step attempt start + completion/failure/cancel outcomes, retry schedule/exhaustion signals, memory persistence, session transition/persist boundaries, and terminal execution outcomes.
- Retry semantics are now explicit at the contract boundary (`AgentRuntimeRetryPolicy.classifyFailure` + execution-result metadata hints) rather than relying only on string heuristics, while still preserving bounded heuristic fallback when runtime metadata is absent.
- Terminal outcome truth is now explicit in persisted session contracts: session terminal state records `reason` (`completed`/`failed`/`cancelled`/`blocked`) and bounded partial-progress facts (completed vs attempted step counts + `hadPartialProgress`) so "partial success then terminal failure/cancel/block" is machine-readable without event replay.
- Runner/session lifecycle persistence now records the initial `pending` snapshot before `ready`/`running`, so transition history reads are complete and deterministic for debugging/audit surfaces.
- Agent execution session persistence now has a concrete SQLite infrastructure implementation (`SqliteAgentExecutionSessionRepository`) behind `IAgentExecutionSessionRepository`, including durable latest-session snapshots and transition history for debugging/observability readiness.
- SQLite session persistence now stores structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) in addition to canonical session JSON.
- Memory retrieval remains deterministic and asset/version-backed with bounded filtering (type, tags, metadata, `beforeTimestamp`) and policy-enforced exclusion of session-only memory types from durable retrieval.
- Memory writes from execution outcomes remain asset-backed and lineage-friendly, and policy now enforces writable/session-only constraints plus bounded durable retention capacity in practice.

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

That is "done enough" for Direction 1: the unified execution engine now includes at least one real dependency-aware multi-unit production path, execution capability claims are explicit, and durable history filtering is stronger for lineage/debugging/reporting without turning Direction 1 into a scheduler/analytics rewrite. The next likely architectural focus is Direction 2 work above this substrate rather than broadening Direction 1 into speculative orchestration.


## MCP registry and capability foundation (Direction 3, first slice)
- MCP tools now have a first-class registry foundation (install/register, list/detail, enable/disable, safe removal with dependency blocking, and explicit update preview/apply lifecycle use cases).
- Tool definitions now use a machine-readable capability contract that includes stable identity, display metadata, version, input/output schema, side-effect class, auth requirements, optional cost/execution metadata, tags/categories, and optional runtime binding (`serverId` + `toolName`).
- Registration validates definition contracts before persistence; runtime execution validates input/output contracts against installed definitions at the use-case boundary and refuses execution when the installed tool status is `disabled`.
- Update lifecycle now classifies transitions (`same-version`, `upgrade`, `downgrade`, `incomparable`) and actions (`reinstall`, `update`, `downgrade`, `replace`) explicitly instead of treating overwrite-install as the only path.
- Update preview surfaces a machine-readable change summary (version, binding identity, schemas, side effects, auth, tags/categories) plus compatibility risk (`compatible`, `risky`, `breaking`).
- Update apply performs bounded dependency safety checks: risky/breaking updates are blocked when dependent workflows reference the tool unless explicit override flags are supplied.
- Compatibility risk now uses bounded contract-depth heuristics (required-property deltas, property add/remove, type changes) and optional policy profiles (`strict`, `balanced`, `permissive`).
- Update flow now includes explicit acknowledgement gates for risky/breaking transitions and emits remediation suggestions suitable for UI/API preflight guidance.
- Installed-tool lifecycle metadata now includes durable lifecycle event history and dedicated read models for lifecycle summary/history inspection.
- Capability introspection query use cases now support bounded deeper semantics for future planner/agent selection: schema-path type checks (including array item paths), side-effect ceilings, explicit auth-kind filters, configurable tag/category match modes, and asset I/O filters (accepted/produced asset kinds, transform-vs-create mode, mixed raw+asset inputs, and explicit asset-version-required contracts).
- Safe removal now returns an explicit structured result (`removed` or `blocked`) with dependency references, so UI/adapters can render unsafe-removal state without exception parsing.
- MCP capability contracts now support optional `assetIo` declarations that model asset-backed inputs and asset-producing/asset-transforming outputs without removing support for raw-value tools, including explicit mixed-input flags, input version requirements, and output persistence semantics.
- MCP execution now has an optional asset-I/O seam that can resolve asset references before runtime invocation, enforce version-required input rules, persist MCP outputs as assets/versions with bounded idempotent persistence behavior, and emit transformation lineage records for reproducibility/provenance.
- Asset-output persistence is now enforced for installed tools that declare non-raw `assetIo.outputs`: execution fails fast when canonical asset persistence wiring is unavailable instead of silently returning loose payloads.
- Asset-aware execution now records both consumed input asset references and produced output assets in execution metadata so downstream projections can treat MCP runs as deterministic `asset -> execution/tool -> asset` provenance events.
- Raw-only behavior is now explicit and bounded: when `assetIo.allowsRawInputs` is `false`, undeclared raw input fields are rejected; when `assetIo.allowsRawOutputs` is `false`, missing declared asset outputs are treated as contract violations.
- Transformation-history reads for assets now have a canonical application seam (`GetAssetTransformationHistoryUseCase`) that uses repository-native asset-scoped queries when available and version-based fallback otherwise.
- Registry read models now include minimal marketplace-ready metadata (`description`, `author`, `version`, `categories`) as a normalized domain projection, so higher layers do not parse raw definition JSON.
- Metadata validation is now explicit and bounded in the MCP domain contract: required core fields remain strict, `description`/`author` are optional but bounded when provided, and categories are normalized (trimmed, lower-cased, deduped, stable order).
- Version normalization now removes optional leading `v` for semver-like values to stay aligned with existing lifecycle/update transition logic.
- MCP tool registry import/export now has two explicit machine-readable contracts:
  - `ai-loom.mcp-tools.v1` for installed-registry transfer (status/source/definition/lifecycle with overwrite controls).
  - `ai-loom.mcp-tool-definitions.v1` for shareable definition export/import flows (definition + source only; no runtime approvals/secrets/operational trust state).

## Direction 4 Phase 1 execution alignment
- Agent execution sessions now use execution-native lifecycle language (`pending/ready/running/completed/failed/cancelled`) via `domain/agents/AgentExecutionSession.ts`, with explicit transition/run-plan compatibility checks, canonical asset-based diagnostics, and timestamp coherence invariants.
- A compact mapping seam (`application/agents/contracts/AgentExecutionMapping.ts`) maps agent plan steps into `ExecutionPlan` units (`agent-tool-step`) and provides per-unit payload mapping so future agent execution flows through the same unified engine substrate.
- Agent roots expose explicit `toolAccess` beside policy and memory allows intentional zero-asset initialization while remaining canonically `AssetId`-typed once references are present.
- This does not add a second orchestration engine: it only establishes a durable contract for later planner/runner slices.

- Direction 4 planning now has an execution-native inner seam: validated `AgentPlan` step graphs (including dependencies, input references, expected outputs) map through `application/agents/contracts/AgentExecutionMapping.ts` into `ExecutionPlan` `agent-tool-step` units, proving future planner output routes into the same unified execution engine instead of a parallel agent runtime.
- Direction 4 Phase 3 now adds a memory substrate aligned to that same execution/planning seam:
  - retrieval is a typed application contract that returns asset-backed memory references (`application/agents/contracts/AgentMemoryRetrieval.ts`);
  - session working memory is a bounded domain object attached to agent plan/execution context (`domain/agents/AgentWorkingMemory.ts`);
  - write-back is a bounded application pipeline that normalizes execution outcomes into asset-backed memory references (`application/agents/services/AgentMemoryWriteService.ts`);
  - memory behavior is policy-shaped (`domain/agents/AgentMemory.ts`) rather than implicit.

## TODO

- Tool running, model/dataset runs, and the narrow MCP server-operation slice now share the same engine seam and persisted run model, but broader composition still has multiple roots. Further convergence should happen incrementally instead of through a giant rewrite.
- The interpreted fallback is clearly useful, but the product docs should eventually define which node types are expected to be fully trustworthy under scaffold execution versus only under delegated runtimes.
- Runtime documentation is now aligned with implemented Epic 6 seams through story 6.23; future updates should keep `.md`/`.ai.md` runtime sections in lockstep whenever runtime behavior changes.

## Direction 3 trust update: MCP auth/secrets and permission policy

The MCP execution path now includes explicit trust controls in the standard use-case flow:

1. Resolve installed-tool binding and status.
2. Validate input contract.
3. Resolve auth configuration through a dedicated secret-repository seam.
4. Evaluate explicit user approval state (pending/approved/denied/revoked per permission and trust scope).
5. Evaluate required permissions against installed-tool grants and request/runtime grants.
6. Evaluate explicit sandbox policy (network/filesystem/asset/environment posture).
7. Emit an execution audit decision event with non-secret payload.
8. Invoke runtime execution.

Auth, approval, permission, and sandbox denials are explicit structured outcomes (`missing-auth-configuration`, `invalid-credentials`, `auth-resolution-failed`, `approval-required`, `permission-denied`, `sandbox-denied`) instead of implicit runtime failures. Credential resolution now reports structured status (success/missing/partial/invalid/failed) so missing vs malformed states are handled deterministically.

Approval lifecycle actions are auditable (`approval-requested`, `approval-granted`, `approval-denied`, `approval-revoked`) and trust read models now expose machine-readable posture (required permissions, missing approvals, sandbox policy, and enforcement truthfulness metadata).

This slice enforces bounded sandbox policy in the application/runtime orchestration layer and truthfully distinguishes invocation-level enforced controls (network/filesystem/asset gating) from declared-only posture (environment exposure). It creates seams for future stronger process/OS sandboxing without claiming that hard isolation already exists.

Approval lifecycle is now complete and persisted per `(tool, permission, scopeType, scopeId)` with `pending` / `approved` / `denied` / `revoked` states, and execution enforces those records directly (no implicit grant fallback).

MCP execution trust flow is now deterministic across paths: contract validation -> credential resolution -> permission policy -> approval policy -> sandbox policy -> execution.

Sandbox contract now uses an explicit policy object (`network.allowed + allowlists`, `filesystem.allowed + read/write paths`, `assets.read/write`, `environment.allowedEnvVars`) and includes request-vs-policy posture for network (hosts/protocols), filesystem (read/write path sets), asset actions (read/write), and environment variable exposure; request overreach fails with `sandbox-denied`.

Trust read models are split for direct consumption (`getToolTrustState`, `getMissingApprovals`, `getEffectivePermissions`, `getSandboxPosture`) so callers do not reconstruct approval/sandbox logic manually.

Audit schema now records administrative approval transitions plus decision denials (`approval-required`, `permission-denied`, `sandbox-denied`) and execution allows (`policy-allowed`) with non-secret payloads only. Sandbox denials now include sanitized policy/context metadata for audit consumers.

## Direction 3 workflow-native update: MCP nodes inside workflow execution (stories 3.1–3.5)

- `mcp.tool_call` now behaves as a first-class workflow node across catalog, persistence, and execution surfaces, with stable registry-aligned node identity (`toolId`) in addition to server/tool binding and descriptor snapshot properties.
- MCP node configuration/hydration keeps identity and schema in sync: the node stores stable tool identity and materializes dynamic argument properties from MCP capability metadata so bindings remain machine-readable and execution-ready.
- MCP nodes execute through the same workflow execution engine/orchestration path as all other nodes; there is no parallel MCP mini-engine.
- Node-level MCP semantics are delegated to the existing standalone MCP execution use case (`ExecuteMcpToolUseCase`) when present, allowing workflow execution to reuse existing contract validation, auth/secrets, permission policy, audit, and optional asset-I/O coordination seams.
- Workflow MCP execution now forwards node `toolId` into MCP execution and enforces identity/binding consistency early (`toolId` must match requested `serverId`/`toolName` when registry state is available).
- MCP node argument binding follows native workflow input rules: constant node arguments (`arg.*` properties), upstream payloads (`arguments` input port), and asset-reference objects are merged into one validated MCP request payload.
- MCP execution failures now surface as structured node-level workflow failures (`outputs.mcpError` with bounded `code/category/details`) instead of opaque crashes, while preserving sanitized error messages for workflow-level reporting.
- Runtime-declared MCP execution failures are normalized into that same workflow error envelope, so node results now remain `success with output` **or** `failure with structured error`, never mixed.
- Workflow load/hydration no longer uses MCP-only persistence conditionals; dynamic MCP argument properties now restore through the same generic node-property hydration path, with MCP-specific expansion isolated behind the node configuration service seam.
- MCP node outputs now align with native workflow output contracts (`toolResult`, `resultText`) while preserving compatibility aliases to avoid breaking existing downstream nodes.

## Direction 4 update: agent execution placement (bounded first implementation)
- Agent planning/execution sits above the existing execution backbone; it does not introduce a second runtime.
- Planner output is a bounded ordered step plan (`toolId` + goal/action) that is executed through existing tool capability execution seams.
- For MCP steps, execution still flows through MCP execution use cases, preserving trust policy/auth/approval/sandbox/audit behavior.
- For workflow-projected tools, execution still flows through workflow tool execution (`RunToolUseCase` path).
- Agent memory writes/reads are asset-backed and versioned so execution outcomes can be persisted and reused by later planning.
- Retry classification remains bounded (`policy` override, result metadata hints, heuristic fallback), and retry exhaustion is explicitly surfaced as terminal failure state (`retryExhausted=true`) instead of implicit generic failure.
- Agent execution sessions now persist per-step outcome summaries (status/attempts/tool/output/error + optional output asset diagnostics), so partial completion followed by fail/cancel remains durable in session snapshots.
- Session transition history lookup is now part of the application repository contract (`IAgentExecutionSessionRepository.listTransitionHistory`) and not just an infrastructure helper.
- Current limits are intentional: deterministic single-agent planning, bounded step counts, no autonomous long-horizon control loop.

## Direction 4 Phase 7 contract foundation (stories 7.1–7.10, initial slice)
- Canonical launch now has an application use case (`LaunchAgentUseCase`) that loads authored agents from `IAgentRepository` and delegates execution to the existing `AgentRunnerService` runtime/session backbone.
- Launch request semantics are bounded by a transport-agnostic inner contract (`AgentRunRequest`) with deterministic validation for agent id, per-run input/context overrides, metadata, and trigger kind (`manual`/`backend`).
- Per-run binding is explicit (`createAgentRuntimeBinding`) and separates immutable authored configuration from per-run invocation data without mutating persisted agent config.
- Binding validation is now deterministic for malformed input/context objects and conflicting keys across `input` + `contextOverrides` (overlaps are rejected before execution).
- Runtime binding is now consumed by the canonical runner path: per-run input/context are attached to step invocation payloads and runtime metadata so launch-time overrides materially affect execution semantics.
- Session reads now have first-class inner use cases:
  - `GetAgentSessionDetailUseCase`
  - `ListAgentSessionsUseCase`
  with stable operational read models over persisted session truth (status, terminal reason, progress counts, transition history, retry/outcome summaries).
- Run control contracts are explicitly bounded through `ControlAgentRunUseCase`:
  - `cancel` is supported only for non-terminal lifecycle states (`pending`/`ready`/`running`) and persists truthful terminal transition state.
  - terminal sessions (`completed`/`failed`/`cancelled`) reject control with deterministic typed invalid-state errors.
  - unsupported actions (`pause`/`resume`) fail with explicit deterministic unsupported-control errors (never silent no-ops).
- New operational artifacts align with shared composition seams by classifying through `CompositionTaxonomyClassifier` (agent launch/session views avoid agent-only presentation semantics).
- Session summary/list/detail/control read surfaces now carry composition-aware classification (`execution-artifact`) and optional resolver-projected authored-agent contract context.
- Trigger-first invocation now has a bounded inner use case (`TriggerAgentLaunchUseCase`) that validates trigger-kind contracts and delegates to the same canonical launch path (no side runtime path).
- Launch/session operational projections now include bounded execution-progress, retry, outcome, memory-write, and output-asset summaries from canonical runner/session truth.
- Session-detail composition projection can now include resolver-backed authored-agent contract projection (`CompositionAssetContractResolver.resolveAgentContractById`) alongside execution-artifact taxonomy classification.
- Phase 8.1 backend integration now consolidates Agent Studio transport over one desktop backend seam (`infrastructure/api/agents/AgentStudioBackendApi.ts`), keeping authoring + runtime/session reads/control under one response envelope while reusing existing Phase 6/7 use cases and typed error semantics.
- `AgentStudioBackendApi` keeps agent-facing read models composition-native: authored-agent reads remain taxonomy-classified (`CompositionTaxonomyClassifier.classifyAgent`) and contract-projected (`CompositionAssetContractResolver.resolveAgentContractById`), and session/operational reads remain execution-artifact classified with optional authored-agent contract projection.
- Desktop IPC now exposes a coherent studio-ready operation set on the existing `ai-loom-desktop-agents:*` channel family (`launch`, `trigger-launch`, `list-sessions`, `get-session`, `control-run`, `studio-snapshot`) without introducing a parallel runtime path.
- Desktop host bootstrap now wires launch/trigger-launch to a real `AgentRunnerService` path (deterministic planner + tool capability orchestration + asset-backed memory store + session persistence), so launch endpoints are execution-backed rather than transport-declared unsupported operations.


## Workflow run history foundation (Epic 12 stories 12.1-12.4)
- Workflow observability now has a canonical workflow-run-history contract in `domain/workflow-studio/WorkflowRunHistoryDomain.ts`:
  - top-level run summary identity/status/trigger/timestamps
  - correlation ids linking workflow-run summaries to durable execution-run records (`executionRunId`, optional `workflowExecutionId`, optional `executionFlowId`)
  - explicit workflow-definition references and output references
  - explicit run-detail records (`WorkflowRunDetailRecord`) carrying step-run execution records, execution context, and structured output records.
- Application orchestration now records workflow-run summary lifecycle through `application/workflow-run-history/WorkflowRunHistoryService.ts` and lists summaries through `ListWorkflowRunSummariesUseCase`.
- Workflow execution integration remains on the existing execution backbone: `infrastructure/execution/WorkflowExecutionUnitHandler.ts` records run start/terminal summary lifecycle and now streams node/step runtime events into run-detail step-run updates (`recordStepEvent`) without introducing a second runtime path.
- Run detail now distinguishes list-facing summary and inspection-facing detail:
  - summary: `WorkflowRunSummaryRecord` + `stepRunStats`
  - detail: `WorkflowRunDetailRecord` with ordered step runs (status/timestamps/duration/error summary), structured execution input/trigger/runtime context, and structured top-level outputs.
- Persistence is now adapter-based and host-aware:
  - desktop/Node durability: `SqliteWorkflowRunSummaryRepository` (summary + detail tables with schema migration)
  - desktop renderer bridge path: `DesktopBridgeWorkflowRunSummaryRepository` + preload/IPC bridge methods for both summary and detail records
  - browser fallback: `LocalStorageWorkflowRunSummaryRepository` (separate summary/detail storage keys)
  - in-memory fallback for constrained environments.
- Epic 12 stories 12.5-12.6 now expose these same canonical run-history records in Workflow Studio through the shared studio-shell backend/service bridge:
  - workflow run list view with summary-first status/recency/duration/trigger fields and client-side sort/filter controls;
  - route-addressable run detail view (`/studio-shell/workflow/runs/:runId`) showing workflow-level metadata, execution summary, structured trigger context, and top-level outputs.
- Epic 12 stories 12.7-12.8 now extend that same canonical run-history surface (without introducing a separate observability subsystem):
  - run detail includes ordered step inspection with expandable per-step status/timing/input-output/error summaries sourced directly from persisted `stepRuns`;
  - run summaries/details now include structured diagnostics (category/severity/scope/location/summary/detail/remediation), and run list/detail present failure-location cues from those diagnostics.
- Epic 12 stories 12.9-12.10 now extend that same canonical run-history surface for iteration loops:
  - rerun and edit-and-rerun launch new execution instances from persisted historical execution context (never by mutating historical runs);
  - derived runs persist explicit lineage metadata (`parentRunId`, `rerunMode`, optional `rerunReason`) so related-run queries and UI projections stay deterministic;
  - edit-and-rerun starts from historical context, applies bounded user overrides before launch, and persists the final merged execution context on the new run detail record.
- Epic 12 stories 12.11-12.12 now harden observability as a first-class workflow path on the same canonical contracts:
  - workflow list/detail/completion surfaces now expose direct run-history/run-detail entry points instead of isolated observability-only navigation;
  - manual workflow launch results now return persisted run identity when run-history storage is available, enabling immediate completion-surface links to the exact run detail;
  - rerun/edit-and-rerun affordances now enforce terminal-state and historical-context prerequisites with explicit unsupported-state UX.

## Direction 5 update: Data Studio validation and execution integration (stories 18.13-18.14)
- Data Studio pipeline validation is now a first-class application seam (`application/data-studio/DataStudioPipelineValidation.ts`) with structured stage/pipeline/transition/graph diagnostics.
- Validation enforces required stages/configuration plus cross-stage constraints (source -> ingestion, extraction -> chunking, prepared-storage prerequisites) and transition-progression constraints for wizard/canvas authoring parity.
- Data Studio execution now runs through the unified execution backbone:
  - execution plan mapping + artifacts/provenance in `application/data-studio/DataStudioPipelineExecution.ts`,
  - run orchestration/readiness gating in `application/data-studio/DataStudioPipelineExecutionService.ts`,
  - execution-unit handling in `infrastructure/execution/DataStudioPipelineExecutionUnitHandler.ts`,
  - handler registration in shared execution infrastructure composition (`createExecutionInfrastructure*.ts`).
- Studio Shell now exposes backend-authoritative Data Studio readiness/run operations (`assessDataStudioExecutionReadiness`, `runDataStudioPipeline`) and toolbar-aligned renderer wiring (`run-data-pipeline`) while preserving workflow-specific semantics.


## AI Loom image manipulation runtime integration update (stories 3.3.9-3.3.10)

- Runtime output persistence now composes the existing image output-binding contracts/resolution/materialization seams directly inside workflow execution handling (post-success execution, pre-history completion) through `WorkflowExecutionUnitHandler` + `WorkflowRuntimeOutputPersistenceService`.
- Runtime execution output persistence remains adapter-bounded: workflow executors still return workflow-native assets, while the persistence seam maps assets into canonical image-record materialization contracts and writes through `SystemDatasetInstanceService`.
- Runtime result contracts now expose structured persistence summaries (`status`, `persistedRecordCount`, `targetCount`, `issues`) for downstream run-history and UI inspection without exposing repository/storage internals.
- Added test coverage validating runtime integration behavior for output/history/comparison dataset writes and bounded failure outcomes when resolution/materialization/persistence cannot complete.

## AI Loom image manipulation UI-trigger integration update (stories 4.2.9-4.2.10)

- UI-triggered execution now has reusable trigger wrappers/components in `ui/components/assets/image-system/WorkflowUiTriggerComponents.tsx` for:
  - workflow trigger buttons,
  - workflow-aware form submit wrappers,
  - image selection trigger surfaces.
- These wrappers stay adapter-first: they emit normalized `UiTriggerEvent` contracts and hand off via a dispatch adapter (`createWorkflowUiTriggerDispatchAdapter`) that composes the existing `WorkflowUiEventRuntimeDispatcher` path rather than calling workflow internals directly.
- System context gathering for UI-triggered runs is now a reusable mapping seam (`application/workflow-studio/UiTriggerSystemContextMapper.ts`) consumed by the dispatcher:
  - selected image context,
  - current form/runtime parameter values,
  - dataset references and dataset instance refs,
  - system-owned dataset instance refs,
  - lightweight runtime context references.
- Boundaries remain explicit and inspectable:
  - UI event generation (`UiTriggerEventContract` + trigger wrappers),
  - trigger binding resolution (`WorkflowUiTriggerEventAdapter` + image trigger binding config),
  - parameter/context mapping (`UiTriggerSystemContextMapper`),
  - workflow execution handoff (`WorkflowUiEventRuntimeDispatcher` -> `runWorkflowDraftTriggered`).

## AI Loom image manipulation update: system-context to input-binding adapters (stories 4.3.1-4.3.2)

- `UiTriggerSystemContextMapper` now maps trigger events into the shared `SystemContextContract` rather than directly emitting workflow-execution metadata objects.
- A dedicated workflow adapter seam (`WorkflowSystemContextBindingAdapter` in `application/workflow-studio/SystemContextWorkflowInputMapper.ts`) translates that contract into workflow execution context metadata/input values.
- `WorkflowUiEventRuntimeDispatcher` composes both seams (`UiTriggerSystemContextMapper` + `WorkflowSystemContextBindingAdapter`) so state gathering and workflow binding translation remain independently swappable.

## AI Loom image manipulation update: System Studio context extraction + contract validation (stories 4.3.3-4.3.4)

- Added a dedicated System Studio extraction seam (`application/workflow-studio/SystemStudioContextExtraction.ts`) that maps studio-facing state snapshots into normalized `SystemContextContract` objects.
- The extraction seam is workflow-agnostic and contract-first:
  - selected image state -> `selectedImages`,
  - parameter form state -> `parameters` (with lightweight normalization),
  - dataset selection/reference state -> `datasets`,
  - runtime/system metadata -> `runtime`.
- Added a UI adapter seam (`ui/components/assets/image-system/ImageSystemStudioContextAdapter.ts`) so image-system component state (`ImageInterfaceState`) is translated at the boundary and raw component structures do not leak into workflow/runtime contracts.
- Added `SystemContextValidationService` (`application/workflow-studio/SystemContextValidationService.ts`) to provide inspectable, reusable validation outputs for:
  - required context/parameter checks,
  - selected-image/media-structure checks,
  - dataset reference + schema-intent alignment checks,
  - workflow-input contract alignment through existing input-binding preview/resolution contracts.
- Validation results are structured for execution gating and UI/debug presentation (`valid`, `blockingIssues`, `warningIssues`, `issues`, normalized context, optional workflow binding preview).
