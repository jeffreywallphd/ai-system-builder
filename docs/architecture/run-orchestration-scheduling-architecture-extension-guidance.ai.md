# AI Companion: Scheduling Architecture Baseline and Extension Rules

## Story scope
Story 17.1.8 documents the production scheduling architecture baseline, current rule limits, and extension workflow for future policy growth.

## Human doc
- `docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md`

## Canonical implementation anchors
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts`
- `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts`
- `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
- `src/application/scheduling/use-cases/SchedulingPlacementAffinityPreference.ts`
- `src/application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts.ts`
- `src/application/scheduling/use-cases/SchedulingDecisionOutcomeCapture.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`

## Architecture baseline summary
- Scheduling input assembly and policy evaluation are explicitly separated from assignment claim materialization and backend dispatch execution.
- Policy evaluation is ordered-rule based, explainable, and deterministic for current production role-priority behavior.
- Basic affinity preference applies after eligibility rules and before final arbitration.
- Decision bundles and reason summaries are the canonical output artifacts for orchestration and diagnostics.

## Current production limits
- One assignment intent at most per decision pass.
- No enforced quota policy yet.
- No reservation calendar-window policy yet.
- No rich resource/cost/fairness arbitration yet.
- Deployment profile is metadata + basic affinity matching only.

## Extension rules
- Add new policy checks as `ISchedulingPolicyRule` implementations and compose them in ordered pipeline construction.
- Add richer scoring through `ISchedulingCandidateScorePolicy` rather than transport/adapter heuristics.
- Keep policy logic out of UI, transport handlers, persistence adapters, and backend dispatch adapters.
- Update shared scheduling contracts/schemas whenever new policy evidence must cross boundaries.

## Non-negotiable prohibitions
- Embedding policy in UI or backend adapters is prohibited.
- Writing dispatch attempts directly from scheduling modules is prohibited.
