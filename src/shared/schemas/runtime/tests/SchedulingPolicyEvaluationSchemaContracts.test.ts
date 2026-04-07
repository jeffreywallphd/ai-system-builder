import { describe, expect, it } from "bun:test";
import {
  SchedulingPolicyEvaluationSchemaValidationError,
  parseSchedulingDecisionBundle,
  parseSchedulingEvaluationSnapshot,
  parseSchedulingPolicyEvaluationResult,
  parseSchedulingQueueEvaluationSummary,
} from "../SchedulingPolicyEvaluationSchemaContracts";

describe("SchedulingPolicyEvaluationSchemaContracts", () => {
  it("parses scheduling evaluation snapshots", () => {
    const snapshot = parseSchedulingEvaluationSnapshot({
      asOf: "2026-04-07T18:00:00.000Z",
      deploymentProfileId: "profile:1",
      queueLeases: [{
        runId: "run:1",
        queueId: "queue:default",
        enteredAt: "2026-04-07T17:59:00.000Z",
        eligibleAt: "2026-04-07T17:59:00.000Z",
        claimToken: "claim:1",
        claimOwner: "scheduler:a",
        claimExpiresAt: "2026-04-07T18:01:00.000Z",
      }],
      runs: [{
        runId: "run:1",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:1",
        workspaceRoleKeys: ["owner"],
        requirements: {
          requiredCapabilities: ["executor"],
          requiresRemoteScheduling: true,
          placementAffinity: {
            preferredNodeIds: ["node:1"],
            preferredNodeTypes: ["compute"],
            preferredDeploymentProfileIds: ["profile:1"],
          },
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T17:59:00.000Z",
          eligibleAt: "2026-04-07T17:59:00.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler:a",
        },
      }],
      nodes: [{
        nodeId: "node:1",
        nodeType: "compute",
        schedulable: true,
        supportsRemoteScheduling: true,
        enabledCapabilities: ["executor"],
        usageMode: "idle",
        hybridLocalUseProtection: {
          reservedLocalCapacityUnits: 1,
          activeRemoteAssignmentCount: 0,
          protectedLocalUserWindow: {
            startsAt: "2026-04-07T17:00:00.000Z",
            endsAt: "2026-04-07T18:30:00.000Z",
            protectedUserIdentityId: "user:desktop-owner",
          },
        },
      }],
    });

    expect(snapshot.runs[0]?.runId).toBe("run:1");
    expect(snapshot.runs[0]?.requirements.placementAffinity?.preferredNodeIds).toEqual(["node:1"]);
    expect(snapshot.nodes[0]?.usageMode).toBe("idle");
    expect(snapshot.nodes[0]?.hybridLocalUseProtection?.reservedLocalCapacityUnits).toBe(1);
  });

  it("parses policy evaluation results with candidate reasoning summaries", () => {
    const parsed = parseSchedulingPolicyEvaluationResult({
      snapshot: {
        contractVersion: "scheduling-policy-evaluation/v1",
        decisionId: "decision:1",
        occurredAt: "2026-04-07T18:00:01.000Z",
        policySources: ["run-submission", "node-trust-inventory"],
        deploymentProfileId: "profile:1",
      },
      outcome: "assignment-recommended",
      selected: {
        runId: "run:1",
        nodeId: "node:1",
        claimToken: "claim:1",
        reservationOwner: "scheduler:a",
      },
      summary: {
        queueLeaseCount: 1,
        runCount: 1,
        nodeCount: 1,
        candidateCount: 1,
        eligibleCandidateCount: 1,
        excludedCandidateCount: 0,
      },
      queueEvaluation: [{
        runId: "run:1",
        nodeId: "node:1",
        eligible: true,
        priority: {
          priorityBand: "critical",
          rolePriorityScore: 4,
          queueAgeSeconds: 60,
        },
        reservation: {
          claimOwner: "scheduler:a",
          reservationConflict: false,
        },
        exclusionReasonCodes: [],
        exclusionReasons: [],
      }],
      reasons: [{
        code: "capacity-unavailable",
        message: "Capacity check passed.",
      }],
    });

    expect(parsed.summary.eligibleCandidateCount).toBe(1);
    expect(parsed.queueEvaluation[0]?.priority.priorityBand).toBe("critical");
  });

  it("parses scheduling decision bundles with snapshot and evaluation projections", () => {
    const parsed = parseSchedulingDecisionBundle({
      snapshot: {
        asOf: "2026-04-07T19:00:00.000Z",
        queueLeases: [],
        runs: [],
        nodes: [],
      },
      decision: {
        decisionId: "decision:2",
        occurredAt: "2026-04-07T19:00:01.000Z",
        outcome: "deferred",
        evaluatedCandidates: [],
        reasons: [{
          code: "queue-empty",
          message: "No queued runs were available.",
        }],
        policySources: ["run-submission"],
      },
      assignmentIntents: [],
      evaluation: {
        snapshot: {
          contractVersion: "scheduling-policy-evaluation/v1",
          decisionId: "decision:2",
          occurredAt: "2026-04-07T19:00:01.000Z",
          policySources: ["run-submission"],
        },
        outcome: "deferred",
        summary: {
          queueLeaseCount: 0,
          runCount: 0,
          nodeCount: 0,
          candidateCount: 0,
          eligibleCandidateCount: 0,
          excludedCandidateCount: 0,
        },
        queueEvaluation: [],
        reasons: [{
          code: "queue-empty",
          message: "No queued runs were available.",
        }],
      },
    });

    expect(parsed.decision.outcome).toBe("deferred");
    expect(parsed.evaluation.summary.candidateCount).toBe(0);
  });

  it("rejects malformed candidate summary and queue counts", () => {
    expect(() => parseSchedulingQueueEvaluationSummary({
      queueLeaseCount: 1,
      runCount: 1,
      nodeCount: 1,
      candidateCount: 2,
      eligibleCandidateCount: 1,
      excludedCandidateCount: 0,
    })).toThrow(SchedulingPolicyEvaluationSchemaValidationError);

    expect(() => parseSchedulingPolicyEvaluationResult({
      snapshot: {
        contractVersion: "scheduling-policy-evaluation/v1",
        decisionId: "decision:invalid",
        occurredAt: "2026-04-07T20:00:01.000Z",
        policySources: ["run-submission"],
      },
      outcome: "assignment-recommended",
      selected: {
        runId: "run:1",
        nodeId: "node:1",
        claimToken: "claim:1",
        reservationOwner: "scheduler:a",
      },
      summary: {
        queueLeaseCount: 1,
        runCount: 1,
        nodeCount: 1,
        candidateCount: 1,
        eligibleCandidateCount: 1,
        excludedCandidateCount: 0,
      },
      queueEvaluation: [{
        runId: "run:1",
        nodeId: "node:1",
        eligible: true,
        priority: {
          priorityBand: "critical",
          rolePriorityScore: 4,
          queueAgeSeconds: 10,
        },
        reservation: {
          claimOwner: "scheduler:a",
          reservationConflict: false,
        },
        exclusionReasonCodes: ["reservation-conflict"],
        exclusionReasons: [],
      }],
      reasons: [],
    })).toThrow(SchedulingPolicyEvaluationSchemaValidationError);
  });
});
