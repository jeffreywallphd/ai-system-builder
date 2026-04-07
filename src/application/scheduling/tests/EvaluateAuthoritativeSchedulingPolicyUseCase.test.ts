import { describe, expect, it } from "bun:test";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeRoleCapabilities, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import {
  SchedulingCandidateDenialCodes,
  SchedulingNodeUsageModes,
  type SchedulingPolicyReason,
} from "@domain/scheduling/SchedulingDomain";
import type {
  ISchedulingPolicyRule,
  SchedulingPolicyRuleContext,
} from "@application/scheduling/ports/SchedulingPolicyRulePorts";
import { EvaluateAuthoritativeSchedulingPolicyUseCase } from "../use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase";

function createSnapshot() {
  return Object.freeze({
    asOf: "2026-04-07T20:00:00.000Z",
    deploymentProfileId: "profile:production",
    queueLeases: [
      {
        runId: "run:owner",
        queueId: "queue:default",
        enteredAt: "2026-04-07T19:59:20.000Z",
        eligibleAt: "2026-04-07T19:59:20.000Z",
        claimToken: "claim:owner",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T20:01:00.000Z",
      },
      {
        runId: "run:viewer",
        queueId: "queue:default",
        enteredAt: "2026-04-07T19:55:20.000Z",
        eligibleAt: "2026-04-07T19:55:20.000Z",
        claimToken: "claim:viewer",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T20:01:00.000Z",
      },
    ],
    runs: [
      {
        runId: "run:owner",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:owner",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.owner],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:59:20.000Z",
          eligibleAt: "2026-04-07T19:59:20.000Z",
          claimToken: "claim:owner",
          claimOwner: "scheduler:alpha",
        },
      },
      {
        runId: "run:viewer",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:viewer",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.viewer],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:55:20.000Z",
          eligibleAt: "2026-04-07T19:55:20.000Z",
          claimToken: "claim:viewer",
          claimOwner: "scheduler:alpha",
        },
      },
    ],
    nodes: [{
      nodeId: "node:compute:1",
      nodeType: NodeTypes.compute,
      schedulable: true,
      supportsRemoteScheduling: true,
      enabledCapabilities: [NodeRoleCapabilities.executor],
      usageMode: SchedulingNodeUsageModes.idle,
    }],
  });
}

class OrderedTrackingRule implements ISchedulingPolicyRule {
  public constructor(
    public readonly ruleId: string,
    private readonly visited: string[],
    private readonly factory: (input: SchedulingPolicyRuleContext) => ReadonlyArray<SchedulingPolicyReason>,
  ) {}

  public evaluate(input: SchedulingPolicyRuleContext) {
    this.visited.push(this.ruleId);
    const reasons = this.factory(input);
    return Object.freeze({
      allowed: reasons.length === 0,
      reasons,
    });
  }
}

describe("EvaluateAuthoritativeSchedulingPolicyUseCase", () => {
  it("selects eligible candidates deterministically by priority and queue age", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:priority",
    });

    const bundle = await useCase.evaluate(createSnapshot());

    expect(bundle.decision.outcome).toBe("assignment-recommended");
    expect(bundle.decision.selected?.runId).toBe("run:owner");
    expect(bundle.decision.selected?.nodeId).toBe("node:compute:1");
    const arbitrationReason = bundle.evaluation.reasons.find((reason) => reason.code === "role-priority-arbitration");
    expect(arbitrationReason?.details).toEqual(Object.freeze({
      tieBreakOrder: Object.freeze([
        "role-priority-score",
        "queue-age-seconds",
        "run-id",
        "node-id",
      ]),
      eligibleCandidateCount: 2,
      decisiveTieBreakStage: "role-priority-score",
      topRankedCandidates: Object.freeze([
        Object.freeze({
          runId: "run:owner",
          nodeId: "node:compute:1",
          rolePriorityScore: 4,
          queueAgeSeconds: 40,
        }),
        Object.freeze({
          runId: "run:viewer",
          nodeId: "node:compute:1",
          rolePriorityScore: 1,
          queueAgeSeconds: 280,
        }),
      ]),
      selected: Object.freeze({
        runId: "run:owner",
        nodeId: "node:compute:1",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.owner]),
        priorityBand: "critical",
        rolePriorityScore: 4,
        queueAgeSeconds: 40,
      }),
    }));
    expect(bundle.assignmentIntents).toEqual([
      Object.freeze({
        runId: "run:owner",
        nodeId: "node:compute:1",
        queueId: "queue:default",
        claimToken: "claim:owner",
        reservationOwner: "scheduler:alpha",
        decisionId: "decision:priority",
        decidedAt: "2026-04-07T20:00:01.000Z",
      }),
    ]);
  });

  it("evaluates rules in configured order and keeps denials explainable", async () => {
    const visited: string[] = [];
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:ordered-rules",
      rules: Object.freeze([
        new OrderedTrackingRule("rule:first", visited, () => []),
        new OrderedTrackingRule("rule:deny-viewer", visited, (input) => (
          input.run.runId === "run:viewer"
            ? Object.freeze([Object.freeze({
              code: SchedulingCandidateDenialCodes.policyDenied,
              message: "Viewer run denied by explicit policy rule.",
            })])
            : Object.freeze([])
        )),
      ]),
    });

    const bundle = await useCase.evaluate(createSnapshot());

    expect(visited).toEqual([
      "rule:first",
      "rule:deny-viewer",
      "rule:first",
      "rule:deny-viewer",
    ]);
    expect(bundle.decision.outcome).toBe("assignment-recommended");
    expect(bundle.decision.evaluatedCandidates.find((candidate) => candidate.runId === "run:viewer")?.eligible).toBeFalse();
    expect(bundle.decision.evaluatedCandidates.find((candidate) => candidate.runId === "run:viewer")
      ?.denialReasons[0]?.code).toBe("policy-denied");

    const pipelineReason = bundle.decision.reasons.find((reason) => reason.code === "rule-pipeline-evaluated");
    expect(pipelineReason?.details).toEqual(Object.freeze({
      ruleOrder: Object.freeze(["rule:first", "rule:deny-viewer"]),
      candidateCount: 2,
      eligibleCandidateCount: 1,
      affinityPreferredCandidateCount: 1,
    }));
  });

  it("returns deferred queue-empty outcomes and no-placement outcomes for evaluated-but-unschedulable queues", async () => {
    const queueEmptyUseCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:queue-empty",
    });
    const queueEmpty = await queueEmptyUseCase.evaluate(Object.freeze({
      asOf: "2026-04-07T20:00:00.000Z",
      queueLeases: [],
      runs: [],
      nodes: [],
    }));

    expect(queueEmpty.decision.outcome).toBe("deferred");
    expect(queueEmpty.decision.reasons.some((reason) => reason.code === "queue-empty")).toBeTrue();

    const noEligibleUseCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:no-eligible",
      rules: Object.freeze([
        new OrderedTrackingRule("rule:deny-all", [], () => Object.freeze([Object.freeze({
          code: SchedulingCandidateDenialCodes.policyDenied,
          message: "Denied by test rule.",
        })])),
      ]),
    });
    const noEligible = await noEligibleUseCase.evaluate(createSnapshot());

    expect(noEligible.decision.outcome).toBe("no-placement");
    expect(noEligible.decision.selected).toBeUndefined();
    expect(noEligible.assignmentIntents).toEqual([]);
    expect(noEligible.decision.reasons.some((reason) => reason.code === "no-eligible-candidates")).toBeTrue();
  });

  it("uses deterministic fallback ordering for non-privileged queues when role priority ties", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:tie-break",
    });
    const bundle = await useCase.evaluate(Object.freeze({
      asOf: "2026-04-07T20:00:00.000Z",
      queueLeases: Object.freeze([
        Object.freeze({
          runId: "run:a",
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:55:20.000Z",
          eligibleAt: "2026-04-07T19:55:20.000Z",
          claimToken: "claim:a",
          claimOwner: "scheduler:alpha",
          claimExpiresAt: "2026-04-07T20:01:00.000Z",
        }),
        Object.freeze({
          runId: "run:b",
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:55:20.000Z",
          eligibleAt: "2026-04-07T19:55:20.000Z",
          claimToken: "claim:b",
          claimOwner: "scheduler:alpha",
          claimExpiresAt: "2026-04-07T20:01:00.000Z",
        }),
      ]),
      runs: Object.freeze([
        Object.freeze({
          runId: "run:a",
          workspaceId: "workspace:1",
          submittedByUserIdentityId: "user:a",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T19:55:20.000Z",
            eligibleAt: "2026-04-07T19:55:20.000Z",
            claimToken: "claim:a",
            claimOwner: "scheduler:alpha",
          }),
        }),
        Object.freeze({
          runId: "run:b",
          workspaceId: "workspace:1",
          submittedByUserIdentityId: "user:b",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T19:55:20.000Z",
            eligibleAt: "2026-04-07T19:55:20.000Z",
            claimToken: "claim:b",
            claimOwner: "scheduler:alpha",
          }),
        }),
      ]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:z",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:a",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
      ]),
    }));

    expect(bundle.decision.selected?.runId).toBe("run:a");
    expect(bundle.decision.selected?.nodeId).toBe("node:a");
  });

  it("keeps arbitration deterministic when run and node input order changes", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:ordering-deterministic",
    });
    const baseSnapshot = Object.freeze({
      asOf: "2026-04-07T20:00:00.000Z",
      queueLeases: Object.freeze([
        Object.freeze({
          runId: "run:b",
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:55:20.000Z",
          eligibleAt: "2026-04-07T19:55:20.000Z",
          claimToken: "claim:b",
          claimOwner: "scheduler:alpha",
          claimExpiresAt: "2026-04-07T20:01:00.000Z",
        }),
        Object.freeze({
          runId: "run:a",
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:55:20.000Z",
          eligibleAt: "2026-04-07T19:55:20.000Z",
          claimToken: "claim:a",
          claimOwner: "scheduler:alpha",
          claimExpiresAt: "2026-04-07T20:01:00.000Z",
        }),
      ]),
      runs: Object.freeze([
        Object.freeze({
          runId: "run:b",
          workspaceId: "workspace:1",
          submittedByUserIdentityId: "user:b",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T19:55:20.000Z",
            eligibleAt: "2026-04-07T19:55:20.000Z",
            claimToken: "claim:b",
            claimOwner: "scheduler:alpha",
          }),
        }),
        Object.freeze({
          runId: "run:a",
          workspaceId: "workspace:1",
          submittedByUserIdentityId: "user:a",
          workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
          requirements: Object.freeze({
            requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
            requiresRemoteScheduling: true,
          }),
          queue: Object.freeze({
            queueId: "queue:default",
            enteredAt: "2026-04-07T19:55:20.000Z",
            eligibleAt: "2026-04-07T19:55:20.000Z",
            claimToken: "claim:a",
            claimOwner: "scheduler:alpha",
          }),
        }),
      ]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:z",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:a",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
      ]),
    });

    const reversedSnapshot = Object.freeze({
      ...baseSnapshot,
      runs: Object.freeze([...baseSnapshot.runs].reverse()),
      nodes: Object.freeze([...baseSnapshot.nodes].reverse()),
    });
    const [baseBundle, reversedBundle] = await Promise.all([
      useCase.evaluate(baseSnapshot),
      useCase.evaluate(reversedSnapshot),
    ]);

    expect(baseBundle.decision.selected).toEqual(reversedBundle.decision.selected);
    expect(baseBundle.assignmentIntents).toEqual(reversedBundle.assignmentIntents);
    expect(baseBundle.decision.evaluatedCandidates).toEqual(reversedBundle.decision.evaluatedCandidates);
    expect(baseBundle.decision.evaluatedCandidates.map((candidate) => `${candidate.runId}:${candidate.nodeId}`)).toEqual([
      "run:a:node:a",
      "run:a:node:z",
      "run:b:node:a",
      "run:b:node:z",
    ]);
  });

  it("excludes capability-ineligible nodes and applies placement affinity preference when eligible matches exist", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:capability-affinity",
    });

    const bundle = await useCase.evaluate(Object.freeze({
      asOf: "2026-04-07T20:00:00.000Z",
      queueLeases: Object.freeze([Object.freeze({
        runId: "run:affinity",
        queueId: "queue:default",
        enteredAt: "2026-04-07T19:59:20.000Z",
        eligibleAt: "2026-04-07T19:59:20.000Z",
        claimToken: "claim:affinity",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T20:01:00.000Z",
      })]),
      runs: Object.freeze([Object.freeze({
        runId: "run:affinity",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:member",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          requiresRemoteScheduling: true,
          placementAffinity: Object.freeze({
            preferredNodeIds: Object.freeze(["node:z-preferred"]),
          }),
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:59:20.000Z",
          eligibleAt: "2026-04-07T19:59:20.000Z",
          claimToken: "claim:affinity",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:a-ineligible",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:a-eligible",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:z-preferred",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
      ]),
    }));

    expect(bundle.decision.selected?.nodeId).toBe("node:z-preferred");
    expect(
      bundle.decision.evaluatedCandidates.find((candidate) => candidate.nodeId === "node:a-ineligible")?.eligible,
    ).toBeFalse();
    expect(
      bundle.decision.evaluatedCandidates.find((candidate) => candidate.nodeId === "node:a-ineligible")
        ?.denialReasons.some((reason) => reason.code === SchedulingCandidateDenialCodes.nodeMissingCapability),
    ).toBeTrue();
    expect(bundle.decision.reasons.some((reason) => reason.code === "placement-affinity-preference-applied")).toBeTrue();
  });

  it("falls back to normal arbitration when placement affinity preferences have no eligible matches", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:00:01.000Z"),
      decisionIdFactory: () => "decision:affinity-fallback",
    });
    const bundle = await useCase.evaluate(Object.freeze({
      asOf: "2026-04-07T20:00:00.000Z",
      queueLeases: Object.freeze([Object.freeze({
        runId: "run:affinity-fallback",
        queueId: "queue:default",
        enteredAt: "2026-04-07T19:59:20.000Z",
        eligibleAt: "2026-04-07T19:59:20.000Z",
        claimToken: "claim:affinity-fallback",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T20:01:00.000Z",
      })]),
      runs: Object.freeze([Object.freeze({
        runId: "run:affinity-fallback",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:member",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          requiresRemoteScheduling: true,
          placementAffinity: Object.freeze({
            preferredNodeIds: Object.freeze(["node:missing-preference"]),
          }),
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T19:59:20.000Z",
          eligibleAt: "2026-04-07T19:59:20.000Z",
          claimToken: "claim:affinity-fallback",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:z",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
        Object.freeze({
          nodeId: "node:a",
          nodeType: NodeTypes.compute,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
        }),
      ]),
    }));

    expect(bundle.decision.selected?.nodeId).toBe("node:a");
    expect(bundle.decision.reasons.some((reason) => reason.code === "placement-affinity-preference-unmet")).toBeTrue();
  });

  it("defers hybrid-node remote assignments when reserved local capacity and local-user windows are active", async () => {
    const useCase = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T20:30:01.000Z"),
      decisionIdFactory: () => "decision:hybrid-local-protection",
    });
    const bundle = await useCase.evaluate(Object.freeze({
      asOf: "2026-04-07T20:30:00.000Z",
      queueLeases: Object.freeze([Object.freeze({
        runId: "run:member",
        queueId: "queue:default",
        enteredAt: "2026-04-07T20:20:00.000Z",
        eligibleAt: "2026-04-07T20:20:00.000Z",
        claimToken: "claim:member",
        claimOwner: "scheduler:alpha",
        claimExpiresAt: "2026-04-07T20:32:00.000Z",
      })]),
      runs: Object.freeze([Object.freeze({
        runId: "run:member",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:member",
        workspaceRoleKeys: Object.freeze([WorkspaceAuthorizationRoleKeys.member]),
        requirements: Object.freeze({
          requiredCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          requiresRemoteScheduling: true,
        }),
        queue: Object.freeze({
          queueId: "queue:default",
          enteredAt: "2026-04-07T20:20:00.000Z",
          eligibleAt: "2026-04-07T20:20:00.000Z",
          claimToken: "claim:member",
          claimOwner: "scheduler:alpha",
        }),
      })]),
      nodes: Object.freeze([
        Object.freeze({
          nodeId: "node:hybrid:capacity",
          nodeType: NodeTypes.hybrid,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
          hybridLocalUseProtection: Object.freeze({
            reservedLocalCapacityUnits: 1,
            activeRemoteAssignmentCount: 1,
          }),
        }),
        Object.freeze({
          nodeId: "node:hybrid:window",
          nodeType: NodeTypes.hybrid,
          schedulable: true,
          supportsRemoteScheduling: true,
          enabledCapabilities: Object.freeze([NodeRoleCapabilities.executor]),
          usageMode: SchedulingNodeUsageModes.idle,
          hybridLocalUseProtection: Object.freeze({
            protectedLocalUserWindow: Object.freeze({
              startsAt: "2026-04-07T20:00:00.000Z",
              endsAt: "2026-04-07T21:00:00.000Z",
              protectedUserIdentityId: "user:desktop-owner",
            }),
          }),
        }),
      ]),
    }));

    expect(bundle.decision.outcome).toBe("no-placement");
    expect(bundle.decision.selected).toBeUndefined();
    expect(bundle.decision.reasons.some((reason) => reason.code === "no-eligible-candidates")).toBeTrue();
    expect(bundle.decision.evaluatedCandidates.every((candidate) => !candidate.eligible)).toBeTrue();
    expect(
      bundle.decision.evaluatedCandidates.flatMap((candidate) => candidate.denialReasons)
        .map((reason) => reason.details?.protectionKind),
    ).toContain("reserved-local-capacity");
    expect(
      bundle.decision.evaluatedCandidates.flatMap((candidate) => candidate.denialReasons)
        .map((reason) => reason.details?.protectionKind),
    ).toContain("protected-local-user-window");
  });
});
