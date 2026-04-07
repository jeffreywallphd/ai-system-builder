# Deterministic Candidate Arbitration and Fair Tie-Breaking

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.3: Implement fair tie-breaking and deterministic arbitration across eligible candidates

## Purpose

Ensure scheduler arbitration stays deterministic and explainable when multiple candidate run/node pairs are equally policy-eligible. This prevents hidden dependence on incidental ordering from queue rows, repository row order, map iteration order, or node inventory ordering.

## Canonical implementation map

- Deterministic comparator and ranked arbitration reasons:
  - `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
- Policy evaluator integration with deterministic candidate ordering:
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- Regression coverage for deterministic ordering and tie-break explainability:
  - `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
  - `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`

## Deterministic arbitration behavior

Eligible candidates are ranked by one explicit comparator chain:

1. higher `rolePriorityScore`
2. higher `queueAgeSeconds`
3. lexical `runId`
4. lexical `nodeId`

The same comparator is reused for ordered candidate views and selected-candidate arbitration so deterministic behavior is centralized instead of duplicated across scheduler components.

## Explainability posture

Arbitration decisions surface `role-priority-arbitration` reasons with:

- `tieBreakOrder`
- `eligibleCandidateCount`
- `decisiveTieBreakStage`
- `topRankedCandidates`
- selected candidate metadata

This keeps equal-candidate outcomes explainable from decision artifacts without requiring source-level comparator inspection.

## Ordering hygiene and scope

- Candidate evaluation now normalizes run and node iteration order before rule evaluation.
- Decision payload candidate order is deterministic and comparator-backed.
- Arbitration does not depend on queue-row, node-list, or map insertion order.
- Current scope remains deterministic comparator-based selection (no randomized selection for this release).

## Verification baseline

- `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/runs/tests/SchedulingDeterministicArbitrationDocumentation.test.ts`
