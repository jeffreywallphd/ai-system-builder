# AI Companion: Scheduling Integration for Authoritative Queue Selection and Assignment

## Story scope
Story 17.2.1 wires scheduling into authoritative queue processing so claimed queue work is evaluated by policy before assignment is finalized.
Story 17.2.8 documents the now-implemented queue, reservation, arbitration, and dispatch-settlement behavior so future capacity policy work extends known seams.

## Human doc
- `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`

## Implemented files
- `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- `src/application/runs/use-cases/ProcessAuthoritativeRunQueueSchedulingUseCase.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/RunAssignmentRequirementDerivation.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Core delivery
- Queue processing now uses scheduling policy evaluation as the authoritative selection layer.
- Claimed queue leases are assembled into scheduler snapshots with run requirement metadata, role context, and trusted-node policy inputs.
- Only scheduler-selected intents are materialized; non-selected claims are released.
- No-placement outcomes are explicit and reason-bearing (defer with backoff metadata when available, otherwise release).
- Assignment materialization now acquires and releases short-lived node placement holds around node-claim finalization.
- Assignment finalization still flows through authoritative node-claim use case semantics.
- Dispatch outcomes settle reservation ownership explicitly (release, requeue, or terminal finalization) through authoritative run orchestration use cases.

## Boundary posture
- Scheduling logic remains in `src/application/scheduling/*`.
- Queue-claim and assignment lifecycle mutation remains in `src/application/runs/*`.
- Dispatch execution remains downstream and is not coupled to scheduling evaluation.

## Invariant posture
- Reservation/claim ownership is preserved (`claimToken`, owner, expiry).
- Node placement hold lifecycle is explicit (acquire, conflict, expiry replacement, release).
- Duplicate assignment protection remains conflict-first at materialization time.
- No hidden queue bypass path exists outside authoritative queue lease and claim use cases.
- Queue settlement after dispatch outcome stays explicit and policy-safe via `HandleRunDispatchResultUseCase`.

## Extension map for future capacity work
- Add quota/capacity/arbitration rules in scheduling pipeline seams (`SchedulingPolicyRulePipeline`, arbitration modules), not transport/persistence shortcuts.
- Keep reservation ownership in queue persistence contracts (`claimAssignmentReadyRuns`, `releaseRunClaim`, `deferRunClaimForNoPlacement`).
- Extend placement-hold semantics through `IRunNodePlacementHoldRepository` and scheduling assignment gateway boundaries.

