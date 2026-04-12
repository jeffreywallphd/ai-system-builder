# AI Companion: Reservation-Aware Node Arbitration and Temporary Placement Holds

## Story scope
Story 17.2.2 adds temporary scheduler placement-hold semantics so selected run/node assignment attempts are guarded against duplicate placement races before dispatch-preparation claim finalization.

## Human doc
- `docs/architecture/run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`

## Implemented files
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Core delivery
- Adds explicit node placement-hold contracts with conflict outcomes and durable hold records.
- Assignment materialization now acquires a temporary node hold before dispatch-preparation claim finalization.
- Hold conflicts now release queue claims immediately to avoid hidden lease starvation.
- Hold release is explicit and performed after claim attempts complete.

## Conflict and expiry posture
- Node-scoped conflict reason: `held-by-another-owner`.
- Expired holds are reclaimable at acquisition time.
- Release is token-guarded to avoid releasing another owner’s active hold.

## Boundary posture
- Scheduling still selects candidates.
- Assignment materialization now owns temporary hold orchestration.
- Authoritative run/node claim finalization remains in `ClaimRunForNodeDispatchPreparationUseCase`.
- Dispatch execution remains downstream and unchanged.
