import { describe, expect, it } from "bun:test";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { SchedulingRunPriorityBands, type SchedulingCandidateDecision } from "@domain/scheduling/SchedulingDomain";
import {
  RolePrioritySchedulingTieBreakOrder,
  createRolePrioritySchedulingArbitrationReason,
  selectRolePrioritySchedulingCandidate,
} from "@application/scheduling/use-cases/RolePrioritySchedulingArbitration";

function createCandidate(input: {
  readonly runId: string;
  readonly nodeId: string;
  readonly priorityBand: "critical" | "high" | "normal" | "low";
  readonly rolePriorityScore: number;
  readonly queueAgeSeconds: number;
}): SchedulingCandidateDecision {
  return Object.freeze({
    runId: input.runId,
    nodeId: input.nodeId,
    eligible: true,
    denialReasons: Object.freeze([]),
    scorecard: Object.freeze({
      priorityBand: input.priorityBand,
      rolePriorityScore: input.rolePriorityScore,
      queueAgeSeconds: input.queueAgeSeconds,
    }),
  });
}

describe("RolePrioritySchedulingArbitration", () => {
  it("selects mixed-role candidates by role score before queue age", () => {
    const selected = selectRolePrioritySchedulingCandidate({
      eligibleCandidates: Object.freeze([
        createCandidate({
          runId: "run:member",
          nodeId: "node:1",
          priorityBand: "normal",
          rolePriorityScore: 2,
          queueAgeSeconds: 1_000,
        }),
        createCandidate({
          runId: "run:admin",
          nodeId: "node:1",
          priorityBand: "high",
          rolePriorityScore: 3,
          queueAgeSeconds: 100,
        }),
      ]),
      runs: Object.freeze([
        Object.freeze({
          runId: "run:member",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T12:00:00.000Z",
            eligibleAt: "2026-04-07T12:00:00.000Z",
            claimToken: "claim:member",
            claimOwner: "scheduler:a",
          }),
        }),
        Object.freeze({
          runId: "run:admin",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.admin]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T12:00:00.000Z",
            eligibleAt: "2026-04-07T12:00:00.000Z",
            claimToken: "claim:admin",
            claimOwner: "scheduler:a",
          }),
        }),
      ]),
    });

    expect(selected?.candidate.runId).toBe("run:admin");
    expect(selected?.candidate.scorecard.priorityBand).toBe(SchedulingRunPriorityBands.high);
  });

  it("applies deterministic fallback ordering by queue age, run id, and node id", () => {
    const selected = selectRolePrioritySchedulingCandidate({
      eligibleCandidates: Object.freeze([
        createCandidate({
          runId: "run:b",
          nodeId: "node:z",
          priorityBand: "normal",
          rolePriorityScore: 2,
          queueAgeSeconds: 120,
        }),
        createCandidate({
          runId: "run:a",
          nodeId: "node:z",
          priorityBand: "normal",
          rolePriorityScore: 2,
          queueAgeSeconds: 120,
        }),
        createCandidate({
          runId: "run:a",
          nodeId: "node:a",
          priorityBand: "normal",
          rolePriorityScore: 2,
          queueAgeSeconds: 120,
        }),
      ]),
      runs: Object.freeze([
        Object.freeze({
          runId: "run:a",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T12:00:00.000Z",
            eligibleAt: "2026-04-07T12:00:00.000Z",
            claimToken: "claim:a",
            claimOwner: "scheduler:a",
          }),
        }),
        Object.freeze({
          runId: "run:b",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T12:00:00.000Z",
            eligibleAt: "2026-04-07T12:00:00.000Z",
            claimToken: "claim:b",
            claimOwner: "scheduler:a",
          }),
        }),
      ]),
    });

    expect(selected?.candidate.runId).toBe("run:a");
    expect(selected?.candidate.nodeId).toBe("node:a");
  });

  it("surfaces explicit arbitration details for operational visibility", () => {
    const selected = Object.freeze({
      candidate: createCandidate({
        runId: "run:owner",
        nodeId: "node:1",
        priorityBand: "critical",
        rolePriorityScore: 4,
        queueAgeSeconds: 30,
      }),
      run: Object.freeze({
        runId: "run:owner",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.owner]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([]),
          requiresRemoteScheduling: true,
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T12:00:00.000Z",
          eligibleAt: "2026-04-07T12:00:00.000Z",
          claimToken: "claim:owner",
          claimOwner: "scheduler:a",
        }),
      }),
    });

    const reason = createRolePrioritySchedulingArbitrationReason({
      selected,
      eligibleCandidateCount: 2,
    });

    expect(reason.code).toBe("role-priority-arbitration");
    expect(reason.details).toEqual(Object.freeze({
      tieBreakOrder: RolePrioritySchedulingTieBreakOrder,
      eligibleCandidateCount: 2,
      selected: Object.freeze({
        runId: "run:owner",
        nodeId: "node:1",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.owner]),
        priorityBand: "critical",
        rolePriorityScore: 4,
        queueAgeSeconds: 30,
      }),
    }));
  });
});
