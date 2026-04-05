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
  NodeInventoryOperationalStates,
  NodeInventoryPresenceStates,
  NodeTrustApiContractError,
  NodeTrustTransportScopes,
  type NodeOperationalUpdateResponseDto,
  type NodeRuntimeTrustMaterialResponseDto,
  toNodeInventoryDetailDto,
  toNodeInventorySummaryDto,
  toNodeDetailDto,
  toNodeEnrollmentDetailDto,
  toNodePendingEnrollmentSummaryDto,
} from "../NodeTrustApiContracts";

describe("NodeTrustApiContracts", () => {
  it("defines explicit admin/internal transport scopes", () => {
    expect(NodeTrustTransportScopes.admin).toBe("admin");
    expect(NodeTrustTransportScopes.internal).toBe("internal");
  });

  it("projects internal node detail to admin-safe node detail", () => {
    const admin = toNodeDetailDto({
      nodeId: "node:compute-1",
      nodeType: NodeTypes.compute,
      displayName: "Compute 1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["us-east-1"],
      certificate: {
        certificateRef: "cert:node-1:v1",
        certificateAssignedAt: "2026-04-05T12:01:00.000Z",
        certificateExpiresAt: "2027-04-05T12:01:00.000Z",
        certificateAuthorityRef: "ca:1",
        certificateThumbprint: "thumbprint-1",
      },
      lastSeen: {
        lastSeenAt: "2026-04-05T12:02:00.000Z",
        heartbeatStatus: NodeHeartbeatStatuses.online,
        observedBy: "heartbeat-service",
      },
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      approvedAt: "2026-04-05T12:01:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system-bootstrap",
      lastModifiedAt: "2026-04-05T12:01:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 2,
    });

    expect(admin.certificate?.certificateRef).toBe("cert:node-1:v1");
    expect((admin as unknown as { createdBy?: string }).createdBy).toBeUndefined();
    expect(
      (admin.certificate as unknown as { certificateAuthorityRef?: string })?.certificateAuthorityRef,
    ).toBeUndefined();
  });

  it("projects internal enrollment detail to admin-safe enrollment detail", () => {
    const admin = toNodeEnrollmentDetailDto({
      requestId: "enrollment:1",
      nodeId: "node:hybrid-1",
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid 1",
      status: NodeEnrollmentRequestStatuses.underReview,
      requestedAt: "2026-04-05T12:00:00.000Z",
      reviewedAt: "2026-04-05T12:02:00.000Z",
      reviewedByUserIdentityId: "admin-1",
      decisionNote: "pending cert",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["hybrid"],
      certificateRef: "cert:pending",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "node:hybrid-1",
      lastModifiedAt: "2026-04-05T12:02:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 3,
    });

    expect(admin.requestId).toBe("enrollment:1");
    expect((admin as unknown as { createdBy?: string }).createdBy).toBeUndefined();
    expect((admin as unknown as { reviewedByUserIdentityId?: string }).reviewedByUserIdentityId).toBeUndefined();
  });

  it("builds pending enrollment summaries from internal enrollment records", () => {
    const summary = toNodePendingEnrollmentSummaryDto({
      requestId: "enrollment:2",
      nodeId: "node:compute-2",
      nodeType: NodeTypes.compute,
      displayName: "Compute 2",
      status: NodeEnrollmentRequestStatuses.underReview,
      requestedAt: "2026-04-05T12:00:00.000Z",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: false,
      },
      deploymentTags: ["gpu"],
      certificateRef: "cert:pending",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "node:compute-2",
      lastModifiedAt: "2026-04-05T12:01:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 1,
    });

    expect(summary.status).toBe(NodeEnrollmentRequestStatuses.underReview);
    expect(summary.hasBootstrapMaterial).toBeTrue();
    expect(summary.deploymentTags).toEqual(["gpu"]);
  });

  it("rejects terminal enrollment states when building pending enrollment summaries", () => {
    expect(() => toNodePendingEnrollmentSummaryDto({
      requestId: "enrollment:3",
      nodeId: "node:compute-3",
      nodeType: NodeTypes.compute,
      displayName: "Compute 3",
      status: NodeEnrollmentRequestStatuses.approved,
      requestedAt: "2026-04-05T12:00:00.000Z",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: false,
      },
      deploymentTags: ["gpu"],
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "node:compute-3",
      lastModifiedAt: "2026-04-05T12:01:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 1,
    })).toThrow(NodeTrustApiContractError);
  });

  it("preserves revocation metadata for admin view while hiding revokedBy identity", () => {
    const admin = toNodeDetailDto({
      nodeId: "node:compute-9",
      nodeType: NodeTypes.compute,
      displayName: "Compute 9",
      approvalStatus: NodeApprovalStatuses.rejected,
      trustState: NodeTrustStates.revoked,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.api],
        supportsRemoteScheduling: false,
      },
      deploymentTags: ["isolated"],
      revocation: {
        state: NodeRevocationStates.revoked,
        reason: NodeRevocationReasons.policyViolation,
        revokedAt: "2026-04-05T12:10:00.000Z",
        revokedByUserIdentityId: "admin-9",
        note: "policy violation",
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      revokedAt: "2026-04-05T12:10:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system",
      lastModifiedAt: "2026-04-05T12:10:00.000Z",
      lastModifiedBy: "admin-9",
      revision: 5,
    });

    expect(admin.revocation.reason).toBe(NodeRevocationReasons.policyViolation);
    expect((admin.revocation as unknown as { revokedByUserIdentityId?: string }).revokedByUserIdentityId).toBeUndefined();
  });

  it("projects internal inventory summary to admin-safe summary", () => {
    const summary = toNodeInventorySummaryDto({
      nodeId: "node:compute:inventory-1",
      nodeType: NodeTypes.compute,
      displayName: "Inventory 1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      operationalState: NodeInventoryOperationalStates.active,
      presenceState: NodeInventoryPresenceStates.online,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["inventory"],
      lastSeen: {
        lastSeenAt: "2026-04-05T12:12:00.000Z",
        heartbeatStatus: NodeHeartbeatStatuses.online,
      },
      certificateRef: "cert:inventory-1:v1",
      revocation: {
        state: NodeRevocationStates.active,
        revokedByUserIdentityId: "admin-hidden",
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      approvedAt: "2026-04-05T12:05:00.000Z",
    });

    expect(summary.operationalState).toBe(NodeInventoryOperationalStates.active);
    expect(summary.revocation.state).toBe(NodeRevocationStates.active);
    expect((summary.revocation as unknown as { revokedByUserIdentityId?: string }).revokedByUserIdentityId).toBeUndefined();
  });

  it("projects internal inventory detail with pending enrollment metadata", () => {
    const detail = toNodeInventoryDetailDto({
      nodeId: "node:pending:inventory-2",
      nodeType: NodeTypes.hybrid,
      displayName: "Inventory 2",
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingEnrollment,
      enrollmentStatus: NodeEnrollmentRequestStatuses.submitted,
      operationalState: NodeInventoryOperationalStates.pending,
      presenceState: NodeInventoryPresenceStates.unknown,
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["inventory"],
      certificateRef: "trust-material:inventory-2",
      revocation: {
        state: NodeRevocationStates.active,
      },
      requestedAt: "2026-04-05T12:10:00.000Z",
      pendingEnrollmentRequestId: "enrollment:inventory-2",
      pendingEnrollment: {
        requestId: "enrollment:inventory-2",
        status: NodeEnrollmentRequestStatuses.submitted,
        requestedAt: "2026-04-05T12:10:00.000Z",
      },
    });

    expect(detail.pendingEnrollment?.requestId).toBe("enrollment:inventory-2");
    expect(detail.operationalState).toBe(NodeInventoryOperationalStates.pending);
  });

  it("supports runtime trust material response contracts for node runtime retrieval", () => {
    const response: NodeRuntimeTrustMaterialResponseDto = Object.freeze({
      runtimeTrustMaterial: Object.freeze({
        packageId: "runtime-trust-package:node:node:compute-1",
        occurredAt: "2026-04-05T12:45:00.000Z",
        certificateAuthorityId: "ca:internal:root:v1",
        serialNumber: "AA11",
        targetKind: "node",
        targetReferenceId: "node:compute-1",
        leafCertificatePem: "-----BEGIN CERTIFICATE-----leaf-----END CERTIFICATE-----",
        certificateChainPem: "-----BEGIN CERTIFICATE-----chain-----END CERTIFICATE-----",
        trustBundlePem: "-----BEGIN CERTIFICATE-----bundle-----END CERTIFICATE-----",
        protectedReferences: Object.freeze([]),
      }),
    });

    expect(response.runtimeTrustMaterial.targetKind).toBe("node");
    expect(response.runtimeTrustMaterial.targetReferenceId).toBe("node:compute-1");
  });

  it("supports operational update response contracts for secure heartbeat/capability exchange", () => {
    const response: NodeOperationalUpdateResponseDto = Object.freeze({
      node: {
        nodeId: "node:compute-10",
        nodeType: NodeTypes.compute,
        displayName: "Compute 10",
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["edge-west"],
        certificate: {
          certificateRef: "cert:node-10:v1",
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T12:00:00.000Z",
        approvedAt: "2026-04-05T12:05:00.000Z",
      },
      update: {
        heartbeatRecorded: true,
        capabilityProfileSynchronized: true,
        deploymentTagsSynchronized: false,
        transportAuthenticatedNodeId: "node:compute-10",
      },
    });

    expect(response.update.heartbeatRecorded).toBeTrue();
    expect(response.update.transportAuthenticatedNodeId).toBe("node:compute-10");
  });
});
