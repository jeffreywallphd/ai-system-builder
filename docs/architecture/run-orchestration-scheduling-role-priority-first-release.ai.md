# AI Companion: Role-Priority Scheduling Rules for First Production Release

## Story scope
Story 17.1.4 makes role-priority scheduling arbitration explicit, deterministic, and visible in policy decision outputs.

## Human doc
- `docs/architecture/run-orchestration-scheduling-role-priority-first-release.md`

## Implemented files
- `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`

## Core delivery
- Introduces a dedicated role-priority arbitration module so selection logic is explicit and replaceable.
- Keeps deterministic candidate selection ordering in one canonical comparator chain.
- Surfaces role-priority arbitration as a reason-bearing decision artifact.
- Preserves predictable fallback ordering for non-privileged runs.

## Deterministic ordering
Eligible candidates are selected by:
1. role-priority score
2. queue age
3. run ID
4. node ID

## Visibility output
- Adds `role-priority-arbitration` decision reasons with tie-break metadata and selected candidate details.
- Reason payloads flow through `SchedulingDecisionBundle` and shared scheduling evaluation projections.

## Boundary posture
- Policy/arbitration logic remains in `src/application/scheduling/*`.
- No policy logic moved into transport handlers, persistence adapters, or dispatch adapters.

## Future extension
Use this arbitration seam for future additive policy influences (quota, reservation windows, affinity, deployment overlays) while preserving explainable output contracts.
