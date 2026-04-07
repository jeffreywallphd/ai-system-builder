# Role-Priority Scheduling Rules for First Production Release

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.4: Implement role-priority scheduling rules for the first production release

## Purpose

Make role-priority treatment explicit and auditable in authoritative scheduling outcomes while preserving deterministic fallback behavior for non-privileged runs and clear seams for future policy layers.

This story builds on the scheduling policy rule framework and introduces an explicit role-priority arbitration module that:

- deterministically selects from eligible candidates
- documents tie-break sequence in one place
- surfaces role-priority arbitration in decision reasons for operational visibility

## Canonical implementation map

- Role-priority arbitration module
  - `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
- Scheduling policy evaluator integration
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- Regression tests for arbitration behavior and visibility
  - `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
  - `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`

## First-release role-priority rule posture

Eligible candidates are ordered by this canonical tie-break chain:

1. higher `rolePriorityScore`
2. higher `queueAgeSeconds`
3. lexical `runId`
4. lexical `nodeId`

Role-priority still derives from workspace roles through canonical scheduling domain policy (`owner` > `admin` > `member` > `viewer`).

## Operational visibility and auditability

Role-priority arbitration is surfaced as an explicit decision reason:

- reason code: `role-priority-arbitration`
- reason details include:
  - tie-break order used
  - eligible candidate count
  - selected run/node and selected candidate priority metadata

Because these reasons flow through `SchedulingDecisionBundle` and `SchedulingPolicyEvaluationResult`, arbitration posture is visible to scheduling diagnostics/operational consumers and is not implicit in only internal comparator behavior.

## Deterministic fallback for non-privileged runs

When role-priority ties (for example, mixed member-only queues), ordering remains deterministic through queue age then lexical identifiers. This keeps non-privileged scheduling predictable and testable.

## Extension posture

Future policies (quota, reservations windows, affinity, deployment-profile overlays, richer resource arbitration) should compose into existing scheduling rule and arbitration seams without moving policy logic into transport, persistence, or dispatch adapters.

## Verification baseline

- `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
