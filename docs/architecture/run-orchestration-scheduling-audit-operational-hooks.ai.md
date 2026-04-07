# AI Companion: Scheduling Audit and Operational Event Hooks

## Story scope
Story 17.2.7 adds structured audit/operational hooks for scheduler decisions and queue-integration exceptional outcomes.
Story 17.3.3 extends those hooks by bridging operational-channel events into shared runtime realtime publication.

## Human doc
- `docs/architecture/run-orchestration-scheduling-audit-operational-hooks.md`

## Canonical files
- `src/application/scheduling/ports/SchedulingGovernanceEventPorts.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- `src/infrastructure/api/runs/PlatformSchedulingGovernanceEventSink.ts`

## Core delivery
- Scheduling now emits structured governance events for:
  - priority-driven placement selections
  - deferred/no-placement outcomes
  - successful assignment materialization outcomes
  - reservation conflicts and assignment materialization conflicts
- Events are emitted from application seams (decision pipeline + queue integration), not from domain rules.
- Publication is best-effort and sanitized for sensitive/internal detail keys.
- Platform audit integration maps audit-channel scheduling events into stable run-audit actions.
- Platform realtime integration maps operational-channel scheduling events into canonical `runtime.run.status` and `runtime.queue` payloads.

## Redaction posture
- Sensitive/internal detail keys are dropped before sink publication.
- Raw claim token/internal payload style fields are intentionally excluded.
- Compact reason/priority/outcome summaries are preserved for governance and troubleshooting surfaces.

## Manual/admin override note
- No authoritative manual or administrative scheduling override command path exists in this story scope.
- Override-specific event types are intentionally deferred until override capability is implemented.

## Tests added/updated
- `src/application/scheduling/tests/SchedulingGovernanceEventPorts.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`
- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/infrastructure/api/runs/tests/PlatformSchedulingGovernanceEventSink.test.ts`
