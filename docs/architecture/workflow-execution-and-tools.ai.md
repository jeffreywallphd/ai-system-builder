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

## MCP trust and governance foundation (Direction 3 stories 4–5)
- MCP tool execution now enforces a structured trust pipeline in the standard execution path:
  1. installed tool lookup/binding
  2. installed status + contract checks
  3. auth credential resolution through secret-repository/auth-service seam
  4. user approval decision (pending/approved/denied/revoked per permission + trust scope)
  5. permission policy decision (required scopes vs granted scopes)
  6. sandbox policy decision (network/filesystem/asset/environment posture)
  7. execution audit event emission (allow/deny/administrative, non-secret payload)
  8. runtime execution
- Permission denials and auth misconfiguration now use structured errors instead of implicit fallback behavior.
- Missing/denied approvals now use structured `approval-required` denials; sandbox policy denials use structured `sandbox-denied` errors.
- Approval/revocation actions are now auditable events (`approval-requested` / `approval-granted` / `approval-denied` / `approval-revoked`) to keep trust lifecycle history machine-readable.
- Trust read-model seams now expose effective trust posture for a tool (required permissions, approval gaps, sandbox policy, and enforcement truthfulness metadata).
- Secret values are resolved only at execution boundary and are intentionally excluded from ordinary installed-tool projections and audit payloads.
- Credential resolution now returns structured status (`success`/`missing`/`partial`/`invalid`/`failed`) so execution can distinguish missing vs malformed configuration and map to consistent auth error classes.
- Sandbox truthfulness is explicit: network/filesystem/asset controls are invocation-level enforced policy gates; environment exposure is currently declared-only posture metadata (not hard runtime isolation).
- Approval lifecycle is now complete and persisted per `(tool, permission, scopeType, scopeId)` with `pending` / `approved` / `denied` / `revoked` states, and execution enforces those records directly (no implicit grant fallback).
- MCP execution trust flow is now deterministic across paths: contract validation -> credential resolution -> permission policy -> approval policy -> sandbox policy -> execution.
- Sandbox contract now uses an explicit policy object (`network.allowed + allowlists`, `filesystem.allowed + read/write paths`, `assets.read/write`, `environment.allowedEnvVars`) and evaluates request-vs-policy posture for network (hosts/protocols), filesystem (read/write path sets), asset actions (read/write), and environment variable exposure; request overreach fails with `sandbox-denied`.
- Trust read models are split for direct consumption (`getToolTrustState`, `getMissingApprovals`, `getEffectivePermissions`, `getSandboxPosture`) so callers do not reconstruct approval/sandbox logic manually.
- Audit schema now records administrative approval transitions plus decision denials (`approval-required`, `permission-denied`, `sandbox-denied`) and execution allows (`policy-allowed`) with non-secret payloads only; sandbox decisions include sanitized policy/context snapshots.

## MCP workflow-native node integration (Direction 3 stories 3.1–3.5)
- `mcp.tool_call` is now treated as a first-class workflow node in the standard node catalog/definition/persistence surfaces, including a stable `toolId` property (`mcp:<serverId>:<toolName>`) alongside server/tool binding and descriptor snapshot fields.
- Authoring hydration/configuration keeps node identity registry-aligned (`toolId`), materializes dynamic argument properties from the installed/discovered tool contract, and keeps argument serialization machine-readable for future editor flows.
- Workflow execution uses the same interpreted workflow engine path as other nodes; MCP node orchestration stays in the workflow engine while MCP execution semantics are delegated to `ExecuteMcpToolUseCase` when available.
- This means workflow MCP execution can reuse the existing MCP enforcement pipeline (status checks, contract validation, auth/secret resolution, permission policy, audit, and optional asset-I/O coordination) instead of duplicating runtime semantics inside the node executor.
- Workflow MCP execution now forwards stable node identity (`toolId`) to the MCP execution use case and fails early if the stable identity and runtime binding (`serverId`/`toolName`) diverge.
- MCP node inputs follow standard workflow binding semantics: configured constants (`arg.*` node properties), upstream graph payloads (`arguments` input port), and asset reference payloads can be merged into one validated MCP argument object.
- MCP node failures now always degrade into structured node-level failure outputs (`outputs.mcpError`) with bounded category/code/detail payloads (including runtime-declared failures and availability/precondition failures), so workflow-level results/events can surface useful diagnostics without opaque crashes.
- Workflow persistence hydration no longer needs MCP-only load branches; dynamic MCP argument properties are restored through the same node property hydration pass used for all nodes, with MCP-specific expansion isolated behind the node configuration service seam.
- MCP outputs now expose workflow-consistent node outputs (`toolResult`, `resultText`) while preserving compatibility aliases used by existing downstream consumers.
- For installed MCP tools that declare non-raw `assetIo.outputs`, canonical asset persistence is now mandatory: execution fails if asset-I/O coordination is not configured.
- Asset-aware MCP execution metadata now carries consumed input asset references and produced output assets, making provenance queries deterministic for `asset -> execution/tool -> asset` chains.
- Raw bypass behavior is explicit and bounded: `allowsRawInputs=false` rejects undeclared raw fields; `allowsRawOutputs=false` rejects executions that omit declared asset outputs.
- Asset transformation history now has a canonical read seam (`GetAssetTransformationHistoryUseCase`) with repository-native asset-level querying plus version-based fallback.
- Installed-tool read models expose minimal marketplace-ready metadata (`description`, `author`, `version`, `categories`) via a normalized metadata projection so upper layers do not parse raw definition records.
- MCP definition normalization/validation now enforces bounded metadata rules (`description`/`author` optional but bounded, categories normalized/deduped, semver-like `v` prefix normalization for lifecycle consistency).
- Local-first MCP sharing now has explicit dual contracts:
  - `ai-loom.mcp-tools.v1` for installed-registry transfer (status/source/definition/lifecycle + overwrite semantics).
  - `ai-loom.mcp-tool-definitions.v1` for shareable definitions (definition + source only), explicitly excluding runtime-only trust/approval/secret state.

## Direction 4 Phase 1 execution alignment
- Agent execution sessions now use execution-native lifecycle states in `domain/agents/AgentExecutionSession.ts` (`pending/ready/running/completed/failed/cancelled`), with explicit transition guards, run-plan compatibility checks, canonical asset-based diagnostics, and start/end-time coherence checks.
- `application/agents/contracts/AgentExecutionMapping.ts` maps agent steps into unified `ExecutionPlan` units (`agent-tool-step`) and exposes per-unit payload contracts to keep Direction 4 on the shared execution backbone.
- Agent roots expose explicit `toolAccess` beside policy, and memory configuration intentionally allows zero-asset initialization while preserving canonical `AssetId` typing for any references.
- This is a contract slice only (no second runtime, no autonomous loop in Phase 1).

## TODO
- If asked whether tools and workflows are separate bounded contexts, answer: "not really; tools are primarily a projected and published workflow surface in the current implementation."
- If asked what should migrate next, answer: execution areas that still cannot report real progress/cancellation truthfully yet, especially MCP/runtime-backed orchestration beyond the current narrow server-operation slice.
- If asked whether Direction 1 is finished, answer: "done enough that the execution substrate is no longer the obvious bottleneck; the next focus should likely move to Direction 2 unless a new truthful runtime-backed slice is clearly ready."

## Direction 4 update: agent execution placement (bounded first implementation)
- Agent planning/execution sits above the existing execution backbone; it does not introduce a second runtime.
- Planner output is a bounded ordered step plan (`toolId` + goal/action) that is executed through existing tool capability execution seams.
- For MCP steps, execution still flows through MCP execution use cases, preserving trust policy/auth/approval/sandbox/audit behavior.
- For workflow-projected tools, execution still flows through workflow tool execution (`RunToolUseCase` path).
- Phase 6.5 tool authoring is now explicitly structured on `AgentPolicy.toolAccess` (no second tool-config model): allowed tool ids must be canonical, optional MCP bindings must match canonical MCP identity and allowed ids, and per-tool scope constraints must target allowed tools with non-empty canonical scope ids.
- Agent memory writes/reads are asset-backed and version-aware so execution outcomes can be persisted and reused by later planning.
- Phase 6.6 memory authoring stays asset-native on `AgentMemoryConfiguration`: asset references/retrieval/writable/retrievable/session-only/retention combinations are validated as one coherent contract so planner/runtime consumers can use the shape directly.
- Any new agent-facing artifact/read model added around tools or memory must still go through shared composition seams (`CompositionTaxonomyClassifier` classification or `CompositionAssetContractResolver` projection), not agent-only presentation contracts.
- Phase 3 completion now includes deterministic memory retrieval filters (type/tag/metadata/recency), bounded working-memory snapshots on execution read models, and retention-gated durable writes.
- Phase 5 now emits deterministic execution-native runtime events (execution/session start, plan/governance/mapping, per-attempt step lifecycle, retry schedule/exhaustion, memory/session persistence, terminal outcome) with no UI/WebSocket runtime added.
- Retry classification is explicit and bounded (`AgentRuntimeRetryPolicy.classifyFailure` + optional execution-result metadata hints), with heuristic fallback only when runtime metadata is absent.
- Retry exhaustion is now terminally explicit on failures (`retryExhausted=true`), so final failure read models distinguish "retryable class but exhausted policy budget" from "non-retryable failure."
- Session terminal truth is now explicit and persisted: terminal state includes `reason` (`completed`/`failed`/`cancelled`/`blocked`) plus bounded partial-progress summary (`hadPartialProgress`, completed/attempted step counts), so blocked-before-step and partial-then-terminal outcomes stay machine-readable.
- Session persistence now records lifecycle from initial `pending` through `ready`/`running` and terminal states, so transition-history reads are complete rather than terminal-only.
- Agent execution sessions now persist per-step outcome summaries (status/attempts/tool/output/error + optional output asset diagnostics), so partial success followed by terminal fail/cancel remains durable and queryable.
- Session persistence is now a real SQLite infrastructure seam (`SqliteAgentExecutionSessionRepository`) that stores both latest session snapshots and transition history under the existing repository port.
- SQLite session persistence now also stores structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) for API/debug filtering without JSON parsing.
- Session transition history lookup is now part of the application repository contract (`IAgentExecutionSessionRepository.listTransitionHistory`) instead of an infrastructure-only helper method.
- Current limits are intentional: deterministic single-agent planning, bounded step counts, no autonomous long-horizon control loop.
