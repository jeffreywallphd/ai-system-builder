# Run Orchestration Scheduling Decision Reason Capture and Explainable Outcomes

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.7: Implement explainable scheduling outcomes and decision reason capture

## Purpose

Provide a canonical, structured mechanism to capture and expose why authoritative scheduling selected, deferred, or excluded candidates without relying on log forensics.

This story adds:

- decision-reason summary projection in shared scheduling evaluation contracts
- application-layer outcome-capture seam for recording scheduler decisions
- bounded, redaction-safe reason catalog metadata suitable for admin/audit consumers

The implementation intentionally avoids writing raw candidate debug payloads into canonical run records.

## Canonical implementation map

- Reason summary projection model and helpers
  - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
- Schema validation for reason summary payloads
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- Application-layer outcome-capture port and projection helper
  - `src/application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts.ts`
  - `src/application/scheduling/use-cases/SchedulingDecisionOutcomeCapture.ts`
- Decision pipeline integration (optional recorder)
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`

## Explainability model added

`SchedulingPolicyEvaluationResult` now includes `reasonSummary` with:

- `decisionReasonCodes`: unique decision-level reason codes
- `decisionReasonCatalog`: aggregated code/count/sample-message entries
- `exclusionReasonCodes`: unique candidate exclusion/denial reason codes
- `exclusionReasonCatalog`: aggregated exclusion code/count/sample-message entries
- `exclusionSamples`: bounded run/node reason-code samples for representative diagnostics

This keeps outcome explainability query-friendly and compact while preserving existing full decision/evaluation structures for deeper diagnostics.

## Redaction and safety posture

- Reason summaries do not carry arbitrary `details` payloads.
- Sample messages are normalized/truncated for compact operational visibility.
- Outcome-capture records include queue/candidate count summaries and reason catalogs, not full candidate evaluation payload arrays.

This keeps captured data suitable for admin/audit use while reducing risk of unsafe internal signal leakage.

## Application recording seam

`EvaluateAuthoritativeSchedulingDecisionPipelineUseCase` now supports an optional `ISchedulingDecisionOutcomeRecorder`.

When configured, the decision pipeline records a `SchedulingDecisionOutcomeCaptureRecord` containing:

- decision identity/timestamps
- selected assignment (when present)
- outcome and aggregate queue/candidate counts
- structured reason summary

Recording remains application-layer orchestration behavior and does not mutate run-domain lifecycle entities.

## Boundary posture

- Scheduling decision logic remains in scheduling domain/application seams.
- Decision-capture projection remains transport/admin oriented and does not become canonical run state.
- Persistence/transport adapters can implement recorder storage/read APIs without moving policy logic out of application scheduling.

## Verification coverage

- `src/shared/contracts/runtime/tests/SchedulingPolicyEvaluationContracts.test.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`
- `src/application/scheduling/tests/SchedulingDecisionOutcomeCapture.test.ts`
