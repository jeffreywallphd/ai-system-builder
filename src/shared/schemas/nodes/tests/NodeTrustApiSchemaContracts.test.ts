import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../../domain/nodes/NodeTrustDomain";
import {
  NodeDetailDtoSchema,
  NodeEnrollmentSubmissionRequestDtoSchema,
  NodeHeartbeatPayloadDtoSchema,
  parseNodeInventoryDetailResponseDto,
  parseNodeInventoryListResponseDto,
  NodeTrustApiSchemaValidationError,
  parseNodeDetailDto,
  parseNodeEnrollmentDecisionResponseDto,
  parseNodeEnrollmentSubmissionRequestDto,
  parseNodePendingEnrollmentSummaryDto,
} from "../NodeTrustApiSchemaContracts";

describe("NodeTrustApiSchemaContracts", () => {
  it("accepts canonical enrollment submission payloads", () => {
    const parsed = NodeEnrollmentSubmissionRequestDtoSchema.parse({
      actorUserIdentityId: "user:node-operator-1",
      nodeId: "node:compute-001",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 001",
      capabilityProfile: {
        enabledCapabilities: [
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.api,
        ],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["us-east-1", "gpu"],
      bootstrap: {
        bootstrapTokenId: "bootstrap:token-1",
        attestationFormat: "tpm-quote",
      },
      requestedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(parsed.nodeId).toBe("node:compute-001");
    expect(parsed.bootstrap?.bootstrapTokenId).toBe("bootstrap:token-1");
  });

  it("rejects capability profiles with duplicate capabilities", () => {
    expect(() => NodeEnrollmentSubmissionRequestDtoSchema.parse({
      actorUserIdentityId: "user:node-operator-1",
      nodeId: "node:compute-001",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 001",
      capabilityProfile: {
        enabledCapabilities: [
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.executor,
        ],
        supportsRemoteScheduling: true,
      },
    })).toThrow("must not include duplicates");
  });

  it("rejects incomplete scheduler and ui capability combinations", () => {
    expect(() => NodeEnrollmentSubmissionRequestDtoSchema.parse({
      actorUserIdentityId: "user:node-operator-1",
      nodeId: "node:compute-001",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 001",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.scheduler, NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
    })).toThrow("must also include 'api'");

    expect(() => NodeEnrollmentSubmissionRequestDtoSchema.parse({
      actorUserIdentityId: "user:node-operator-1",
      nodeId: "node:compute-002",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 002",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.ui],
        supportsRemoteScheduling: false,
      },
    })).toThrow("must also include 'api'");
  });

  it("rejects bootstrap payloads that provide no bootstrap material", () => {
    expect(() => NodeEnrollmentSubmissionRequestDtoSchema.parse({
      actorUserIdentityId: "user:node-operator-1",
      nodeId: "node:compute-001",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 001",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      bootstrap: {},
    })).toThrow("Bootstrap envelope must include at least one bootstrap field");
  });

  it("accepts bootstrap payloads with public trust material details", () => {
    const parsed = parseNodeEnrollmentSubmissionRequestDto({
      actorUserIdentityId: "node:compute-1",
      nodeId: "node:compute-1",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      bootstrap: {
        trustMaterialRef: "node-public-key:spki-sha256:abc123",
        publicKeyAlgorithm: "ed25519",
        publicKeyFingerprintSha256: "06cc95adf2bc86f465ee0a5f9f9f7305fd0f273577f8d1808cd5551f0bb7f8bf",
        publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----",
      },
    });

    expect(parsed.bootstrap?.trustMaterialRef).toBe("node-public-key:spki-sha256:abc123");
    expect(parsed.bootstrap?.publicKeyAlgorithm).toBe("ed25519");
  });

  it("rejects bootstrap payloads with public key material missing trust reference", () => {
    expect(() => parseNodeEnrollmentSubmissionRequestDto({
      actorUserIdentityId: "node:compute-1",
      nodeId: "node:compute-1",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      bootstrap: {
        publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----",
      },
    })).toThrow("requires trustMaterialRef");
  });

  it("rejects internal-only certificate fields from admin node detail payloads", () => {
    expect(() => NodeDetailDtoSchema.parse({
      nodeId: "node:compute-002",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 002",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["us-east-1"],
      certificate: {
        certificateRef: "cert:node-2:v1",
        certificateAuthorityRef: "ca:internal",
      },
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
    })).toThrow();
  });

  it("validates revoked node detail requires revoked revocation state", () => {
    expect(() => NodeDetailDtoSchema.parse({
      nodeId: "node:compute-003",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 003",
      approvalStatus: NodeApprovalStatuses.rejected,
      trustState: NodeTrustStates.revoked,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.api],
        supportsRemoteScheduling: false,
      },
      deploymentTags: ["isolated"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      revokedAt: "2026-04-05T12:30:00.000Z",
    })).toThrow("requires revocation.state='revoked'");
  });

  it("accepts heartbeat payload contracts", () => {
    const parsed = NodeHeartbeatPayloadDtoSchema.parse({
      actorUserIdentityId: "service:heartbeat-gateway",
      nodeId: "node:hybrid-001",
      heartbeatStatus: NodeHeartbeatStatuses.degraded,
      seenAt: "2026-04-05T12:22:00.000Z",
      observedBy: "service:heartbeat-gateway",
    });

    expect(parsed.heartbeatStatus).toBe(NodeHeartbeatStatuses.degraded);
    expect(parsed.observedBy).toBe("service:heartbeat-gateway");
  });

  it("returns typed validation details from parse helpers", () => {
    expect(() => parseNodeEnrollmentSubmissionRequestDto({
      actorUserIdentityId: "",
      nodeType: NodeTypes.compute,
    })).toThrow(NodeTrustApiSchemaValidationError);

    try {
      parseNodeDetailDto({
        nodeId: "node:compute-004",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 004",
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-east-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T12:00:00.000Z",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(NodeTrustApiSchemaValidationError);
      if (!(error instanceof NodeTrustApiSchemaValidationError)) {
        return;
      }

      expect(error.schemaName).toBe("NodeDetailDto");
      expect(error.issues.some((issue) => issue.path === "certificate")).toBeTrue();
    }
  });

  it("accepts revoked payload with full revocation reason metadata", () => {
    const parsed = NodeDetailDtoSchema.parse({
      nodeId: "node:compute-005",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 005",
      approvalStatus: NodeApprovalStatuses.rejected,
      trustState: NodeTrustStates.revoked,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.api],
        supportsRemoteScheduling: false,
      },
      deploymentTags: ["isolated"],
      revocation: {
        state: NodeRevocationStates.revoked,
        reason: NodeRevocationReasons.operatorAction,
        revokedAt: "2026-04-05T12:30:00.000Z",
        note: "operator action",
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      revokedAt: "2026-04-05T12:30:00.000Z",
    });

    expect(parsed.trustState).toBe(NodeTrustStates.revoked);
    expect(parsed.revocation.reason).toBe(NodeRevocationReasons.operatorAction);
  });

  it("accepts enrollment detail payload lifecycle fields", () => {
    const parsed = parseNodeDetailDto({
      nodeId: "node:compute-006",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 006",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["gpu"],
      certificate: {
        certificateRef: "cert:node-6:v1",
      },
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      approvedAt: "2026-04-05T12:10:00.000Z",
    });

    expect(parsed.approvedAt).toBe("2026-04-05T12:10:00.000Z");
  });

  it("rejects heartbeat payload with malformed timestamp", () => {
    expect(() => NodeHeartbeatPayloadDtoSchema.parse({
      actorUserIdentityId: "service:heartbeat-gateway",
      nodeId: "node:hybrid-001",
      heartbeatStatus: NodeHeartbeatStatuses.online,
      seenAt: "not-a-time",
    })).toThrow();
  });

  it("parses decision response payloads for approve/reject transport boundaries", () => {
    const parsed = parseNodeEnrollmentDecisionResponseDto({
      enrollment: {
        requestId: "enrollment:decision-1",
        nodeId: "node:compute-008",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 008",
        status: NodeEnrollmentRequestStatuses.approved,
        requestedAt: "2026-04-05T12:00:00.000Z",
        reviewedAt: "2026-04-05T12:05:00.000Z",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["default"],
        certificateRef: "cert:node-8:v1",
      },
      node: {
        nodeId: "node:compute-008",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 008",
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["default"],
        certificate: {
          certificateRef: "cert:node-8:v1",
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T12:00:00.000Z",
        approvedAt: "2026-04-05T12:05:00.000Z",
      },
    });

    expect(parsed.node.trustState).toBe(NodeTrustStates.trusted);
    expect(parsed.enrollment.status).toBe(NodeEnrollmentRequestStatuses.approved);
  });

  it("accepts pending enrollment statuses but rejects terminal statuses in summary DTO", () => {
    const pending = {
      requestId: "enrollment:ok",
      nodeId: "node:compute-007",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 007",
      requestedAt: "2026-04-05T12:00:00.000Z",
      status: NodeEnrollmentRequestStatuses.submitted,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["default"],
      hasBootstrapMaterial: false,
    };

    const parsed = parseNodePendingEnrollmentSummaryDto(pending);
    expect(parsed.status).toBe(NodeEnrollmentRequestStatuses.submitted);

    expect(() => parseNodePendingEnrollmentSummaryDto({
      ...pending,
      status: NodeEnrollmentRequestStatuses.approved,
    })).toThrow(NodeTrustApiSchemaValidationError);
  });

  it("parses inventory list/detail response payloads for admin inventory routes", () => {
    const list = parseNodeInventoryListResponseDto({
      nodes: [{
        nodeId: "node:inventory:1",
        nodeType: NodeTypes.compute,
        displayName: "Inventory 1",
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        operationalState: "offline",
        presenceState: "offline",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["inventory"],
        lastSeen: {
          lastSeenAt: "2026-04-05T12:22:00.000Z",
          heartbeatStatus: NodeHeartbeatStatuses.offline,
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T12:00:00.000Z",
        approvedAt: "2026-04-05T12:05:00.000Z",
      }],
    });
    expect(list.nodes[0]?.operationalState).toBe("offline");

    const detail = parseNodeInventoryDetailResponseDto({
      node: {
        nodeId: "node:inventory:pending-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Inventory Pending 1",
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingEnrollment,
        enrollmentStatus: NodeEnrollmentRequestStatuses.submitted,
        operationalState: "pending",
        presenceState: "unknown",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["inventory"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        requestedAt: "2026-04-05T12:22:00.000Z",
        pendingEnrollmentRequestId: "enrollment:pending-1",
        pendingEnrollment: {
          requestId: "enrollment:pending-1",
          status: NodeEnrollmentRequestStatuses.submitted,
          requestedAt: "2026-04-05T12:22:00.000Z",
        },
      },
    });
    expect(detail.node.pendingEnrollment?.requestId).toBe("enrollment:pending-1");
  });
});
