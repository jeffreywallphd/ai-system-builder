# Scheduling Defer, Backoff, and No-Placement Handling for Unschedulable Queue Runs

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.4: Implement defer, backoff, and no-placement handling for unschedulable queued runs

## Purpose

Make unschedulable queue evaluations explicit, durable, and diagnosable by:

- introducing explicit scheduler `no-placement` outcomes
- deferring no-placement queue claims with bounded backoff instead of immediate re-claim loops
- recording structured no-placement reason metadata directly on authoritative queue records

This prevents repeated claim/evaluate/release thrash for impossible or temporarily blocked placements.

## Canonical implementation map

- Scheduler no-placement decision outcomes:
  - `src/domain/scheduling/SchedulingDomain.ts`
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
  - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- Queue defer/backoff + no-placement metadata persistence seam:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- Queue materialization handling for non-selected claimed leases:
  - `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`

## Runtime behavior

1. Queue leases are claimed and evaluated by scheduling policy.
2. If assignment is selected, the existing hold-and-claim flow remains authoritative.
3. For non-selected claimed runs, queue materialization now classifies no-placement disposition and:
   - defers claim with backoff and no-placement reason metadata when unschedulable/preempted
   - falls back to claim release only when defer capability is unavailable
4. Deferred runs are reconsidered after `eligibleAt` by assignment-ready selection (`ready` + `deferred` markers).

## No-placement reason capture

Queue records now track bounded no-placement diagnostics:

- defer attempt count
- no-placement category
- no-placement reason code set
- no-placement summary message
- source scheduling decision id
- no-placement recorded-at timestamp
- administrative-attention flag for currently non-self-healing categories

This keeps policy decisions explainable without requiring log forensics.

## Backoff posture

- Backoff is explicit and bounded (initial delay, multiplier, max delay).
- Defer metadata is updated each time a claimed run is deferred.
- Assignment-ready selection honors `eligibleAt` for deferred entries, preventing tight repeated evaluation loops.

## Boundary posture

- Scheduling still decides *what* is placeable and *why*.
- Queue persistence remains the source of truth for retry cadence (`eligibleAt`, `deferCount`) and no-placement metadata.
- Dispatch integration remains downstream and unchanged by no-placement handling.

Do not route around authoritative queue claim/defer/release semantics.

## Verification coverage

- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
