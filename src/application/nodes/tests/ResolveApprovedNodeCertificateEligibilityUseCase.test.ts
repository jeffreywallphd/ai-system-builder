import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceLookupQuery,
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
  RecordNodeLastSeenPersistenceRecordInput,
  RegisterNodeIdentityPersistenceRecordInput,
  RevokeNodeIdentityPersistenceRecordInput,
  SaveNodeEnrollmentRequestPersistenceRecordInput,
  TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  UpdateNodeApprovalPersistenceRecordInput,
  UpdateNodeCapabilityProfilePersistenceRecordInput,
  UpdateNodeCertificateReferencePersistenceRecordInput,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import { ResolveApprovedNodeCertificateEligibilityUseCase } from "../use-cases/ResolveApprovedNodeCertificateEligibilityUseCase";

class InMemoryNodeTrustRepository
  implements INodeTrustIdentityPersistenceRepository, INodeEnrollmentRequestPersistenceRepository {
  public readonly nodes = new Map<string, NodeIdentityPersistenceRecord>();

  public readonly enrollments = new Map<string, NodeEnrollmentRequestPersistenceRecord>();

  async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.nodes.get(nodeId);
  }

  async listNodes(_query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    return [...this.nodes.values()];
  }

  async registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    this.nodes.set(input.record.nodeId, input.record);
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }

  async updateNodeApproval(
    _input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async updateNodeCertificateReference(
    _input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async updateNodeCapabilityProfile(
    _input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async revokeNode(
    _input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async recordNodeLastSeen(
    _input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async findEnrollmentRequestById(requestId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    return this.enrollments.get(requestId);
  }

  async findPendingEnrollmentRequestByNodeId(nodeId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    return [...this.enrollments.values()].find((record) => (
      record.nodeId === nodeId
      && (
        record.status === NodeEnrollmentRequestStatuses.submitted
        || record.status === NodeEnrollmentRequestStatuses.underReview
      )
    ));
  }

  async listEnrollmentRequests(
    _query: NodeEnrollmentRequestPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>> {
    return [...this.enrollments.values()];
  }

  async saveEnrollmentRequest(
    input: SaveNodeEnrollmentRequestPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    this.enrollments.set(input.record.requestId, input.record);
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }

  async transitionEnrollmentRequestStatus(
    _input: TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    throw new Error("not implemented in test");
  }
}

describe("ResolveApprovedNodeCertificateEligibilityUseCase", () => {
  it("returns eligible metadata for approved, non-revoked nodes with approved enrollment", async () => {
    const repository = new InMemoryNodeTrustRepository();
    repository.nodes.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
      enrollmentRequestId: "enroll:node:compute:1:v1",
    }));
    repository.enrollments.set("enroll:node:compute:1:v1", createEnrollment({
      requestId: "enroll:node:compute:1:v1",
      nodeId: "node:compute:1",
      status: NodeEnrollmentRequestStatuses.approved,
    }));

    const useCase = new ResolveApprovedNodeCertificateEligibilityUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
    });

    const decision = await useCase.resolveApprovedNodeCertificateEligibility({
      nodeId: "node:compute:1",
    });

    expect(decision.eligible).toBeTrue();
    if (decision.eligible) {
      expect(decision.metadata.nodeId).toBe("node:compute:1");
      expect(decision.metadata.enrollmentRequestId).toBe("enroll:node:compute:1:v1");
      expect(decision.metadata.capabilityProfile.enabledCapabilities).toContain(NodeRoleCapabilities.api);
    }
  });

  it("rejects issuance when enrollment linkage is missing or unapproved", async () => {
    const repository = new InMemoryNodeTrustRepository();
    repository.nodes.set("node:compute:2", createNode({
      nodeId: "node:compute:2",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
      enrollmentRequestId: "enroll:node:compute:2:v1",
    }));
    repository.enrollments.set("enroll:node:compute:2:v1", createEnrollment({
      requestId: "enroll:node:compute:2:v1",
      nodeId: "node:compute:2",
      status: NodeEnrollmentRequestStatuses.submitted,
    }));

    const useCase = new ResolveApprovedNodeCertificateEligibilityUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
    });

    const decision = await useCase.resolveApprovedNodeCertificateEligibility({
      nodeId: "node:compute:2",
    });

    expect(decision.eligible).toBeFalse();
    if (!decision.eligible) {
      expect(decision.violations.some((violation) => violation.includes("must be approved"))).toBeTrue();
    }
  });

  it("rejects issuance for revoked nodes and capability-profile drift", async () => {
    const repository = new InMemoryNodeTrustRepository();
    repository.nodes.set("node:compute:3", createNode({
      nodeId: "node:compute:3",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.revoked,
      enrollmentRequestId: "enroll:node:compute:3:v1",
      revocationState: NodeRevocationStates.revoked,
      nodeCapabilities: [NodeRoleCapabilities.executor],
    }));
    repository.enrollments.set("enroll:node:compute:3:v1", createEnrollment({
      requestId: "enroll:node:compute:3:v1",
      nodeId: "node:compute:3",
      status: NodeEnrollmentRequestStatuses.approved,
      enrollmentCapabilities: [NodeRoleCapabilities.api],
    }));

    const useCase = new ResolveApprovedNodeCertificateEligibilityUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
    });

    const decision = await useCase.resolveApprovedNodeCertificateEligibility({
      nodeId: "node:compute:3",
    });

    expect(decision.eligible).toBeFalse();
    if (!decision.eligible) {
      expect(decision.violations.some((violation) => violation.includes("revoked"))).toBeTrue();
      expect(decision.violations.some((violation) => violation.includes("capability profile does not match"))).toBeTrue();
    }
  });

  it("rejects malformed node capability profiles", async () => {
    const repository = new InMemoryNodeTrustRepository();
    repository.nodes.set("node:compute:4", Object.freeze({
      ...createNode({
        nodeId: "node:compute:4",
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.pendingApproval,
        enrollmentRequestId: "enroll:node:compute:4:v1",
      }),
      capabilityProfile: Object.freeze({
        enabledCapabilities: Object.freeze([NodeRoleCapabilities.api]),
        supportsRemoteScheduling: true,
      }),
    }));
    repository.enrollments.set("enroll:node:compute:4:v1", createEnrollment({
      requestId: "enroll:node:compute:4:v1",
      nodeId: "node:compute:4",
      status: NodeEnrollmentRequestStatuses.approved,
    }));

    const useCase = new ResolveApprovedNodeCertificateEligibilityUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
    });

    const decision = await useCase.resolveApprovedNodeCertificateEligibility({
      nodeId: "node:compute:4",
    });

    expect(decision.eligible).toBeFalse();
    if (!decision.eligible) {
      expect(decision.violations.some((violation) => violation.includes("capability profile is malformed"))).toBeTrue();
    }
  });
});

function createNode(input: {
  readonly nodeId: string;
  readonly approvalStatus: NodeIdentityPersistenceRecord["approvalStatus"];
  readonly trustState: NodeIdentityPersistenceRecord["trustState"];
  readonly enrollmentRequestId?: string;
  readonly revocationState?: NodeIdentityPersistenceRecord["revocation"]["state"];
  readonly nodeCapabilities?: ReadonlyArray<typeof NodeRoleCapabilities[keyof typeof NodeRoleCapabilities]>;
}): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId: input.nodeId,
    nodeType: NodeTypes.compute,
    displayName: input.nodeId,
    capabilityProfile: {
      enabledCapabilities: input.nodeCapabilities ?? [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
    },
    approvalStatus: input.approvalStatus,
    trustState: input.trustState,
    deploymentTags: ["cluster:a"],
    revocation: {
      state: input.revocationState ?? NodeRevocationStates.active,
      revokedAt: input.revocationState === NodeRevocationStates.revoked ? "2026-04-05T12:00:00.000Z" : undefined,
    },
    enrolledAt: "2026-04-01T00:00:00.000Z",
    approvedAt: input.approvalStatus === NodeApprovalStatuses.approved ? "2026-04-02T00:00:00.000Z" : undefined,
    revokedAt: input.revocationState === NodeRevocationStates.revoked ? "2026-04-05T12:00:00.000Z" : undefined,
    enrollmentRequestId: input.enrollmentRequestId,
    createdAt: "2026-04-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-02T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createEnrollment(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly status: NodeEnrollmentRequestPersistenceRecord["status"];
  readonly enrollmentCapabilities?: ReadonlyArray<typeof NodeRoleCapabilities[keyof typeof NodeRoleCapabilities]>;
}): NodeEnrollmentRequestPersistenceRecord {
  return Object.freeze({
    requestId: input.requestId,
    nodeId: input.nodeId,
    nodeType: NodeTypes.compute,
    displayName: input.nodeId,
    capabilityProfile: {
      enabledCapabilities: input.enrollmentCapabilities ?? [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
    },
    deploymentTags: ["cluster:a"],
    requestedAt: "2026-04-01T00:00:00.000Z",
    status: input.status,
    reviewedAt: input.status === NodeEnrollmentRequestStatuses.approved ? "2026-04-02T00:00:00.000Z" : undefined,
    reviewedByUserIdentityId: input.status === NodeEnrollmentRequestStatuses.approved ? "user:admin" : undefined,
    createdAt: "2026-04-01T00:00:00.000Z",
    createdBy: "node:bootstrap",
    lastModifiedAt: "2026-04-02T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
