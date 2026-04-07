import { describe, expect, it } from "bun:test";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeRoleCapabilities, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import {
  SchedulingDecisionOutcomes,
  SchedulingDomainError,
  SchedulingNodeUsageModes,
  SchedulingPolicySourceKinds,
  SchedulingRunPriorityBands,
  createSchedulingPolicyDecision,
  deriveSchedulingRunPriorityBand,
  evaluateHybridNodeLocalInteractiveProtection,
  evaluateSchedulingCandidate,
} from "../SchedulingDomain";

describe("SchedulingDomain", () => {
  it("derives role-priority run bands from workspace role membership", () => {
    expect(deriveSchedulingRunPriorityBand([])).toBe(SchedulingRunPriorityBands.normal);
    expect(deriveSchedulingRunPriorityBand([WorkspaceAuthorizationRoleKeys.viewer])).toBe(SchedulingRunPriorityBands.low);
    expect(deriveSchedulingRunPriorityBand([WorkspaceAuthorizationRoleKeys.member])).toBe(SchedulingRunPriorityBands.normal);
    expect(deriveSchedulingRunPriorityBand([
      WorkspaceAuthorizationRoleKeys.member,
      WorkspaceAuthorizationRoleKeys.owner,
    ])).toBe(SchedulingRunPriorityBands.critical);
  });

  it("enforces hybrid local-interactive protection unless the same user owns the local session", () => {
    const blocked = evaluateHybridNodeLocalInteractiveProtection({
      nodeType: NodeTypes.hybrid,
      nodeUsageMode: SchedulingNodeUsageModes.interactiveLocalSession,
      localInteractiveOwnerUserIdentityId: "user:desktop-owner",
      runSubmittedByUserIdentityId: "user:remote-operator",
    });

    expect(blocked.allowed).toBeFalse();
    expect(blocked.reason?.code).toBe("hybrid-local-interactive-protection");

    const sameUserAllowed = evaluateHybridNodeLocalInteractiveProtection({
      nodeType: NodeTypes.hybrid,
      nodeUsageMode: SchedulingNodeUsageModes.interactiveLocalSession,
      localInteractiveOwnerUserIdentityId: "user:desktop-owner",
      runSubmittedByUserIdentityId: "user:desktop-owner",
    });

    expect(sameUserAllowed.allowed).toBeTrue();

    const nonHybridAllowed = evaluateHybridNodeLocalInteractiveProtection({
      nodeType: NodeTypes.compute,
      nodeUsageMode: SchedulingNodeUsageModes.interactiveLocalSession,
    });

    expect(nonHybridAllowed.allowed).toBeTrue();
  });

  it("evaluates assignment candidates with explicit denial reasons and scorecards", () => {
    const denied = evaluateSchedulingCandidate({
      asOf: "2026-04-07T14:00:00.000Z",
      run: {
        runId: "run:scheduling:1",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:owner",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.owner],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.storageAccess],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T13:59:00.000Z",
          eligibleAt: "2026-04-07T13:59:00.000Z",
          claimToken: "claim:1",
          claimOwner: "scheduler-a",
        },
      },
      node: {
        nodeId: "node:hybrid:1",
        nodeType: NodeTypes.hybrid,
        schedulable: true,
        supportsRemoteScheduling: true,
        enabledCapabilities: [NodeRoleCapabilities.executor],
        usageMode: SchedulingNodeUsageModes.interactiveLocalSession,
        localInteractiveOwnerUserIdentityId: "user:local",
        reservationOwner: "scheduler-b",
      },
    });

    expect(denied.eligible).toBeFalse();
    expect(denied.scorecard.priorityBand).toBe(SchedulingRunPriorityBands.critical);
    expect(denied.denialReasons.map((reason) => reason.code)).toEqual([
      "node-missing-capability",
      "hybrid-local-interactive-protection",
      "reservation-conflict",
    ]);

    const eligible = evaluateSchedulingCandidate({
      asOf: "2026-04-07T14:00:30.000Z",
      run: {
        runId: "run:scheduling:2",
        workspaceId: "workspace:1",
        submittedByUserIdentityId: "user:owner",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.admin],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T14:00:00.000Z",
          eligibleAt: "2026-04-07T14:00:00.000Z",
          claimToken: "claim:2",
          claimOwner: "scheduler-a",
        },
      },
      node: {
        nodeId: "node:compute:1",
        nodeType: NodeTypes.compute,
        schedulable: true,
        supportsRemoteScheduling: true,
        enabledCapabilities: [NodeRoleCapabilities.executor],
        usageMode: SchedulingNodeUsageModes.idle,
      },
    });

    expect(eligible.eligible).toBeTrue();
    expect(eligible.denialReasons).toEqual([]);
    expect(eligible.scorecard.priorityBand).toBe(SchedulingRunPriorityBands.high);
    expect(eligible.scorecard.queueAgeSeconds).toBe(30);
  });

  it("builds explainable policy decisions and validates canonical decision constraints", () => {
    const candidate = evaluateSchedulingCandidate({
      asOf: "2026-04-07T15:00:00.000Z",
      run: {
        runId: "run:scheduling:3",
        workspaceRoleKeys: [WorkspaceAuthorizationRoleKeys.member],
        requirements: {
          requiredCapabilities: [NodeRoleCapabilities.executor],
          requiresRemoteScheduling: true,
        },
        queue: {
          queueId: "queue:default",
          enteredAt: "2026-04-07T14:59:00.000Z",
          eligibleAt: "2026-04-07T14:59:00.000Z",
          claimToken: "claim:3",
          claimOwner: "scheduler-a",
        },
      },
      node: {
        nodeId: "node:compute:2",
        nodeType: NodeTypes.compute,
        schedulable: true,
        supportsRemoteScheduling: true,
        enabledCapabilities: [NodeRoleCapabilities.executor],
        usageMode: SchedulingNodeUsageModes.idle,
      },
    });

    const decision = createSchedulingPolicyDecision({
      decisionId: "decision:1",
      occurredAt: "2026-04-07T15:00:01.000Z",
      outcome: SchedulingDecisionOutcomes.assignmentRecommended,
      selected: {
        runId: candidate.runId,
        nodeId: candidate.nodeId,
        claimToken: "claim:3",
        reservationOwner: "scheduler-a",
      },
      evaluatedCandidates: [candidate],
      reasons: [{ code: "role-priority", message: "Owner/admin/member precedence applied." }],
      policySources: [
        SchedulingPolicySourceKinds.runSubmission,
        SchedulingPolicySourceKinds.workspaceMembershipRoles,
        SchedulingPolicySourceKinds.nodeTrustInventory,
      ],
    });

    expect(decision.outcome).toBe(SchedulingDecisionOutcomes.assignmentRecommended);
    expect(decision.selected?.nodeId).toBe("node:compute:2");
    expect(decision.policySources).toContain(SchedulingPolicySourceKinds.workspaceMembershipRoles);

    expect(() => createSchedulingPolicyDecision({
      decisionId: "decision:invalid",
      occurredAt: "2026-04-07T15:00:02.000Z",
      outcome: SchedulingDecisionOutcomes.deferred,
      selected: {
        runId: "run:scheduling:3",
        nodeId: "node:compute:2",
        claimToken: "claim:3",
        reservationOwner: "scheduler-a",
      },
      evaluatedCandidates: [candidate],
      policySources: [SchedulingPolicySourceKinds.runSubmission],
    })).toThrow(SchedulingDomainError);

    expect(() => createSchedulingPolicyDecision({
      decisionId: "decision:missing-sources",
      occurredAt: "2026-04-07T15:00:03.000Z",
      outcome: SchedulingDecisionOutcomes.denied,
      evaluatedCandidates: [candidate],
      policySources: [],
    })).toThrow("policySources");
  });
});
