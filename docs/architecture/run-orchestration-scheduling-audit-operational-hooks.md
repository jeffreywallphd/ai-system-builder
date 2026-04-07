# Scheduling Audit and Operational Event Hooks

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.7: Implement audit and operational event hooks for scheduling decisions and overrides

## Purpose

Expose scheduling behavior through structured application-level events so governance and operations tooling can observe policy decisions and exceptional outcomes without depending on internal debugging paths.

This story adds:

- scheduling governance event contracts and sink port
- application-layer event emission from scheduling decision and queue-assignment integration seams
- infrastructure adapter for mapping audit-channel scheduling events into platform audit records

## Canonical implementation map

- Scheduling governance event contract + best-effort publication helper:
  - `src/application/scheduling/ports/SchedulingGovernanceEventPorts.ts`
- Decision-pipeline event emission for priority-driven placement and defer/no-placement outcomes:
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- Queue integration event emission for no-placement deferral and reservation/materialization conflicts:
  - `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- Platform audit sink mapping:
  - `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`

## Emitted event model

`SchedulingGovernanceEventTypes` currently includes:

- `scheduling-priority-placement-selected`
- `scheduling-deferred-no-placement`
- `scheduling-reservation-conflict`
- `scheduling-assignment-materialization-conflict`

Each event is emitted for both channels:

- `audit`
- `operational`

Event payloads carry actor/workspace/run/node/decision context when available.

## Emission points

1. `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase`
   - emits placement-selected events when scheduling outcome is `assignment-recommended`
   - emits deferred/no-placement events when scheduling outcome is `deferred` or `no-placement`
2. `MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase`
   - emits deferred/no-placement events when non-selected queue claims are deferred
   - emits reservation-conflict events when placement hold acquisition conflicts
   - emits materialization-conflict or reservation-conflict events when claim materialization fails with authoritative conflict outcomes

## Redaction and recording posture

- Event publication is best-effort and does not alter scheduling/assignment control flow on sink failure.
- Event detail sanitization drops sensitive/internal fields (for example: token/payload/prompt/internal diagnostic key patterns).
- Representative policy and arbitration metadata is recorded (reason codes, priority score metadata, queue/candidate summaries).
- Raw claim tokens and deep internal payloads are intentionally not recorded.

## Manual/administrative override posture (current scope)

No manual or administrative scheduling override command path is currently implemented in the authoritative scheduling pipeline for this story scope.

This story therefore records supported scheduler and queue-integration behavior only; override-specific event types are intentionally deferred until an authoritative override capability is added.

## Boundary posture

- Event emission stays in application use cases and ports.
- Scheduling domain entities/rules remain free of audit/operational publication concerns.
- Infrastructure audit persistence remains adapter-owned through sink implementations.

## Verification coverage

- `src/application/scheduling/tests/SchedulingGovernanceEventPorts.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
