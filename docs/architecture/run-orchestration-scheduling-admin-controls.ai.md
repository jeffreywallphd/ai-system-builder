# AI Companion: Scheduling Administrative Controls (Supported Scope)

## Story scope
Story 17.3.2 adds a bounded scheduling-admin control surface for production operations: deferred-run re-evaluation plus stale-reservation visibility/release.

## Human doc
- `docs/architecture/run-orchestration-scheduling-admin-controls.md`

## Canonical files
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/application/runs/use-cases/ListStaleSchedulingReservationsUseCase.ts`
- `src/application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase.ts`
- `src/application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase.ts`
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Supported admin actions
- List stale queue reservations (read-only diagnostic, `run.manage` gated).
- Release one stale queue reservation by explicit run+claim identity.
- Re-evaluate deferred runs by moving deferred entries back to ready eligibility.

## Guardrails
- No broad arbitrary scheduler overrides.
- No direct assignment/node override path.
- No bypass of authoritative queue claim and scheduling policy seams.
- Mutating actions emit auditable run intent events.

## Audit actions
- `run.scheduling.admin.stale-reservation.released`
- `run.scheduling.admin.deferred.re-evaluated`

## Tests updated
- `src/application/runs/tests/SchedulingAdminControlsUseCases.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeSchedulingAdminApi.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
