import { describe, expect, it } from "bun:test";
import {
  createSchedulingDecisionBundle,
  createSchedulingOutcomeReason,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";
import {
  SchedulingDecisionOutcomes,
  SchedulingPolicySourceKinds,
  createSchedulingPolicyDecision,
} from "@domain/scheduling/SchedulingDomain";
import { toSchedulingDecisionOutcomeCaptureRecord } from "../use-cases/SchedulingDecisionOutcomeCapture";

describe("toSchedulingDecisionOutcomeCaptureRecord", () => {
  it("projects compact scheduling outcome-capture records without candidate debug payloads", () => {
    const bundle = createSchedulingDecisionBundle({
      snapshot: Object.freeze({
        asOf: "2026-04-07T22:00:00.000Z",
        queueLeases: [],
        runs: [],
        nodes: [],
      }),
      decision: createSchedulingPolicyDecision({
        decisionId: "decision:capture",
        occurredAt: "2026-04-07T22:00:01.000Z",
        outcome: SchedulingDecisionOutcomes.deferred,
        evaluatedCandidates: [],
        reasons: [createSchedulingOutcomeReason("queue-empty", "No queued runs were available.")],
        policySources: [SchedulingPolicySourceKinds.runSubmission],
      }),
      assignmentIntents: [],
    });

    const captured = toSchedulingDecisionOutcomeCaptureRecord({
      bundle,
      recordedAt: "2026-04-07T22:00:02.000Z",
    });

    expect(captured.decisionId).toBe("decision:capture");
    expect(captured.summary.candidateCount).toBe(0);
    expect(captured.reasonSummary.decisionReasonCodes).toEqual(["queue-empty"]);
    expect("queueEvaluation" in (captured as unknown as Record<string, unknown>)).toBeFalse();
  });
});
