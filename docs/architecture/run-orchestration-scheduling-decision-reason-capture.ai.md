# AI Companion: Scheduling Decision Reason Capture and Explainable Outcomes

## Story scope
Story 17.1.7 adds structured decision-reason capture and application-level scheduler outcome recording for admin/debug/audit visibility.

## Human doc
- `docs/architecture/run-orchestration-scheduling-decision-reason-capture.md`

## Canonical files
- `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - Adds `SchedulingDecisionReasonSummary` projection and code-count catalogs.
  - Adds reason-summary projection to `SchedulingPolicyEvaluationResult`.
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
  - Validates `reasonSummary` payload shapes and bounds.
- `src/application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts.ts`
  - Application port for outcome-capture recording.
- `src/application/scheduling/use-cases/SchedulingDecisionOutcomeCapture.ts`
  - Compact projection helper for capture records.
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
  - Optional recorder integration after authoritative evaluation.

## Core delivery
- Scheduling decisions now expose a compact, structured reason summary (decision reasons + exclusion reasons + representative exclusion samples).
- Outcome capture is available in the decision pipeline through an explicit application port (`ISchedulingDecisionOutcomeRecorder`).
- Captured records remain compact and redaction-safe by omitting raw candidate debug payload arrays and free-form internal details.

## Guardrails
- Do not place scheduling policy reasoning in transport handlers or persistence repositories.
- Do not copy raw debug/internal detail blobs into run records.
- Keep recorder implementations as infrastructure adapters behind the application port.

## Tests added/updated
- `src/shared/contracts/runtime/tests/SchedulingPolicyEvaluationContracts.test.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`
- `src/application/scheduling/tests/SchedulingDecisionOutcomeCapture.test.ts`
