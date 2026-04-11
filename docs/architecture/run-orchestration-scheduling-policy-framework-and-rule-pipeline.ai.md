# AI Companion: Scheduling Policy Framework and Rule-Pipeline Evaluation

## Story scope
Story 17.1.3 adds the initial application-layer scheduling policy framework with ordered, pluggable rule evaluation.

## Human doc
- `docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md`

## Implemented files
- `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts`
- `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`

## Core delivery
- Adds explicit rule/scoring contracts for scheduling policy evaluation.
- Adds an ordered rule-pipeline evaluator with baseline modular production rules.
- Adds a policy evaluator use case that returns canonical `SchedulingDecisionBundle` outputs.
- Adds a decision-pipeline use case that composes input assembly and policy evaluation behind established application contracts.
- Keeps policy evaluation explainable through reason-bearing candidate outcomes and policy-level rule-order metadata.

## Baseline modular rules
- node schedulability
- required capability checks
- remote scheduling support checks
- hybrid node local interactive-use protection
- reservation owner conflict protection

## Deterministic arbitration
- Eligible candidates are selected by:
  - role-priority score
  - queue age
  - run ID
  - node ID
- This preserves the near-term role-priority posture while remaining extension-ready.

## Boundary posture
- Policy logic now lives in `src/application/scheduling/use-cases/*` + `src/application/scheduling/ports/*`.
- Policy logic must not be implemented in transport handlers, persistence adapters, UI layers, or backend dispatch adapters.

## Future policy extension
Add quotas, reservation windows, affinity constraints, deployment-profile overlays, and richer arbitration by introducing new `ISchedulingPolicyRule` implementations and composing them into the rule pipeline.

## Related ADRs
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md`
