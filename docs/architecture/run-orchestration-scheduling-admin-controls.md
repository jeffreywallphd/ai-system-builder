# Scheduling Administrative Controls (Supported Scope)

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.3: Deliver Scheduling Visibility, Admin Controls, and Production Hardening
- Story 17.3.2: Implement limited administrative scheduling controls for the supported scope

## Purpose

Provide a small, production-safe set of scheduling admin controls for real operations without exposing unsafe low-level override paths.

## Supported administrative actions

This story intentionally supports only bounded interventions:

1. Re-evaluate deferred runs
- action: move deferred queue entries back to `ready` eligibility for immediate policy re-evaluation
- scope limits: workspace-scoped, optional queue and run-id scoping, bounded request limit
- safety posture: only deferred entries are targeted; no direct assignment override is introduced

2. View stale queue reservations
- action: list expired queue claim reservations (`claim_expires_at <= asOf`)
- scope limits: workspace-scoped, optional queue filter, bounded pagination
- safety posture: read-only diagnostics for explicit stale claim lifecycle states

3. Release stale queue reservations
- action: clear a specific expired queue claim reservation by `runId` and `claimToken`
- scope limits: workspace-scoped, explicit reservation identity required
- safety posture: fails closed if reservation is not stale; no blanket release endpoint

## Canonical implementation map

- Shared transport contracts/schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Application use cases:
  - `src/application/runs/use-cases/ListStaleSchedulingReservationsUseCase.ts`
  - `src/application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase.ts`
  - `src/application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase.ts`
- Persistence boundary + adapter:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- Backend API and transport wiring:
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Authorization and audit posture

- Scheduling admin actions require `run.manage`.
- Deferred re-evaluation and stale-reservation release are recorded as run audit intents:
  - `run.scheduling.admin.deferred.re-evaluated`
  - `run.scheduling.admin.stale-reservation.released`
- Stale-reservation listing is read-only and authorization-gated.

## Explicitly out of scope

- No arbitrary node-assignment override.
- No raw claim-table mutation controls.
- No bypass of authoritative scheduling policy evaluation.
- No manual dispatch-path shortcut that skips queue claim and assignment gateway seams.

## Invariants

- Authoritative queue state remains the single source of reservation/defer truth.
- Admin interventions mutate only modeled scheduler state transitions.
- All supported admin mutations are permission-checked and auditable.

## Verification coverage

- `src/application/runs/tests/SchedulingAdminControlsUseCases.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeSchedulingAdminApi.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
