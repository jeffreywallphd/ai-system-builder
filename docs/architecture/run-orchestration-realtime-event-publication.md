# Run Orchestration Realtime Event Publication

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.3: Implement Operational Control, Recovery Behavior, and Cross-Surface Orchestration Visibility
- Story 16.3.4: Implement real-time orchestration event publication for run and queue changes

## Purpose

Publish authoritative run/queue lifecycle changes through the shared runtime realtime event stream so desktop and thin clients consume the same control-plane truth without backend-local polling assumptions.

## Canonical implementation map

- Shared realtime contracts and schemas:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- Shared runtime realtime stream:
  - `src/infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream.ts`
  - `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`
- Authoritative run publication boundaries:
  - `src/infrastructure/api/runs/RunOrchestrationRealtimePublisher.ts`
  - `src/infrastructure/api/runs/RuntimeBackendRunRealtimePublisher.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts`

## Canonical orchestration event categories and kinds

- Topic/category:
  - `runtime.run.status` + `run-status`
  - `runtime.queue` + `queue-movement`
- Orchestration event kinds (shared contract):
  - `submission-accepted`
  - `queue-enqueued`
  - `queue-updated`
  - `assignment-updated`
  - `progress-updated`
  - `cancellation-requested`
  - `retry-queued`
  - `completed`
  - `failed`
  - `cancelled`
  - `state-changed`

## Payload and redaction boundaries

- Realtime payloads include authoritative identifiers and lifecycle metadata (`runId`, `workflowId`, `queueId`, `lifecycleState`, `eventKind`) plus queue/run status.
- Publication is application-boundary driven; UI layers do not synthesize lifecycle events.
- Realtime payloads do not include backend-internal diagnostics, submission parameters, secret values, or transport-path internals.
- Diagnostics remain in authoritative run state/audit stores and are exposed through dedicated authorized read surfaces only.

## Publication triggers at authoritative boundaries

- Run submission acceptance:
  - emits run status (`submission-accepted`)
  - emits queue movement (`queue-enqueued`)
- Run cancellation/retry mutation success:
  - emits run status (`cancellation-requested`/`cancelled`/`retry-queued`)
  - emits queue movement (`queue-updated`/`queue-enqueued`)
- Run execution update ingestion:
  - emits run status (`assignment-updated`, `progress-updated`, terminal and state-change kinds)
  - emits queue movement (`queue-updated`)

## Invariants

- Only authoritative control-plane state transitions publish orchestration realtime events.
- Publication is best-effort and never blocks canonical run state mutation success.
- Runtime realtime subscriptions remain workspace scoped and authorization evaluated through existing websocket/runtime seams.
- Realtime contracts stay shared across desktop and thin-client channels.

## Validation and regression coverage

- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/infrastructure/api/system-runtime/tests/SystemRuntimeBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunSubmissionBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunExecutionUpdateBackendApi.test.ts`
- `src/infrastructure/api/runs/tests/RuntimeBackendRunRealtimePublisher.test.ts`
