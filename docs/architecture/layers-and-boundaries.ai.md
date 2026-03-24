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

## TODO
- When summarizing purity/impurity, say "clean-architecture-style with pragmatic UI-layer convenience logic," not "strict clean architecture."
