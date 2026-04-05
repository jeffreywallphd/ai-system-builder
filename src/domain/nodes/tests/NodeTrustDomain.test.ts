import { describe, expect, it } from "bun:test";
import {
  NodeApprovalLifecycleTransitionError,
  NodeApprovalLifecycleTransitions,
  NodeApprovalStatuses,
  NodeEnrollmentLifecycleTransitionError,
  NodeEnrollmentRequestLifecycleTransitions,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRoleCapabilities,
  NodeTrustDomainError,
  NodeTrustLifecycleTransitionError,
  NodeTrustLifecycleTransitions,
  NodeTrustStates,
  NodeTypes,
  assignNodeCertificate,
  createNodeCapabilityProfile,
  createNodeEnrollmentRequest,
  createNodeIdentity,
  isNodeApprovalTransitionAllowed,
  isNodeEnrollmentRequestTransitionAllowed,
  isNodeTrustTransitionAllowed,
  recordNodeLastSeen,
  revokeNodeIdentity,
  setNodeCapabilityProfile,
  transitionNodeApprovalStatus,
  transitionNodeEnrollmentRequestStatus,
  transitionNodeTrustState,
} from "../NodeTrustDomain";

describe("NodeTrustDomain", () => {
  it("models capability-enabled nodes with explicit profile semantics", () => {
    const capabilityProfile = createNodeCapabilityProfile({
      enabledCapabilities: [
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.api,
      ],
      capabilityProfileVersion: "v1",
      maxConcurrentWorkloads: 4,
    });

    const node = createNodeIdentity({
      nodeId: "node:compute:alpha",
      nodeType: NodeTypes.compute,
      displayName: "Compute Alpha",
      capabilityProfile,
      deploymentTags: ["GPU", "gpu", "east-us"],
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    expect(node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
    ]);
    expect(node.deploymentTags).toEqual(["gpu", "east-us"]);
    expect(node.approvalStatus).toBe(NodeApprovalStatuses.pending);
    expect(node.trustState).toBe(NodeTrustStates.pendingEnrollment);
  });

  it("requires approval and certificate before a node can be trusted", () => {
    const node = createNodeIdentity({
      nodeId: "node:hybrid:beta",
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Beta",
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [
          NodeRoleCapabilities.api,
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.scheduler,
        ],
      }),
      trustState: NodeTrustStates.pendingApproval,
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    const approved = transitionNodeApprovalStatus(
      node,
      NodeApprovalStatuses.approved,
      new Date("2026-04-05T12:05:00.000Z"),
    );

    expect(() => transitionNodeTrustState(
      approved,
      NodeTrustStates.trusted,
      new Date("2026-04-05T12:06:00.000Z"),
    )).toThrow("certificateRef");

    const withCertificate = assignNodeCertificate(
      approved,
      "certificate:node:hybrid:beta",
      new Date("2026-04-05T12:06:00.000Z"),
    );

    const trusted = transitionNodeTrustState(
      withCertificate,
      NodeTrustStates.trusted,
      new Date("2026-04-05T12:07:00.000Z"),
    );

    expect(trusted.trustState).toBe(NodeTrustStates.trusted);
    expect(trusted.certificateRef).toBe("certificate:node:hybrid:beta");
  });

  it("supports enrollment request lifecycle transitions with deterministic guards", () => {
    const request = createNodeEnrollmentRequest({
      requestId: "enrollment-request:1",
      nodeId: "node:compute:gamma",
      nodeType: NodeTypes.compute,
      displayName: "Compute Gamma",
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.api],
      }),
      requestedAt: "2026-04-05T12:00:00.000Z",
    });

    const inReview = transitionNodeEnrollmentRequestStatus(
      request,
      NodeEnrollmentRequestStatuses.underReview,
      { reviewedAt: "2026-04-05T12:01:00.000Z" },
    );

    const approved = transitionNodeEnrollmentRequestStatus(
      inReview,
      NodeEnrollmentRequestStatuses.approved,
      {
        reviewedAt: "2026-04-05T12:02:00.000Z",
        reviewedByUserIdentityId: "user:reviewer:1",
      },
    );

    expect(approved.status).toBe(NodeEnrollmentRequestStatuses.approved);
    expect(approved.reviewedAt).toBe("2026-04-05T12:02:00.000Z");
    expect(() => transitionNodeEnrollmentRequestStatus(
      approved,
      NodeEnrollmentRequestStatuses.underReview,
    )).toThrow(NodeEnrollmentLifecycleTransitionError);
  });

  it("tracks last-seen metadata and blocks revoked-node heartbeat updates", () => {
    const base = createNodeIdentity({
      nodeId: "node:edge:delta",
      nodeType: NodeTypes.edge,
      displayName: "Edge Delta",
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.storageAccess],
      }),
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    const seen = recordNodeLastSeen(base, {
      seenAt: "2026-04-05T12:10:00.000Z",
      heartbeatStatus: NodeHeartbeatStatuses.degraded,
      observedBy: "heartbeat-service",
    });

    expect(seen.lastSeen?.lastSeenAt).toBe("2026-04-05T12:10:00.000Z");
    expect(seen.lastSeen?.heartbeatStatus).toBe(NodeHeartbeatStatuses.degraded);

    const revoked = revokeNodeIdentity(seen, {
      reason: NodeRevocationReasons.policyViolation,
      revokedAt: "2026-04-05T12:15:00.000Z",
      revokedByUserIdentityId: "user:security:1",
    });

    expect(revoked.revokedAt).toBe("2026-04-05T12:15:00.000Z");
    expect(() => recordNodeLastSeen(revoked, {
      seenAt: "2026-04-05T12:20:00.000Z",
    })).toThrow(NodeTrustDomainError);
  });

  it("enforces explicit transition vocabularies for approval, trust, and enrollment", () => {
    expect(NodeApprovalLifecycleTransitions.pending).toEqual([
      NodeApprovalStatuses.approved,
      NodeApprovalStatuses.rejected,
    ]);
    expect(NodeTrustLifecycleTransitions.pendingApproval).toEqual([
      NodeTrustStates.trusted,
      NodeTrustStates.quarantined,
      NodeTrustStates.revoked,
    ]);
    expect(NodeEnrollmentRequestLifecycleTransitions.submitted).toEqual([
      NodeEnrollmentRequestStatuses.underReview,
      NodeEnrollmentRequestStatuses.withdrawn,
      NodeEnrollmentRequestStatuses.expired,
    ]);

    expect(isNodeApprovalTransitionAllowed(NodeApprovalStatuses.approved, NodeApprovalStatuses.pending)).toBeFalse();
    expect(isNodeTrustTransitionAllowed(NodeTrustStates.trusted, NodeTrustStates.pendingEnrollment)).toBeFalse();
    expect(isNodeEnrollmentRequestTransitionAllowed(
      NodeEnrollmentRequestStatuses.underReview,
      NodeEnrollmentRequestStatuses.rejected,
    )).toBeTrue();
  });

  it("rejects invalid lifecycle transitions and capability-profile invariants", () => {
    expect(() => createNodeCapabilityProfile({
      enabledCapabilities: [],
    })).toThrow("at least one enabled capability");

    const node = createNodeIdentity({
      nodeId: "node:compute:zeta",
      nodeType: NodeTypes.compute,
      displayName: "Compute Zeta",
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.executor],
      }),
      createdAt: "2026-04-05T12:00:00.000Z",
      enrolledAt: "2026-04-05T12:00:00.000Z",
    });

    expect(() => transitionNodeApprovalStatus(
      node,
      NodeApprovalStatuses.suspended,
      new Date("2026-04-05T12:05:00.000Z"),
    )).toThrow(NodeApprovalLifecycleTransitionError);

    expect(() => transitionNodeTrustState(
      node,
      NodeTrustStates.trusted,
      new Date("2026-04-05T12:05:00.000Z"),
    )).toThrow(NodeTrustLifecycleTransitionError);

    expect(() => setNodeCapabilityProfile(node, createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor],
      maxConcurrentWorkloads: 0,
    }))).toThrow("positive integer");

    expect(() => createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.ui],
    })).toThrow("must also include 'api'");

    expect(() => createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.scheduler, NodeRoleCapabilities.api],
    })).toThrow("must also include 'executor'");

    expect(() => createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.previewWorker],
    })).toThrow("must also include 'executor'");

    expect(() => createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.storageAccess],
      supportsRemoteScheduling: true,
    })).toThrow("supportsRemoteScheduling requires 'executor'");
  });
});
