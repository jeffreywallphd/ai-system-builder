# Run Orchestration Scheduling Required-Capability and Basic Affinity Eligibility

## Story scope

Story 17.1.6 adds scheduler-side required-capability eligibility enforcement and a basic affinity-preference stage so authoritative scheduling filters obvious mismatches before placement and dispatch preparation.

## Why this slice exists

- Capability mismatches should be rejected by authoritative scheduling policy, not discovered later by backend dispatch adapters.
- Basic placement affinity should influence candidate handling now, while preserving a clean seam for richer affinity scoring/policies later.

## Implemented files

- `src/domain/scheduling/SchedulingDomain.ts`
- `src/application/scheduling/use-cases/SchedulingPlacementAffinityPreference.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- `src/application/scheduling/tests/SchedulingPlacementAffinityPreference.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`

## Policy behavior added

### Required-capability eligibility (authoritative)

- Scheduler candidate eligibility continues to enforce `run.requirements.requiredCapabilities` against `node.enabledCapabilities`.
- Ineligible node candidates are explicitly marked with `node-missing-capability` denial reasons before arbitration.
- Placement selection consumes only scheduler-evaluated eligibility output.

### Basic affinity-aware preference stage

- Scheduler now evaluates optional `run.requirements.placementAffinity` signals:
  - `preferredNodeIds`
  - `preferredNodeTypes`
  - `preferredDeploymentProfileIds`
- Affinity evaluation runs after eligibility gating and before arbitration.
- When at least one eligible candidate matches affinity constraints for a run, non-matching eligible candidates for that run are filtered out of arbitration.
- When no eligible candidates match affinity constraints, scheduler falls back to all eligible candidates for that run and records explicit fallback reasoning.

## Explainability and extension seam

- Decision reasons now include:
  - `placement-affinity-preference-applied`
  - `placement-affinity-preference-unmet`
- Rule-pipeline summary metadata includes `affinityPreferredCandidateCount` alongside raw eligible-candidate counts.
- This keeps a clean extension seam for future weighted affinity scoring, reservation overlays, and profile-specific policy modules without changing dispatch ownership boundaries.

## Boundary posture

- Eligibility + affinity preference remain in scheduling domain/application policy seams.
- Queue claim mutation and backend dispatch remain downstream orchestration responsibilities.
- No capability or affinity policy logic moved into transport, persistence adapters, or dispatch adapters.
