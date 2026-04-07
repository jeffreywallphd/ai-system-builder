# AI Companion: Run Orchestration Realtime Event Publication

## Story scope
Story 16.3.4 publishes authoritative run and queue lifecycle events to the shared runtime realtime stream for desktop/thin-client operational control surfaces.

## Human doc
- `docs/architecture/run-orchestration-realtime-event-publication.md`

## Implemented seams
- Shared contract/schema expansion:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- Shared runtime publication adapters:
  - `src/infrastructure/api/runs/RunOrchestrationRealtimePublisher.ts`
  - `src/infrastructure/api/runs/RuntimeBackendRunRealtimePublisher.ts`
- Authoritative run boundary publication:
  - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts`
- Runtime stream publish wrappers:
  - `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`

## Publication model
- Authoritative application boundaries emit realtime events for:
  - submission acceptance
  - queue enqueue/update movement
  - assignment progression
  - progress updates
  - cancellation request/terminal cancellation
  - retry queueing
  - completion/failure terminalization
- Emission uses shared runtime realtime envelopes (`runtime.run.status`, `runtime.queue`), not UI-local event synthesis.

## Security/redaction posture
- Realtime payloads expose safe orchestration metadata only (`runId`, `workflowId`, `queueId`, lifecycle/status fields, event kind).
- Internal diagnostics and sensitive submission payload details are excluded from realtime publication.
- Publication is best-effort so authoritative state transitions are not blocked by downstream realtime fan-out failures.

## Tests added/updated
- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunExecutionUpdateBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/RuntimeBackendRunRealtimePublisher.test.ts`
