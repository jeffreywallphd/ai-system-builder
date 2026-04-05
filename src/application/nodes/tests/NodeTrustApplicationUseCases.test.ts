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
import { NodeTrustPersistenceQueryPresets } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import {
  NodeTrustAuditEventTypes,
  type NodeTrustAuditEvent,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import type {
  IssueNodeCertificateHookInput,
  NodeTrustCertificateHook,
} from "../ports/NodeTrustCertificatePorts";
import { RegisterNodeEnrollmentRequestUseCase } from "../use-cases/RegisterNodeEnrollmentRequestUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../use-cases/ReviewPendingNodeEnrollmentUseCase";
import { ApproveNodeEnrollmentUseCase } from "../use-cases/ApproveNodeEnrollmentUseCase";
import { RejectNodeEnrollmentUseCase } from "../use-cases/RejectNodeEnrollmentUseCase";
import { RevokeNodeTrustUseCase } from "../use-cases/RevokeNodeTrustUseCase";
import { RecordNodeHeartbeatUseCase } from "../use-cases/RecordNodeHeartbeatUseCase";
import { ListTrustedNodeInventoryUseCase } from "../use-cases/ListTrustedNodeInventoryUseCase";
import { NodeTrustUseCaseErrorCodes } from "../use-cases/NodeTrustUseCaseShared";

class InMemoryNodeTrustRepository
  implements INodeTrustIdentityPersistenceRepository, INodeEnrollmentRequestPersistenceRepository {
  public readonly nodes = new Map<string, NodeIdentityPersistenceRecord>();
  public readonly enrollmentRequests = new Map<string, NodeEnrollmentRequestPersistenceRecord>();
  public readonly enrollmentStatusTransitions: Array<{
    readonly requestId: string;
    readonly toStatus: typeof NodeEnrollmentRequestStatuses[keyof typeof NodeEnrollmentRequestStatuses];
    readonly reviewedAt?: string;
    readonly reviewedByUserIdentityId?: string;
    readonly decisionNote?: string;
  }> = [];

  async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.nodes.get(nodeId);
  }

  async listNodes(query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    return [...this.nodes.values()].filter((node) => {
      if (query.nodeTypes && query.nodeTypes.length > 0 && !query.nodeTypes.includes(node.nodeType)) {
        return false;
      }
      if (query.trustStates && query.trustStates.length > 0 && !query.trustStates.includes(node.trustState)) {
        return false;
      }
      if (query.approvalStatuses && query.approvalStatuses.length > 0 && !query.approvalStatuses.includes(node.approvalStatus)) {
        return false;
      }
      if (query.capabilityAnyOf && query.capabilityAnyOf.length > 0 && !query.capabilityAnyOf.some((capability) => node.capabilityProfile.enabledCapabilities.includes(capability))) {
        return false;
      }
      if (query.deploymentTagAnyOf && query.deploymentTagAnyOf.length > 0 && !query.deploymentTagAnyOf.some((tag) => node.deploymentTags.includes(tag.trim().toLowerCase()))) {
        return false;
      }
      if (query.activeOnly && !NodeTrustPersistenceQueryPresets.activeNodeTrustStates.includes(node.trustState)) {
        return false;
      }
      if (!query.includeRevoked && node.trustState === NodeTrustStates.revoked) {
        return false;
      }
      return true;
    });
  }

  async registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.record.nodeId);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.nodes.set(next.nodeId, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  async updateNodeApproval(
    input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      record: {
        ...existing,
        approvalStatus: input.approvalStatus,
        approvedAt: input.approvedAt,
        trustState: input.trustState ?? existing.trustState,
      },
      mutation: input.mutation,
    });
  }

  async updateNodeCertificateReference(
    input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      record: {
        ...existing,
        certificate: input.certificate,
      },
      mutation: input.mutation,
    });
  }

  async updateNodeCapabilityProfile(
    input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      record: {
        ...existing,
        capabilityProfile: input.capabilityProfile,
      },
      mutation: input.mutation,
    });
  }

  async revokeNode(
    input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      record: {
        ...existing,
        trustState: input.trustState ?? NodeTrustStates.revoked,
        revocation: input.revocation,
        revokedAt: input.revocation.revokedAt,
      },
      mutation: input.mutation,
    });
  }

  async recordNodeLastSeen(
    input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodes.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      record: {
        ...existing,
        lastSeen: input.lastSeen,
      },
      mutation: input.mutation,
    });
  }

  async findEnrollmentRequestById(requestId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    return this.enrollmentRequests.get(requestId);
  }

  async findPendingEnrollmentRequestByNodeId(nodeId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    for (const request of this.enrollmentRequests.values()) {
      if (request.nodeId !== nodeId) {
        continue;
      }
      if (NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses.includes(request.status)) {
        return request;
      }
    }
    return undefined;
  }

  async listEnrollmentRequests(
    query: NodeEnrollmentRequestPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>> {
    return [...this.enrollmentRequests.values()].filter((request) => {
      if (query.nodeId && request.nodeId !== query.nodeId) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(request.status)) {
        return false;
      }
      if (!query.includeTerminal && !NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses.includes(request.status)) {
        return false;
      }
      return true;
    });
  }

  async saveEnrollmentRequest(
    input: SaveNodeEnrollmentRequestPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const existing = this.enrollmentRequests.get(input.record.requestId);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.enrollmentRequests.set(next.requestId, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  async transitionEnrollmentRequestStatus(
    input: TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const existing = this.enrollmentRequests.get(input.requestId);
    if (!existing) {
      throw new Error("Enrollment request not found.");
    }

    this.enrollmentStatusTransitions.push(Object.freeze({
      requestId: input.requestId,
      toStatus: input.toStatus,
      reviewedAt: input.reviewedAt,
      reviewedByUserIdentityId: input.reviewedByUserIdentityId,
      decisionNote: input.decisionNote,
    }));

    return this.saveEnrollmentRequest({
      record: {
        ...existing,
        status: input.toStatus,
        reviewedAt: input.reviewedAt ?? existing.reviewedAt,
        reviewedByUserIdentityId: input.reviewedByUserIdentityId ?? existing.reviewedByUserIdentityId,
        decisionNote: input.decisionNote ?? existing.decisionNote,
      },
      mutation: input.mutation,
    });
  }
}

class RecordingAuditSink implements NodeTrustAuditSink {
  public readonly events: NodeTrustAuditEvent[] = [];

  async recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function createAllowAllAuthorizationHook(): NodeTrustAuthorizationHook {
  return {
    async assertCanRegisterEnrollmentRequest(_input) {},
    async assertCanReviewPendingEnrollment(_input) {},
    async assertCanApproveNode(_input) {},
    async assertCanRejectNode(_input) {},
    async assertCanRevokeNode(_input) {},
    async assertCanRecordHeartbeat(_input) {},
    async assertCanQueryTrustedNodeInventory(_input) {},
  };
}

function createDenyingAuthorizationHook(input: {
  readonly reviewPending?: boolean;
  readonly approve?: boolean;
  readonly reject?: boolean;
}): NodeTrustAuthorizationHook {
  return {
    async assertCanRegisterEnrollmentRequest(_request) {},
    async assertCanReviewPendingEnrollment(_request) {
      if (input.reviewPending) {
        throw new Error("admin role required to review pending enrollments");
      }
    },
    async assertCanApproveNode(_request) {
      if (input.approve) {
        throw new Error("admin role required to approve enrollment requests");
      }
    },
    async assertCanRejectNode(_request) {
      if (input.reject) {
        throw new Error("admin role required to reject enrollment requests");
      }
    },
    async assertCanRevokeNode(_request) {},
    async assertCanRecordHeartbeat(_request) {},
    async assertCanQueryTrustedNodeInventory(_request) {},
  };
}

class StubCertificateHook implements NodeTrustCertificateHook {
  public issuedForNodeIds: string[] = [];

  public revokedCertificateRefs: string[] = [];

  async issueNodeCertificate(input: IssueNodeCertificateHookInput) {
    this.issuedForNodeIds.push(input.nodeId);
    return {
      certificateRef: `cert:${input.nodeId}:v1`,
      certificateAssignedAt: "2026-04-05T18:05:00.000Z",
      certificateAuthorityRef: "ca:loom",
    };
  }

  async revokeNodeCertificate(input: {
    readonly actorUserIdentityId: string;
    readonly nodeId: string;
    readonly certificateRef: string;
    readonly revokedAt: string;
    readonly reason?: string;
  }): Promise<void> {
    this.revokedCertificateRefs.push(input.certificateRef);
  }
}

function createFixedClock(iso: string): { now(): Date } {
  return {
    now: () => new Date(iso),
  };
}

describe("node trust application use-cases", () => {
  it("registers enrollment requests and emits audit events", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    const useCase = new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:00:00.000Z"),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node:compute-1",
      nodeId: "node-compute-1",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
      },
      deploymentTags: ["us-east-1"],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollmentRequest.status).toBe(NodeEnrollmentRequestStatuses.submitted);
    expect(repository.enrollmentRequests.size).toBe(1);
    expect(audit.events[0]?.type).toBe(NodeTrustAuditEventTypes.enrollmentRequested);
  });

  it("reviews pending enrollment queue for administrators", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-1",
        nodeId: "node-compute-1",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-east-1"],
        requestedAt: "2026-04-05T17:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "node-compute-1",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "node-compute-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed",
        context: {
          actorUserIdentityId: "node-compute-1",
        },
      },
    });

    const useCase = new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollments).toHaveLength(1);
    expect(result.value.enrollments[0]?.requestId).toBe("enroll-1");
  });

  it("blocks unauthorized actors from reviewing pending enrollment queue", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-review-denied-1",
        nodeId: "node-review-denied-1",
        nodeType: NodeTypes.compute,
        displayName: "Review Denied Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-east-1"],
        requestedAt: "2026-04-05T17:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "node-review-denied-1",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "node-review-denied-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-review-denied",
        context: {
          actorUserIdentityId: "node-review-denied-1",
        },
      },
    });

    const useCase = new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ reviewPending: true }),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "member-1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.forbidden);
      expect(result.error.message).toContain("admin role required");
    }
  });

  it("approves enrollment requests and provisions node trust with certificate hook", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const certificateHook = new StubCertificateHook();
    const audit = new RecordingAuditSink();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-approve-1",
        nodeId: "node-hybrid-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Hybrid Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution, NodeRoleCapabilities.modelInference],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["hybrid"],
        requestedAt: "2026-04-05T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "node-hybrid-1",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "node-hybrid-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-approve",
        context: {
          actorUserIdentityId: "node-hybrid-1",
        },
      },
    });

    const useCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      certificateHook,
      clock: createFixedClock("2026-04-05T18:05:00.000Z"),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      requestId: "enroll-approve-1",
      decisionNote: "Validated compute profile.",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollmentRequest.status).toBe(NodeEnrollmentRequestStatuses.approved);
    expect(result.value.enrollmentRequest.reviewedByUserIdentityId).toBe("admin-1");
    expect(result.value.enrollmentRequest.reviewedAt).toBe("2026-04-05T18:05:00.000Z");
    expect(result.value.enrollmentRequest.decisionNote).toBe("Validated compute profile.");
    expect(result.value.node.approvalStatus).toBe(NodeApprovalStatuses.approved);
    expect(result.value.node.trustState).toBe(NodeTrustStates.trusted);
    expect(result.value.node.certificate?.certificateRef).toBe("cert:node-hybrid-1:v1");
    expect(certificateHook.issuedForNodeIds).toEqual(["node-hybrid-1"]);
    expect(repository.enrollmentStatusTransitions.map((entry) => entry.toStatus)).toEqual([
      NodeEnrollmentRequestStatuses.underReview,
      NodeEnrollmentRequestStatuses.approved,
    ]);
    const event = audit.events[audit.events.length - 1];
    expect(event?.type).toBe(NodeTrustAuditEventTypes.nodeApproved);
    expect(event?.details?.reviewedByUserIdentityId).toBe("admin-1");
    expect(event?.details?.reviewedAt).toBe("2026-04-05T18:05:00.000Z");
    expect(event?.details?.decisionNote).toBe("Validated compute profile.");
  });

  it("blocks unauthorized actors from approving enrollment requests", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-approve-denied-1",
        nodeId: "node-approve-denied-1",
        nodeType: NodeTypes.compute,
        displayName: "Approve Denied Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-west-2"],
        requestedAt: "2026-04-05T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "node-approve-denied-1",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "node-approve-denied-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-approve-denied",
        context: {
          actorUserIdentityId: "node-approve-denied-1",
        },
      },
    });

    const useCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ approve: true }),
      clock: createFixedClock("2026-04-05T18:05:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "member-1",
      requestId: "enroll-approve-denied-1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.forbidden);
      expect(result.error.message).toContain("admin role required");
    }

    const persistedEnrollment = await repository.findEnrollmentRequestById("enroll-approve-denied-1");
    expect(persistedEnrollment?.status).toBe(NodeEnrollmentRequestStatuses.submitted);
    expect(repository.nodes.size).toBe(0);
  });

  it("rejects enrollment requests and quarantines node records", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-reject-1",
        nodeId: "node-edge-1",
        nodeType: NodeTypes.edge,
        displayName: "Edge Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: false,
        },
        deploymentTags: ["edge"],
        requestedAt: "2026-04-05T18:10:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:10:00.000Z",
        createdBy: "node-edge-1",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "node-edge-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-reject",
        context: {
          actorUserIdentityId: "node-edge-1",
        },
      },
    });

    const useCase = new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:15:00.000Z"),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      requestId: "enroll-reject-1",
      decisionNote: "Node inventory exceeded for region.",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollmentRequest.status).toBe(NodeEnrollmentRequestStatuses.rejected);
    expect(result.value.enrollmentRequest.reviewedByUserIdentityId).toBe("admin-1");
    expect(result.value.enrollmentRequest.reviewedAt).toBe("2026-04-05T18:15:00.000Z");
    expect(result.value.enrollmentRequest.decisionNote).toBe("Node inventory exceeded for region.");
    expect(result.value.node?.approvalStatus).toBe(NodeApprovalStatuses.rejected);
    expect(result.value.node?.trustState).toBe(NodeTrustStates.quarantined);
    expect(repository.enrollmentStatusTransitions.map((entry) => entry.toStatus)).toEqual([
      NodeEnrollmentRequestStatuses.underReview,
      NodeEnrollmentRequestStatuses.rejected,
    ]);
    const event = audit.events[audit.events.length - 1];
    expect(event?.type).toBe(NodeTrustAuditEventTypes.nodeRejected);
    expect(event?.details?.reviewedByUserIdentityId).toBe("admin-1");
    expect(event?.details?.reviewedAt).toBe("2026-04-05T18:15:00.000Z");
    expect(event?.details?.decisionNote).toBe("Node inventory exceeded for region.");
  });

  it("blocks unauthorized actors from rejecting enrollment requests", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-reject-denied-1",
        nodeId: "node-reject-denied-1",
        nodeType: NodeTypes.edge,
        displayName: "Reject Denied Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: false,
        },
        deploymentTags: ["edge"],
        requestedAt: "2026-04-05T18:10:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:10:00.000Z",
        createdBy: "node-reject-denied-1",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "node-reject-denied-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-reject-denied",
        context: {
          actorUserIdentityId: "node-reject-denied-1",
        },
      },
    });

    const useCase = new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ reject: true }),
      clock: createFixedClock("2026-04-05T18:15:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "member-1",
      requestId: "enroll-reject-denied-1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.forbidden);
      expect(result.error.message).toContain("admin role required");
    }

    const persistedEnrollment = await repository.findEnrollmentRequestById("enroll-reject-denied-1");
    expect(persistedEnrollment?.status).toBe(NodeEnrollmentRequestStatuses.submitted);
    expect(repository.nodes.size).toBe(0);
  });

  it("revokes trusted nodes and invokes certificate revocation hook", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const certificateHook = new StubCertificateHook();
    await repository.registerNode({
      record: {
        nodeId: "node-compute-9",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 9",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-compute-9:v1",
        },
        deploymentTags: ["us-west-2"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:20:00.000Z",
        approvedAt: "2026-04-05T18:20:30.000Z",
        createdAt: "2026-04-05T18:20:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:20:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-node",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new RevokeNodeTrustUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      certificateHook,
      clock: createFixedClock("2026-04-05T18:25:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-compute-9",
      reason: NodeRevocationReasons.policyViolation,
      note: "Heartbeat outlier detected.",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.trustState).toBe(NodeTrustStates.revoked);
    expect(result.value.node.revocation.state).toBe(NodeRevocationStates.revoked);
    expect(certificateHook.revokedCertificateRefs).toEqual(["cert:node-compute-9:v1"]);
  });

  it("records heartbeat for active nodes and rejects revoked-node heartbeat updates", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-compute-heartbeat",
        nodeType: NodeTypes.compute,
        displayName: "Compute Heartbeat",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-compute-heartbeat:v1",
        },
        deploymentTags: ["us-east-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:30:00.000Z",
        approvedAt: "2026-04-05T18:30:30.000Z",
        createdAt: "2026-04-05T18:30:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:30:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-heartbeat-node",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const heartbeatUseCase = new RecordNodeHeartbeatUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:31:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const heartbeat = await heartbeatUseCase.execute({
      actorUserIdentityId: "system-heartbeat",
      nodeId: "node-compute-heartbeat",
      heartbeatStatus: NodeHeartbeatStatuses.online,
      observedBy: "heartbeat-monitor",
    });

    expect(heartbeat.ok).toBeTrue();
    if (heartbeat.ok) {
      expect(heartbeat.value.node.lastSeen?.heartbeatStatus).toBe(NodeHeartbeatStatuses.online);
    }

    await repository.revokeNode({
      nodeId: "node-compute-heartbeat",
      trustState: NodeTrustStates.revoked,
      revocation: {
        state: NodeRevocationStates.revoked,
        reason: NodeRevocationReasons.operatorAction,
        revokedAt: "2026-04-05T18:32:00.000Z",
        revokedByUserIdentityId: "admin-1",
      },
      mutation: {
        operationKey: "seed-revoked",
        context: {
          actorUserIdentityId: "admin-1",
        },
      },
    });

    const revokedHeartbeat = await heartbeatUseCase.execute({
      actorUserIdentityId: "system-heartbeat",
      nodeId: "node-compute-heartbeat",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });

    expect(revokedHeartbeat.ok).toBeFalse();
    if (!revokedHeartbeat.ok) {
      expect(revokedHeartbeat.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidRequest);
    }
  });

  it("lists trusted node inventory with capability filters", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    await repository.registerNode({
      record: {
        nodeId: "trusted-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:trusted-1",
        },
        deploymentTags: ["us-east-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:40:00.000Z",
        approvedAt: "2026-04-05T18:40:30.000Z",
        createdAt: "2026-04-05T18:40:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:40:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-trusted",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    await repository.registerNode({
      record: {
        nodeId: "quarantined-1",
        nodeType: NodeTypes.compute,
        displayName: "Quarantined 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.workflowExecution],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.quarantined,
        deploymentTags: ["us-east-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:40:00.000Z",
        createdAt: "2026-04-05T18:40:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:40:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-quarantined",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new ListTrustedNodeInventoryUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      capabilityAnyOf: [NodeRoleCapabilities.workflowExecution],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.nodes).toHaveLength(1);
    expect(result.value.nodes[0]?.nodeId).toBe("trusted-1");
    expect(audit.events[audit.events.length - 1]?.type).toBe(NodeTrustAuditEventTypes.trustedInventoryQueried);
  });
});
