import { describe, expect, it } from "bun:test";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeRoleCapabilities, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import {
  SchedulingDecisionOutcomes,
  SchedulingNodeUsageModes,
  SchedulingPolicySourceKinds,
  createSchedulingPolicyDecision,
  evaluateSchedulingCandidate,
} from "@domain/scheduling/SchedulingDomain";
import {
  SchedulingPolicyEvaluationContractVersions,
  SchedulingPolicyEvaluationReasonCodes,
  createSchedulingDecisionBundle,
  createSchedulingOutcomeReason,
  isSchedulingTerminalOutcome,
  normalizeSchedulingPriorityBand,
  toSchedulingPolicyEvaluationResult,
} from "../SchedulingPolicyEvaluationContracts";

describe("SchedulingPolicyEvaluationContracts", () => {
  it("defines a stable contract version and reason code catalog", () => {
    expect(SchedulingPolicyEvaluationContractVersions.v1).toBe("scheduling-policy-evaluation/v1");
    expect(SchedulingPolicyEvaluationReasonCodes.queueEmpty).toBe("queue-empty");
    expect(SchedulingPolicyEvaluationReasonCodes.noEligibleCandidates).toBe("no-eligible-candidates");
  });

  it("projects policy decisions into explainable scheduling evaluation results", () => {
    const snapshot = {
      asOf: "2026-04-07T16:00:00.000Z",
      deploymentProfileId: "profile:authoritative",
      queueLeases: [{
        runId: "run:1",
        queueId: "queue:default",
        enteredAt: "2026-04-07T15:59:00.000Z",
        eligibleAt: "2026-04-07T15:59:00.000Z",
        claimToken: "claim:1",
        claimOwner: "scheduler:a",
        claimExpiresAt: "2026-04-07T16:01:00.000Z",
      }],
      runs: [{
        runId: "run:1",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:owner",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.owner],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T15:59:00.000Z",
          eligibleAt: "2026-04-07T15:59:00.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler:a",
        },
      }],
      nodes: [{
        nodeId: "node:1",
        nodeType: NodeTypes.compute,
        schedulable: true,
        supportsRemoteScheduling: true,
        enabledCapabilities: [NodeRoleCapabilities.executor],
        usageMode: SchedulingNodeUsageModes.idle,
      }],
    } as const;

    const candidate = evaluateSchedulingCandidate({
      asOf: snapshot.asOf,
      run: snapshot.runs[0],
      node: snapshot.nodes[0],
    });

    const decision = createSchedulingPolicyDecision({
      decisionId: "decision:1",
      occurredAt: "2026-04-07T16:00:01.000Z",
      outcome: SchedulingDecisionOutcomes.assignmentRecommended,
      selected: {
        runId: "run:1",
        nodeId: "node:1",
        claimToken: "claim:1",
        reservationOwner: "scheduler:a",
      },
      evaluatedCandidates: [candidate],
      reasons: [createSchedulingOutcomeReason("capacity-unavailable", "Capacity check passed.")],
      policySources: [
        SchedulingPolicySourceKinds.runSubmission,
        SchedulingPolicySourceKinds.nodeTrustInventory,
      ],
    });

    const evaluation = toSchedulingPolicyEvaluationResult({
      snapshot,
      decision,
    });

    expect(evaluation.snapshot.contractVersion).toBe("scheduling-policy-evaluation/v1");
    expect(evaluation.summary.candidateCount).toBe(1);
    expect(evaluation.summary.eligibleCandidateCount).toBe(1);
    expect(evaluation.queueEvaluation[0]?.priority.priorityBand).toBe("critical");
    expect(evaluation.queueEvaluation[0]?.exclusionReasonCodes).toEqual([]);
  });

  it("builds decision bundles with embedded policy-evaluation projections", () => {
    const snapshot = {
      asOf: "2026-04-07T17:00:00.000Z",
      queueLeases: [],
      runs: [],
      nodes: [],
    } as const;

    const decision = createSchedulingPolicyDecision({
      decisionId: "decision:deferred",
      occurredAt: "2026-04-07T17:00:01.000Z",
      outcome: SchedulingDecisionOutcomes.deferred,
      evaluatedCandidates: [],
      reasons: [createSchedulingOutcomeReason(
        SchedulingPolicyEvaluationReasonCodes.queueEmpty,
        "Queue is empty.",
      )],
      policySources: [SchedulingPolicySourceKinds.runSubmission],
    });

    const bundle = createSchedulingDecisionBundle({
      snapshot,
      decision,
      assignmentIntents: [],
    });

    expect(bundle.evaluation.outcome).toBe("deferred");
    expect(bundle.evaluation.summary.candidateCount).toBe(0);
    expect(bundle.assignmentIntents).toEqual([]);
  });

  it("exposes small scheduling contract helpers for terminal outcomes and priority normalization", () => {
    expect(isSchedulingTerminalOutcome("assignment-recommended")).toBeTrue();
    expect(isSchedulingTerminalOutcome("denied")).toBeTrue();
    expect(isSchedulingTerminalOutcome("deferred")).toBeFalse();

    expect(normalizeSchedulingPriorityBand("high")).toBe("high");
    expect(normalizeSchedulingPriorityBand("")).toBe("normal");
    expect(normalizeSchedulingPriorityBand("not-a-band")).toBe("normal");
  });
});
