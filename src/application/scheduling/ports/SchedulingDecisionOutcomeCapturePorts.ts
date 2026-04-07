import type { SchedulingDecisionOutcome } from "@domain/scheduling/SchedulingDomain";
import type {
  SchedulingDecisionReasonSummary,
  SchedulingPolicyDecision,
  SchedulingQueueEvaluationSummary,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";

export interface SchedulingDecisionOutcomeCaptureRecord {
  readonly decisionId: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly outcome: SchedulingDecisionOutcome;
  readonly selected?: SchedulingPolicyDecision["selected"];
  readonly summary: SchedulingQueueEvaluationSummary;
  readonly reasonSummary: SchedulingDecisionReasonSummary;
}

export interface ISchedulingDecisionOutcomeRecorder {
  recordDecisionOutcome(record: SchedulingDecisionOutcomeCaptureRecord): Promise<void>;
}
