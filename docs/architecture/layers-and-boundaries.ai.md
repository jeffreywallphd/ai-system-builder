# AI Companion: Layers and Boundaries

## Fast boundary map
- `domain/` = business rules only
- `application/` = use cases + ports
- `infrastructure/` = port implementations + composition
- `ui/` = React pages/components/stores/services
- `electron/` = desktop host/bootstrap/bridges

## Key evidence files
- Domain aggregate: `domain/workflows/Workflow.ts`
- Domain validation: `domain/services/WorkflowValidator.ts`
- Application port: `application/ports/interfaces/IWorkflowRepository.ts`
- Application orchestration: `application/workflows/ExecuteWorkflowUseCase.ts`
- Infrastructure repo: `infrastructure/filesystem/LocalWorkflowRepository.ts`
- UI convenience orchestration: `ui/services/WorkflowService.ts`, `ui/services/NodeService.ts`

## Important nuance
The architecture is mostly clean, but not all write actions are modeled as application use cases. Some stay in UI services as domain-object convenience operations.

## Direction 4 boundary note (Phase 1)
- Agent meaning/rules live in `domain/agents/` (goals, policies, asset-backed memory config, execution sessions).
- Agent-to-runtime mapping lives in `application/agents/contracts/AgentExecutionMapping.ts` and targets `ExecutionPlan` units.
- No agent UI/runtime bypass was introduced in this phase.
- Phase 3 memory services now enforce policy operationally at the same inner layers (retrievable/writable/session-only/retention checks), still asset-backed and without a second storage/runtime model.
- Phase 5 runtime semantics are still application-layer (`AgentRunnerService`) with deterministic progress/retry/session events; persistence remains an application port (`IAgentExecutionSessionRepository`) with a concrete SQLite infrastructure implementation.
- Phase 5 session persistence now includes durable per-step outcomes and transition-history reads via the same application port, keeping retry/partial-execution truth in the inner contract instead of transport-specific projections.
- Phase 6 authoring now has an explicit persistence/application seam split:
  - persistence ports: `IAgentRepository`, `IAgentExecutionSessionRepository`
  - infrastructure adapters: `SqliteAgentRepository`, `SqliteAgentExecutionSessionRepository`
  - application use cases: CRUD + bounded configuration updates (`goals`, `policy`, `tools`, `memory`, `strategy`) plus whole-config validation (`AgentConfigurationValidationService`).
  - goal authoring updates (`add`/`update`/`remove`/`reorder`) now enforce deterministic coherence (unique ids, canonical required tool refs, contiguous ordering from 1, explicit missing-goal failures) at the application/domain boundary.
  - memory configuration updates are now explicitly validated for asset-native references, retrieval compatibility, writable/retrievable/session-only coherence, and retention contradictions before persistence.
  - strategy configuration is now explicitly bounded to supported descriptors (deterministic id/mode only in this slice); unsupported strategy combinations are rejected deterministically.
  - whole-agent validation issues now include machine-friendly sectioning (`goals`/`tools`/`memory`/`strategy`/etc.) and are reusable across CRUD/configuration/API via `AgentConfigurationValidationError`.
  - desktop backend transport now exposes thin agent-authoring IPC handlers (`ai-loom-desktop-agents:*`) that delegate to authoring use cases instead of re-implementing domain/application rules in transport.

## TODO
- When summarizing purity/impurity, say "clean-architecture-style with pragmatic UI-layer convenience logic," not "strict clean architecture."
