# AI Companion: Scheduling Required-Capability and Basic Affinity Eligibility

## Story scope
Story 17.1.6 implements scheduler-side required-capability eligibility and basic affinity-aware candidate preference before arbitration.

## Human doc
- `docs/architecture/run-orchestration-scheduling-required-capability-affinity-eligibility.md`

## Implemented files
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/application/scheduling/use-cases/SchedulingPlacementAffinityPreference.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- `src/application/scheduling/tests/SchedulingPlacementAffinityPreference.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`

## Core delivery
- Keeps required-capability checks authoritative in scheduler evaluation output (`node-missing-capability` explainable denials).
- Adds a dedicated scheduler affinity-preference stage using `run.requirements.placementAffinity`.
- Filters eligible candidates to affinity matches when matches exist; otherwise falls back to all eligible candidates with explicit fallback reason.
- Preserves deterministic arbitration and keeps affinity support modular for future richer scoring/constraints.

## Supported affinity signals (basic scope)
- `preferredNodeIds`
- `preferredNodeTypes`
- `preferredDeploymentProfileIds`

## Explainability posture
- Emits reason-bearing policy artifacts:
  - `placement-affinity-preference-applied`
  - `placement-affinity-preference-unmet`
- Extends rule-pipeline summary details with `affinityPreferredCandidateCount`.

## Boundary posture
- Capability/affinity policy logic remains in `src/domain/scheduling/*` and `src/application/scheduling/*`.
- Queue claim mutation and dispatch execution remain downstream orchestration seams; no hidden adapter-failure dependence.
