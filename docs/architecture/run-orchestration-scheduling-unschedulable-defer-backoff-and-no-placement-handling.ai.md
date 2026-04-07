# AI Companion: Scheduling Defer, Backoff, and No-Placement Handling

## Story scope
Story 17.2.4 adds authoritative handling for unschedulable queued runs so they are deferred with backoff and structured no-placement reasons instead of repeatedly thrashing claim/release cycles.

## Human doc
- `docs/architecture/run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md`

## Implemented files
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Core delivery
- Scheduler decisions now include explicit `no-placement` outcomes for evaluated-but-unplaceable queue work.
- Non-selected claimed queue leases now defer with bounded backoff metadata and reason capture when unschedulable/preempted.
- Queue persistence now stores no-placement diagnostics and defer counters, and reconsiders deferred entries after `eligibleAt`.
- Queue processing avoids immediate repeated re-claim loops for impossible placements while preserving authoritative queue ownership.

## Guardrails
- Keep no-placement classification in scheduling/application seams, not transport handlers.
- Keep backoff cadence and queue eligibility updates in authoritative queue persistence semantics.
- Keep dispatch execution boundaries unchanged; defer/no-placement must not bypass queue claims or assignment claim use cases.
