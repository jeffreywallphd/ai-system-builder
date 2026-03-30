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
- Direction 5 Epic 6 stories 6.17–6.18 now keep system-runtime execution read integration bounded and version-aware:
  - runtime executions are projected into registry system-detail read models as recent execution summaries (status/result/timestamps plus bounded trace-reference counts),
  - registry remains read-only (no runtime command surface),
  - execution planning/orchestration enforces version-pinned component references and records executed version maps on runtime status/result APIs for truthful lineage and reproducibility.
- Direction 5 Epic 6 stories 6.19–6.20 now add bounded runtime durability + nested execution truth without creating a second runtime stack:
  - system-runtime execution records are persisted as runtime-scoped metadata snapshots (execution/root identity, status, bounded trace/result summaries, environment/version maps, timestamps, and parent/child execution linkage),
  - desktop host wiring now uses a SQLite-backed system-runtime execution store instead of in-memory-only run state,
  - nested system components execute recursively through the same orchestration service (parent node -> child execution), and parent run outputs/metadata carry child execution ids for monitor/detail linkage,
  - this remains bounded (cycle/depth safeguards stay in dependency/plan recursion seams; no replay/event-sourcing platform introduced).
- Direction 5 Epic 6 story 6.23 now adds bounded runtime hardening on the same seams:
  - orchestration enforces bounded trace/log/error/progression retention,
  - runtime start requests validate depth/iteration/planning/retention bounds with deterministic invalid-request failures on pathological values,
  - in-memory and SQLite runtime execution stores prune oldest records on capacity overflow,
  - no distributed scheduler/queue/observability architecture is introduced.
- Direction 5 Epic 7 stories 7.15–7.16 now keep external system invocation + audit truth on the same runtime seams:
  - external API/tool invocation now supports nested system-of-systems execution as a first-class runtime path (no separate nested runtime), with bounded parent/child execution lineage summaries surfaced on start/status/result read models,
  - external invocation lineage remains version-aware (root + child version ids) and preserves existing auth/access/quota/tenant/session bounds,
  - execution audit is now a separate durable trail (requested/accepted/completed/failed) capturing caller, tenant, request source, system/version, and execution/session identity with bounded nested-child attribution,
  - audit trail remains distinct from runtime trace/log streams and asset-version history (no broad compliance analytics subsystem added).

- Direction 5 Epic 7 stories 7.17–7.18 now add bounded external-boundary resilience controls on the same seams:
  - external start/invocation paths now apply explicit external retry classification (retryable transport/internal failures only) with bounded attempts,
  - idempotent replay protection at external start boundary reuses execution identity for repeated idempotency-key requests instead of creating duplicate runs,
  - callback delivery retries are bounded by callback registration max-attempts and audited as retry-attempted/retry-exhausted outcomes,
  - external entrypoint rate limiting is evaluated centrally at runtime API boundaries (caller/tenant/source-operation windows), remains distinct from execution quotas, and returns structured `rate-limit-exceeded` errors.

- Direction 5 Epic 7 stories 7.23–7.24 now align external-runtime performance safeguards + docs truth on the same seams:
  - external hot paths keep one runtime stack and remain auth/access/quota/rate-limit/tenant/version aware (no parallel runtime path),
  - external status/poll read pressure is reduced through short-lived caller/tenant-scoped response caching on backend hot paths (bounded, correctness-preserving, non-distributed),
  - callback/stream pressure now has explicit bounded guards (max callback registrations per session, max stream subscriptions, max listeners per event, bounded emit cadence),
  - async external run tracking has explicit in-flight bounds and terminal cleanup to avoid runaway map growth under bursty external traffic,
  - docs (`.md` + `.ai.md`) now explicitly distinguish implemented vs bounded vs future external-runtime behavior for stories 7.1–7.24.

## Workflow Studio draft planning seam
- Workflow Studio now has a canonical draft-to-plan mapper in `application/workflow-studio/WorkflowDraftExecutionPlanMapper.ts`.
- `mapWorkflowDraftToExecutionPlan(...)` validates canonical draft integrity first (`validateWorkflowDraft`) and then emits deterministic ordered execution-plan elements for action steps and built-ins (`if-then`, `loop-iteration`, `delay-wait`, `manual-approval`) plus normalized ordered output plans.
- Execution alignment contracts are now explicit in `application/workflow-studio/WorkflowExecutionAlignmentContracts.ts` (execution request/context, trigger handoff, step sequencing metadata, input/output bindings, and validation-boundary result contracts).
- Workflow-to-execution translation now runs through `application/workflow-studio/WorkflowDefinitionExecutionPlanTranslator.ts`; `WorkflowDraftExecutionPlanMapper.ts` is a compatibility export seam over that translator so canonical workflow-draft semantics stay single-sourced.
- Output planning now fails before runtime when output contracts are unsupported or incompatible with execution planning (for example unknown destination types, output-type mismatches, or unsupported formats), instead of silently deferring these failures to runtime.
- This mapper is planning-only: it creates explicit runtime-ready plan elements without adding a second runtime executor or speculative graph model.
- Stories 6.11–6.12 now extend that same seam into runtime + persistence behavior without introducing alternate draft models:
  - `application/workflow-studio/WorkflowDraftExecutionRuntime.ts` executes mapped built-in plan elements deterministically (branch, loop, delay, manual-approval) and records explicit completed/skipped/failed/paused step traces.
  - `WorkflowStudioApplicationService.executeWorkflowDraft(...)` now routes canonical draft content through `deserialize -> plan mapper -> runtime executor` on the same workflow-studio contracts.
  - Built-in workflow drafts continue to persist as canonical serialized draft content and now have explicit persistence/rehydration coverage for built-in type/config/order round-trip in SQLite-backed studio-shell flows.
- Trigger execution readiness mapping is now explicit but bounded through `application/workflow-studio/WorkflowTriggerRuntimeMapper.ts`, which projects canonical trigger definitions/config (manual/user, temporal, state) into runtime-facing descriptors without introducing a scheduler engine or trigger-side execution path.
- State runtime descriptors now include explicit event semantics (`sourceType`, `eventCategory`, `subject`, and optional criteria/filter metadata) so runtime mapping is planning-ready without adding an event-bus execution engine.
- Trigger correctness now uses a shared validation pipeline (`validateWorkflowDraftTriggers` and `application/workflow-studio/WorkflowTriggerValidationPipeline.ts`) for per-trigger config validation plus workflow-level trigger checks before runtime mapping.
- Stories 7.11â€“7.12 now route trigger semantics through the same draft execution-plan seam: `mapWorkflowDraftToExecutionPlan(...)` carries trigger execution metadata produced by `application/workflow-studio/WorkflowDraftTriggerExecutionPlanner.ts` (manual/user invocation semantics, temporal schedule metadata, state-event metadata).
- Trigger planning consumes canonical validated draft triggers and fails safely when unsupported/invalid trigger semantics reach planning (no silent trigger dropping).
- Execution-plan trigger semantics remain continuation-ready (`workflow-start` + `workflow-continuation`), so future human-approval resume/intermediate continuation behavior is not blocked by start-only assumptions.

- Pre-execution readiness validation is now a first-class canonical seam (`application/workflow-studio/WorkflowPreExecutionValidationPipeline.ts`) and runs before manual launch: authored workflow validation, pre-execution asset-version reference checks, and translation readiness are returned in one structured boundary result.
- Manual Workflow Studio run now uses that same canonical flow through desktop/backend contracts (`StudioShellBackendApi.runWorkflowDraft` -> `WorkflowStudioApplicationService.runWorkflowDraftManual`) instead of UI-local execution logic: validate readiness -> translate canonical plan -> launch through runtime executor.
- Workflow Studio launch feedback is now backend-authoritative (validation summary/issues + launch status projection), while wizard/canvas remain shared-draft authoring surfaces only.

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
- Keep runtime docs aligned with implementation: when runtime seams or bounds change, update both `.md` and `.ai.md` architecture docs in the same change.

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
- Phase 8.1 backend integration now unifies Agent Studio transport through `infrastructure/api/agents/AgentStudioBackendApi.ts`, reusing Phase 6 authoring and Phase 7 runtime/session use cases under one deterministic response/error contract.
- Agent Studio backend reads remain composition-native: authored-agent payloads are taxonomy-classified and contract-projected; session/operational payloads stay execution-artifact classified with optional authored-agent contract projection.
- Desktop IPC now includes studio-facing operations on the existing `ai-loom-desktop-agents:*` namespace (`launch`, `trigger-launch`, `list-sessions`, `get-session`, `control-run`, `studio-snapshot`) without creating a second runtime or launch path.
- Desktop host wiring now provides a real runner-backed launch path (planner + capability execution + asset-backed memory + session persistence), so studio launch/trigger-launch are execution-backed operations in desktop mode.
