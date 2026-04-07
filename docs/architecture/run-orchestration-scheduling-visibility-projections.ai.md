# AI Companion: Run Orchestration Scheduling Visibility Projections

## Story scope
Story 17.3.1 adds authoritative scheduling read projections for operational/admin surfaces, including defer rationale, priority context, candidate constraints, and placement outcomes.

## Human doc
- `docs/architecture/run-orchestration-scheduling-visibility-projections.md`

## Canonical files
- Shared run transport contracts/schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Scheduling projection helper:
  - `src/application/runs/use-cases/RunSchedulingVisibilityProjection.ts`
- Queue/read API integration:
  - `src/application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`

## Core delivery
- Run queue/list/detail/status projections include optional `scheduling` visibility fields.
- Queue reads now project scheduler defer/backoff and placement rationale safely for operational surfaces.
- Admin audiences (`run.manage`) receive bounded scheduling diagnostics and queue-level scheduling admin summary counters.

## Guardrails
- Keep scheduling projection logic in application/infrastructure query seams, not UI.
- Do not expose raw scheduler candidate debug payload arrays in user projections.
- Keep non-admin responses stripped of admin scheduling diagnostics.

## Tests updated
- `src/application/runs/tests/RunSchedulingVisibilityProjection.test.ts`
- `src/application/runs/tests/ListAuthoritativeRunQueueStatusUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
