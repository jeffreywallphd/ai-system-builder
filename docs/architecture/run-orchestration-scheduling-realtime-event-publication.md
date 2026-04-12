# Run Orchestration Scheduling Realtime Event Publication

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.3: Deliver Scheduling Visibility, Admin Controls, and Production Hardening
- Story 17.3.3: Implement real-time scheduling and queue-arbitration event publication

## Purpose

Publish authoritative scheduling and queue-arbitration outcomes into the shared runtime realtime stream so operational/admin clients can subscribe to canonical control-plane decisions without polling heuristics.

## Canonical implementation map

- Shared runtime realtime event kinds/contracts/schemas:
  - `src/shared/contracts/runtime/SystemRuntimeRealtimeEventContracts.ts`
  - `src/shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts.ts`
- Scheduling governance emission seams (authoritative application boundaries):
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
  - `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- Infrastructure bridge from scheduling governance operational events -> realtime publication:
  - `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`
- Shared run/queue realtime publication helpers:
  - `src/infrastructure/api/runs/RunOrchestrationRealtimePublisher.ts`
- Administrative requeue realtime emission boundary:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`

## Canonical scheduling realtime event kinds

Scheduling/arbitration publication uses shared runtime realtime event kinds:

- `scheduling-priority-placement-selected`
- `scheduling-deferred-no-placement`
- `scheduling-reservation-conflict`
- `scheduling-assignment-materialized`
- `scheduling-requeued`

These are emitted on existing topics/categories:

- `runtime.run.status` + `run-status`
- `runtime.queue` + `queue-movement`

## Authoritative publication boundaries

- Scheduling decision and assignment materialization use cases emit structured governance events.
- Infrastructure adapters translate `operational` scheduling events into runtime realtime payloads.
- Admin deferred-run re-evaluation emits explicit `scheduling-requeued` realtime events per re-evaluated run.
- UI clients consume websocket/runtime subscriptions only; UI code does not synthesize scheduling events.

## Security and payload posture

- Realtime payloads include safe scheduling identity fields only (`runId`, `queueId`, status/lifecycle, `eventKind`, timestamps).
- Sensitive/internal detail keys are dropped before scheduling governance sink publication.
- No claim tokens, secrets, raw prompts, or backend-internal diagnostic payloads are published.

## Invariants

- Publication reflects authoritative control-plane outcomes only.
- Realtime publication remains best-effort and must not block authoritative mutation success.
- Scheduling realtime updates remain contract-backed in shared runtime realtime contracts/schemas.
- Subscription surfaces remain workspace-scoped and authorization-evaluated through existing runtime websocket seams.

## Verification coverage

- `src/shared/contracts/runtime/tests/SystemRuntimeRealtimeEventContracts.test.ts`
- `src/shared/schemas/runtime/tests/SystemRuntimeRealtimeEventSchemaContracts.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- `src/application/runs/tests/SchedulingRealtimePublicationDocumentation.test.ts`