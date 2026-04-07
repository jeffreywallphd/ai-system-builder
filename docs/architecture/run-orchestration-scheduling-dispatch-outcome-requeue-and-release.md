# Scheduling-Aware Dispatch Outcome Requeue and Reservation Release

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.6: Implement scheduling-aware requeue and release behavior after dispatch outcomes

## Purpose

Define how authoritative dispatch-result handling settles queue reservation ownership so scheduling is not treated as a one-time placement event. Dispatch outcomes now explicitly release reservations, requeue retryable failed starts, or finalize terminal outcomes through authoritative run orchestration workflows.

## Implemented files

- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`

## Dispatch outcome queue-settlement policy

Dispatch outcome handling now applies an explicit queue action:

- `running-reservation-released`
  - applies to accepted dispatch (`dispatching -> running`)
  - clears queue claim ownership for the assigned/dequeued run so no stale scheduler reservation remains while run execution is in progress
- `failed-start-requeued`
  - applies to failed-to-start outcomes when:
    - failure is marked `retryable: true`,
    - retry budget remains (`retry.attempt < retry.maxAttempts`),
    - guarded queue requeue support exists
  - transitions canonical run through retry-pending and back to queued, resets assignment ownership, and returns queue state to authoritative scheduling
- `terminal-finalized`
  - applies to non-requeue failed-to-start outcomes
  - keeps failed terminal behavior and queue finalization path as authoritative

## Architectural boundary posture

- Scheduling policy remains upstream and unchanged; dispatch-result handling only settles the already-selected assignment reservation.
- Queue mutations remain in `IRunOrchestrationQueuePersistenceRepository` semantics.
- Canonical lifecycle transition legality remains in `RunDomain`.
- Dispatch adapters remain transport/backend seams; they do not mutate queue settlement state directly.

## Test coverage highlights

- accepted dispatch outcomes release queue reservation ownership and mark queue lifecycle progression to running
- non-retryable failed starts still finalize to failed with safe/internal failure diagnostics persisted
- retryable failed starts with remaining retry budget are requeued for authoritative scheduler re-evaluation
