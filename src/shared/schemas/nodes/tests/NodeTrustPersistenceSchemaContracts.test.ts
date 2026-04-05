import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../../domain/nodes/NodeTrustDomain";
import {
  NodeEnrollmentRequestPersistenceRecordSchema,
  NodeIdentityPersistenceRecordSchema,
  NodeTrustPersistenceSchemaValidationError,
  parseNodeIdentityPersistenceRecord,
} from "../NodeTrustPersistenceSchemaContracts";

describe("NodeTrustPersistenceSchemaContracts", () => {
  it("accepts trusted node persistence payloads with approval and certificate metadata", () => {
    const parsed = NodeIdentityPersistenceRecordSchema.parse({
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
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      certificate: {
        certificateRef: "cert:node-compute-001:v1",
      },
      deploymentTags: ["us-east-1", "gpu"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      approvedAt: "2026-04-05T12:01:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system-bootstrap",
      lastModifiedAt: "2026-04-05T12:01:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 1,
    });

    expect(parsed.trustState).toBe(NodeTrustStates.trusted);
    expect(parsed.certificate?.certificateRef).toBe("cert:node-compute-001:v1");
  });

  it("rejects trusted node payloads missing approval/certificate prerequisites", () => {
    expect(() => NodeIdentityPersistenceRecordSchema.parse({
      nodeId: "node:compute-002",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 002",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.trusted,
      deploymentTags: ["us-east-1"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system-bootstrap",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "system-bootstrap",
      revision: 0,
    })).toThrow("Trusted node records require approvalStatus='approved'");
  });

  it("rejects enrollment records approved without reviewedAt", () => {
    expect(() => NodeEnrollmentRequestPersistenceRecordSchema.parse({
      requestId: "enrollment:001",
      nodeId: "node:hybrid-001",
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Node 001",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["hybrid"],
      requestedAt: "2026-04-05T13:00:00.000Z",
      status: NodeEnrollmentRequestStatuses.approved,
      createdAt: "2026-04-05T13:00:00.000Z",
      createdBy: "node:hybrid-001",
      lastModifiedAt: "2026-04-05T13:01:00.000Z",
      lastModifiedBy: "admin-1",
      revision: 1,
    })).toThrow("Approved or rejected enrollment requests require reviewedAt");
  });

  it("returns typed validation details from parse helpers", () => {
    expect(() => parseNodeIdentityPersistenceRecord({
      nodeType: NodeTypes.compute,
    })).toThrow(NodeTrustPersistenceSchemaValidationError);
  });

  it("rejects incomplete capability combinations in persistence payloads", () => {
    expect(() => NodeIdentityPersistenceRecordSchema.parse({
      nodeId: "node:compute-003",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 003",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.previewWorker],
        supportsRemoteScheduling: false,
      },
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
      deploymentTags: ["us-east-1"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system-bootstrap",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "system-bootstrap",
      revision: 0,
    })).toThrow("must also include 'executor'");
  });
});
