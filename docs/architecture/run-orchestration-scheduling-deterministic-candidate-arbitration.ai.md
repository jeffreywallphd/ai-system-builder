# AI Companion: Deterministic Candidate Arbitration and Fair Tie-Breaking

## Story scope
Story 17.2.3 hardens authoritative scheduler arbitration so tie-breaking stays deterministic, centralized, and operationally explainable across equal-eligibility candidates.

## Human doc
- `docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md`

## Implemented files
- `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`

## Core delivery
- Centralizes deterministic run/node arbitration through one explicit comparator chain.
- Normalizes candidate ordering before and after policy evaluation to avoid incidental input-order drift.
- Expands arbitration decision reasons with ranked-candidate visibility and decisive tie-break stage.
- Adds regression tests that prove equivalent outcomes when run/node source ordering is shuffled.

## Deterministic ordering
Scheduler candidate ranking remains:
1. `rolePriorityScore` descending
2. `queueAgeSeconds` descending
3. `runId` lexical ascending
4. `nodeId` lexical ascending

## Explainability output
- `role-priority-arbitration` reason details now include:
  - `tieBreakOrder`
  - `eligibleCandidateCount`
  - `decisiveTieBreakStage`
  - `topRankedCandidates`
  - selected candidate metadata

## Boundary posture
- Arbitration and ranking logic remain in `src/application/scheduling/*`.
- Queue persistence, transport handlers, and dispatch adapters do not own tie-break behavior.
- This story keeps deterministic comparator arbitration (no randomization/seed flow added).
