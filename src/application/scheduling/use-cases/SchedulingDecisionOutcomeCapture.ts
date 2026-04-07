import type { SchedulingDecisionBundle } from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type { SchedulingDecisionOutcomeCaptureRecord } from "@application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts";

export function toSchedulingDecisionOutcomeCaptureRecord(input: {
  readonly bundle: SchedulingDecisionBundle;
  readonly recordedAt: string;
}): SchedulingDecisionOutcomeCaptureRecord {
  return Object.freeze({
    decisionId: input.bundle.decision.decisionId,
    occurredAt: input.bundle.decision.occurredAt,
    recordedAt: input.recordedAt,
    outcome: input.bundle.decision.outcome,
    selected: input.bundle.decision.selected,
    summary: input.bundle.evaluation.summary,
    reasonSummary: input.bundle.evaluation.reasonSummary,
  });
}
