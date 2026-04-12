# AI Companion: Run Orchestration Scheduling Realtime Event Publication

## Story scope
Story 17.3.3 publishes authoritative scheduling and queue-arbitration decisions as shared runtime realtime events.

## Human doc
- `docs/architecture/run-orchestration-scheduling-realtime-event-publication.md`

## Canonical files
- `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
- `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`
- `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`

## Core delivery
- Added scheduling-specific runtime realtime orchestration event kinds for priority placement, defer/no-placement, reservation conflict, materialized assignment, and requeue.
- Reused existing scheduling governance application hooks as the authoritative publication source.
- Bridged operational scheduling governance events into runtime queue/run realtime payload publication through infrastructure sink adapters.
- Added explicit `scheduling-requeued` realtime emission from scheduling-admin deferred re-evaluation success.

## Security posture
- Scheduling governance details remain sanitized before sink publication.
- Realtime payloads remain minimal and safe (identifiers, lifecycle/status, event kind, timestamps).
- No claim tokens, prompts, or internal diagnostic payloads are published.

## Tests added/updated
- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/application/runs/tests/SchedulingRealtimePublicationDocumentation.test.ts`