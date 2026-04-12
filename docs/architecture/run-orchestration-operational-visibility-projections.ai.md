# AI Companion: Run Orchestration Operational Visibility Projections

## Story scope
Story 16.3.5 extends authoritative operational read projections with production timeline/history and failure-summary presentation data.
Story 16.3.7 adds structured orchestration observability, counters/metrics hooks, correlation coverage, and centralized redaction for operational diagnostics.

## Human doc
- `docs/architecture/run-orchestration-operational-visibility-projections.md`

## Implemented seams
- Projection and query services:
  - `src/application/runs/use-cases/RunOperationalVisibilityProjection.ts`
  - `src/application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase.ts`
- Shared contracts/schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Authoritative API + transport:
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts`
  - `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
  - `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Queue read support in persistence:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`

## Operational visibility additions
- Action eligibility (`cancel`/`retry`/`dequeue`) is derived from authoritative state.
- User-safe failure summary fields are projected for operational surfaces.
- Status timeline/history entries are projected from authoritative run state, run audit events, and dispatch attempt records.
- Timeline entries now cover lifecycle transitions, dispatch attempts, execution progress markers, cancellation actions, retry actions, and terminal progression.
- Optional admin-visible failure diagnostics are projected as bounded metadata summaries when authorization permits.
- Authoritative queue read endpoint (`GET /api/v1/runtime/queue`) now supports run/queue control visibility projections.

## Safety posture
- Internal diagnostics remain internal metadata only.
- Operational projections expose safe summaries and control eligibility, not raw internal telemetry.
- Standard run-history views remain redacted; admin diagnostics are metadata summaries only (codes/keys), not raw backend logs.
- Queue/run reads remain workspace-scoped and authorization-filtered.

## Orchestration observability additions
- Run orchestration API boundaries now emit structured events for submission, mutation, lifecycle update, and run/query operations.
- Events include correlatable run context where available (`runId`, `workspaceId`, `nodeId`, `correlationId`, lifecycle markers).
- Queue/run counters and operation totals are emitted as structured counters and optional metric events to support production diagnosis.
- Dispatch failure markers are emitted for lifecycle updates when authoritative state indicates `dispatch-failed-to-start` outcomes.

## Redaction posture for observability events
- All run observability payloads flow through centralized sanitization in `RunOrchestrationObservabilityRedaction.ts`.
- Redaction composes persistence redaction safeguards and additionally masks backend payload/parameter/prompt/internal-diagnostics key paths.
- Absolute filesystem path values, tokens/secrets, and prompt-bearing fields remain redacted in emitted events/logs.
