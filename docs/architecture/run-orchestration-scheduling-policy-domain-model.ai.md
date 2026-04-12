# AI Companion: Scheduling Policy Domain Model and Decision Boundaries

## Story scope
Story 17.1.1 defines canonical scheduling domain concepts and the authoritative decision-pipeline boundary for policy-aware placement.

## Human doc
- `docs/architecture/run-orchestration-scheduling-policy-domain-model.md`

## Implemented files
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/domain/scheduling/tests/SchedulingDomain.test.ts`
- `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts`
- `src/application/runs/tests/SchedulingPolicyArchitectureDocumentation.test.ts`
- `docs/architecture/run-orchestration-scheduling-policy-domain-model.md`

## Core delivery
- Adds canonical scheduling domain vocabulary for:
  - policy inputs
  - role-priority run bands
  - node usage posture
  - candidate eligibility and scorecards
  - explainable decision outcomes
  - policy source traceability
- Adds baseline policy helpers for:
  - role-priority (`owner/admin/member/viewer` precedence)
  - hybrid node local interactive-use protection
- Decision outcomes now include explicit `no-placement` semantics alongside `deferred` to distinguish queue-empty deferral from evaluated-but-unplaceable work.
- Adds explicit application-layer scheduling decision-pipeline contracts that separate:
  - policy evaluation from
  - assignment materialization and dispatch execution

## Required boundary
- Scheduling chooses *which run/node claim should be attempted*.
- Queue claim + assignment mutation + backend dispatch still run through existing run-orchestration seams.
- Policy logic must not be implemented in UI, transport handlers, persistence adapters, or dispatch adapters.

## Future policy extension posture
- Add new policy rules under `src/domain/scheduling/*` and `src/application/scheduling/*`.
- Planned future policy feeds (quota, reservations, affinity, deployment-profile variants) map through `SchedulingPolicySourceKinds` and input-assembler contracts without redefining dispatch infrastructure seams.

## Shared-contract handoff
- Follow-on shared scheduling projection/schema contracts now live in:
  - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- Keep policy semantics in domain/application scheduling seams; use shared contracts for transport/admin/diagnostics result payloads.
