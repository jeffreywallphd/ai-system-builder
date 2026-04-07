import { describe, expect, it } from "bun:test";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeRoleCapabilities, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import { SchedulingNodeUsageModes, type SchedulingCandidateDecision } from "@domain/scheduling/SchedulingDomain";
import { applyBasicPlacementAffinityPreference } from "../use-cases/SchedulingPlacementAffinityPreference";

function createCandidate(nodeId: string): SchedulingCandidateDecision {
  return Object.freeze({
    runId: "run:1",
    nodeId,
    eligible: true,
    denialReasons: Object.freeze([]),
    scorecard: Object.freeze({
      priorityBand: "normal",
      rolePriorityScore: 2,
      queueAgeSeconds: 30,
    }),
  });
}

describe("SchedulingPlacementAffinityPreference", () => {
  it("filters eligible candidates to affinity matches when at least one preferred node exists", () => {
    const result = applyBasicPlacementAffinityPreference({
      eligibleCandidates: Object.freeze([
        createCandidate("node:a"),
        createCandidate("node:z"),
      ]),
      runs: Object.freeze([Object.freeze({
        runId: "run:1",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          requiresRemoteScheduling: true,
          placementAffinity: Object.freeze({
            preferredNodeIds: Object.freeze(["node:z"]),
          }),
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:59:20.000Z",
          eligibleAt: "2026-04-07T19:59:20.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:a",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
          deploymentProfileId: "profile:baseline",
        }),
        Object.freeze({
          nodeId: "node:z",
          nodeType: NodeTypes.hybrid,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
          deploymentProfileId: "profile:preferred",
        }),
      ]),
    });

    expect(result.eligibleCandidates.map((candidate) => candidate.nodeId)).toEqual(["node:z"]);
    expect(result.reasons[0]?.code).toBe("placement-affinity-preference-applied");
  });

  it("retains all candidates and emits fallback reason when no preferred node is eligible", () => {
    const result = applyBasicPlacementAffinityPreference({
      eligibleCandidates: Object.freeze([
        createCandidate("node:a"),
        createCandidate("node:z"),
      ]),
      runs: Object.freeze([Object.freeze({
        runId: "run:1",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          requiresRemoteScheduling: true,
          placementAffinity: Object.freeze({
            preferredNodeTypes: Object.freeze([NodeTypes.edge]),
          }),
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:59:20.000Z",
          eligibleAt: "2026-04-07T19:59:20.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:a",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:z",
          nodeType: NodeTypes.hybrid,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
      ]),
    });

    expect(result.eligibleCandidates.map((candidate) => candidate.nodeId)).toEqual(["node:a", "node:z"]);
    expect(result.reasons[0]?.code).toBe("placement-affinity-preference-unmet");
  });
});
