# Feature 4 Final Baseline: Authoritative Image Run Orchestration Integration

This document records Feature 4 completion for the image manipulation vertical slice and locks the implementation-truth baseline for Epic 4.4 Story 4.4.4.

Feature 4 is the point where image execution becomes an authoritative run-driven system. This baseline is the required foundation before Feature 5 (node-based execution management) and Feature 6 (result persistence, preview, and lineage) are layered on.

## Feature 4 verification summary

Feature 4 is complete for run-orchestration integration in the image slice:

- studio launch and monitoring flow through authoritative run APIs, not direct studio-to-backend execution calls
- run submission is validation-first and readiness-gated before durable run creation
- queueing, dispatch progression, progress ingestion, and terminal lifecycle are orchestration-owned application behavior
- cancellation is authoritative and lifecycle-aware with backend signaling behind ports
- normalized run status and transport contracts are the single source for API/UI monitoring surfaces
- audit and observability hooks capture submission, scheduling, and lifecycle operations with redaction boundaries

## Canonical run domain and orchestration model

Core run model and orchestration seams:

- `src/domain/runs/RunDomain.ts`
- `src/domain/runs/ImageRunDomain.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts`
- `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`

Domain posture:

- authoritative run records and lifecycle legality are canonical domain/application truth
- system/workflow/assets are resolved into typed authoritative run identity and scope
- backend adapter payloads and provider status strings are infrastructure details, not lifecycle authority

## Authoritative execution flow locked by Feature 4

1. Studio submits run intent through authoritative image-run/runtime API contracts.
2. Submission validation and readiness checks enforce policy, workflow/system compatibility, asset bindings, parameters, and backend-readiness dependencies.
3. Accepted requests create durable authoritative run records before execution handoff.
4. Queue admission and assignment/dispatch progression are orchestrated through run use cases.
5. Dispatch executes through backend adapters behind run execution ports.
6. Progress and lifecycle updates are normalized and ingested through authoritative update use cases.
7. Cancellation requests route through authoritative run mutation semantics with queue/dispatch coordination.
8. Terminal outcomes publish normalized run status and output-handoff metadata for downstream persistence/lineage work.

## API integration and audit posture

Authoritative API seams:

- submission/query/mutation backends:
  - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- authoritative route family:
  - `src/infrastructure/transport/http-server/authoritative-route-families/RuntimeAuthoritativeApiRoutes.ts`
- image-run aliases:
  - `POST /api/v1/image-systems/:systemId/runs`
  - `GET /api/v1/image-runs`
  - `GET /api/v1/image-runs/:runId`
  - `POST /api/v1/image-runs/:runId/cancel`

Audit and operational visibility seams:

- submission and scheduling governance sinks:
  - `src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts`
  - `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`
- run observability and redaction:
  - `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
  - `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`

## Architectural boundaries and assumptions

- direct studio-to-ComfyUI or studio-to-provider execution/progress/cancel shortcuts are prohibited
- transport handlers authenticate/validate/map requests but do not mutate lifecycle outside authoritative use cases
- infrastructure adapters translate provider behavior; they do not define lifecycle legality
- run lifecycle/state history remains durable control-plane truth for cross-surface monitoring
- output discovery references are handoff artifacts, not persisted logical asset identity

## Follow-on integration dependencies

### Feature 5: Node-based execution and backend management

Feature 5 must:

- consume queue/assignment/claim/dispatch seams already owned by run orchestration
- extend scheduling and node-capability policy modules, not route handlers or dispatch adapters
- preserve authoritative submission and lifecycle transition ownership
- keep backend-management concerns behind application ports and infrastructure adapters

### Feature 6: Result persistence, preview, and lineage

Feature 6 must:

- consume terminal output handoff metadata from authoritative run finalization
- materialize persisted outputs as logical assets/datasets with canonical run/workflow lineage
- preserve normalized terminal quality/output-availability semantics for partial/degraded outcomes
- avoid promoting provider paths/handles into product-facing identity contracts

## Known limits and intentional non-goals

Known limits in this baseline:

- scheduling remains bounded to current policy/rule and arbitration scope; richer quota/resource scheduling is deferred
- backend progress remains adapter-normalized and may reflect polling behavior for provider integrations
- cancellation signaling is lifecycle-authoritative but backend interrupt guarantees remain adapter/provider dependent
- output persistence/preview/lineage materialization is intentionally deferred to Feature 6

Intentional non-goals for Feature 4:

- implementing distributed node fleet execution management policy beyond current scheduling seams
- implementing final persisted output identity, storage retention policy, or lineage graph ownership rules
- introducing direct UI/provider contracts that bypass shared run transport contracts

## Verification coverage and cross-references

Primary regression and integration coverage:

- `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts`
- `src/application/runs/tests/RunOrchestrationAdapterBackedExecution.integration.test.ts`
- `src/application/runs/tests/ProcessQueuedRunDispatchUseCase.integration.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/application/runs/tests/RequestAuthoritativeRunCancellationUseCase.test.ts`
- `src/application/runs/tests/IngestRunExecutionUpdateUseCase.test.ts`
- `src/application/runs/tests/FinalizeRunExecutionOutcomeUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRunSubmissionApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeReadApis.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeMutationApis.test.ts`

Related architecture docs:

- `docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md`
- `docs/architecture/run-submission-readiness-blocking-validation.md`
- `docs/architecture/run-submission-pipeline-extension-guardrails.md`
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`
- `docs/architecture/run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`
- `docs/architecture/run-orchestration-operational-visibility-projections.md`
- `docs/architecture/unified-api-endpoint-reference.md`
- `docs/run-submission-contributor-guide.md`
- `docs/run-orchestration-contributor-guide.md`
