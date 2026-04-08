import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "../NodeTrustDomain";
import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeActivationTransitionError,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  createExecutionNodeRecord,
  evaluateImageExecutionNodeEligibility,
  isExecutionNodeActivationTransitionAllowed,
  recordExecutionNodeHealth,
  transitionExecutionNodeActivationStatus,
} from "../ExecutionNodeDomain";

describe("ExecutionNodeDomain", () => {
  function createTrustedExecutionNode() {
    return createExecutionNodeRecord({
      nodeId: "node:compute:image-alpha",
      displayName: "Image Alpha",
      nodeType: NodeTypes.compute,
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
        maxConcurrentWorkloads: 4,
      }),
      backendFamilyCapabilities: [
        {
          backendFamily: "adapter.comfyui.image-manipulation",
          supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
          capabilityProfileVersion: "2026.04.08",
          metadataTags: ["comfyui", "gpu"],
        },
      ],
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      activationStatus: ExecutionNodeActivationStatuses.active,
      healthStatus: ExecutionNodeHealthStatuses.ready,
      deploymentTags: ["GPU", "east-us", "gpu"],
      endpoint: {
        endpointRef: "node-endpoint:image-alpha",
        configurationRef: "node-config:image-alpha",
      },
      certificateRef: "certificate:node:image-alpha",
      lastSeenAt: "2026-04-08T12:00:00.000Z",
      createdAt: "2026-04-08T11:00:00.000Z",
      updatedAt: "2026-04-08T12:00:00.000Z",
      metadata: {
        runtimeClass: "gpu-a10",
      },
    });
  }

  it("models backend-hosting execution nodes with explicit identity and capability metadata", () => {
    const node = createTrustedExecutionNode();

    expect(node.nodeId).toBe("node:compute:image-alpha");
    expect(node.backendFamilyCapabilities[0]?.backendFamily).toBe("adapter.comfyui.image-manipulation");
    expect(node.backendFamilyCapabilities[0]?.supportedExecutionTargets).toEqual([
      ExecutionNodeTargetKinds.imageManipulation,
    ]);
    expect(node.deploymentTags).toEqual(["gpu", "east-us"]);
    expect(node.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
  });

  it("enforces trust/approval invariants for routable activation statuses", () => {
    expect(() => createExecutionNodeRecord({
      nodeId: "node:compute:image-beta",
      displayName: "Image Beta",
      nodeType: NodeTypes.compute,
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
      }),
      backendFamilyCapabilities: [
        {
          backendFamily: "adapter.comfyui.image-manipulation",
          supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
        },
      ],
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
      activationStatus: ExecutionNodeActivationStatuses.active,
      healthStatus: ExecutionNodeHealthStatuses.ready,
      endpoint: { endpointRef: "node-endpoint:image-beta" },
      createdAt: "2026-04-08T11:00:00.000Z",
      updatedAt: "2026-04-08T11:01:00.000Z",
    })).toThrow("requires approvalStatus='approved'");
  });

  it("supports explicit activation lifecycle transitions and rejects invalid transitions", () => {
    const base = createExecutionNodeRecord({
      nodeId: "node:compute:image-gamma",
      displayName: "Image Gamma",
      nodeType: NodeTypes.compute,
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
      }),
      backendFamilyCapabilities: [
        {
          backendFamily: "adapter.comfyui.image-manipulation",
          supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
        },
      ],
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
      activationStatus: ExecutionNodeActivationStatuses.approved,
      healthStatus: ExecutionNodeHealthStatuses.unknown,
      endpoint: { endpointRef: "node-endpoint:image-gamma" },
      createdAt: "2026-04-08T11:00:00.000Z",
      updatedAt: "2026-04-08T11:00:00.000Z",
    });

    expect(isExecutionNodeActivationTransitionAllowed(
      ExecutionNodeActivationStatuses.approved,
      ExecutionNodeActivationStatuses.active,
    )).toBeTrue();
    expect(isExecutionNodeActivationTransitionAllowed(
      ExecutionNodeActivationStatuses.revoked,
      ExecutionNodeActivationStatuses.active,
    )).toBeFalse();

    const trusted = createExecutionNodeRecord({
      ...base,
      trustState: NodeTrustStates.trusted,
      certificateRef: "certificate:node:image-gamma",
    });

    const active = transitionExecutionNodeActivationStatus(
      trusted,
      ExecutionNodeActivationStatuses.active,
      new Date("2026-04-08T11:10:00.000Z"),
    );
    expect(active.activationStatus).toBe(ExecutionNodeActivationStatuses.active);

    expect(() => transitionExecutionNodeActivationStatus(
      active,
      ExecutionNodeActivationStatuses.pending,
      new Date("2026-04-08T11:11:00.000Z"),
    )).toThrow(ExecutionNodeActivationTransitionError);
  });

  it("evaluates image execution eligibility against backend, capability, and readiness constraints", () => {
    const node = createTrustedExecutionNode();
    const eligible = evaluateImageExecutionNodeEligibility(node, {
      requiredBackendFamily: "adapter.comfyui.image-manipulation",
      requiredExecutionTarget: ExecutionNodeTargetKinds.imageManipulation,
      requiredCapabilities: [NodeRoleCapabilities.api],
      requiresRemoteScheduling: true,
      maxLastSeenAgeMs: 15 * 60 * 1000,
      now: "2026-04-08T12:10:00.000Z",
    });
    expect(eligible.isEligible).toBeTrue();
    expect(eligible.reasons).toEqual([]);

    const stale = evaluateImageExecutionNodeEligibility(node, {
      requiredBackendFamily: "adapter.comfyui.image-manipulation",
      maxLastSeenAgeMs: 5 * 60 * 1000,
      now: "2026-04-08T12:10:00.000Z",
    });
    expect(stale.isEligible).toBeFalse();
    expect(stale.reasons).toContain("node-last-seen-stale");

    const unsupportedBackend = evaluateImageExecutionNodeEligibility(node, {
      requiredBackendFamily: "adapter.unknown.image-manipulation",
    });
    expect(unsupportedBackend.isEligible).toBeFalse();
    expect(unsupportedBackend.reasons).toContain("node-backend-family-unsupported");
  });

  it("records health observations and enforces consistent health-to-activation semantics", () => {
    const node = createTrustedExecutionNode();
    const degraded = recordExecutionNodeHealth(node, {
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      observedAt: "2026-04-08T12:03:00.000Z",
    });

    expect(degraded.healthStatus).toBe(ExecutionNodeHealthStatuses.degraded);
    expect(degraded.lastSeenAt).toBe("2026-04-08T12:03:00.000Z");
  });
});

