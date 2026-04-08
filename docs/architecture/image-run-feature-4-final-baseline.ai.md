# AI Companion: Feature 4 Final Baseline for Authoritative Image Run Orchestration

## Purpose

Provide implementation-truth completion verification for Feature 4 so Feature 5 and Feature 6 extend stable authoritative run seams without reintroducing studio-to-backend shortcuts.

## Canonical source doc

- `docs/architecture/image-run-feature-4-final-baseline.md`

## Completion posture summary

- Image execution is now authoritative run-driven end-to-end (submission, validation, queueing, dispatch progression, progress ingestion, cancellation, terminal handoff).
- Studio launch/monitoring uses authoritative run APIs and normalized run status contracts.
- Run lifecycle legality and status history remain domain/application truth; adapters are translation-only.
- Audit and observability seams capture orchestration operations with redacted diagnostics boundaries.

## Canonical seams

- `src/domain/runs/RunDomain.ts`
- `src/domain/runs/ImageRunDomain.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
- `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`

## Guardrails to preserve

- Direct studio-to-provider dispatch/progress/cancel paths are prohibited.
- Transport handlers and adapters must not bypass authoritative lifecycle mutation use cases.
- Output handles from execution adapters are handoff metadata, not canonical persisted asset identity.

## Follow-on integration dependencies

- Feature 5 (node-based execution/backend management): extend scheduler/assignment/dispatch seams already established by run orchestration.
- Feature 6 (result persistence/preview/lineage): consume authoritative terminal output handoff metadata and preserve normalized lifecycle/failure semantics.

## Known limits to keep explicit

- Scheduling scope remains bounded to current policy/arbitration implementation.
- Backend progress/cancellation guarantees remain adapter/provider dependent even though lifecycle authority is centralized.
- Final output persistence/lineage ownership is intentionally deferred to Feature 6.

## Verification anchors

- `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts`
- `src/application/runs/tests/RunOrchestrationAdapterBackedExecution.integration.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRunSubmissionApi.test.ts`
