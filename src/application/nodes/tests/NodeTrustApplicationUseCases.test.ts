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
} from "@domain/nodes/NodeTrustDomain";
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
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import { NodeTrustPersistenceQueryPresets } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
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
import type { IPlatformTransactionManager } from "../../common/ports/PlatformTransactionPorts";
import { RegisterNodeEnrollmentRequestUseCase } from "../use-cases/RegisterNodeEnrollmentRequestUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../use-cases/ReviewPendingNodeEnrollmentUseCase";
import { GetNodeEnrollmentDetailUseCase } from "../use-cases/GetNodeEnrollmentDetailUseCase";
import { ApproveNodeEnrollmentUseCase } from "../use-cases/ApproveNodeEnrollmentUseCase";
import { ActivateApprovedNodeUseCase } from "../use-cases/ActivateApprovedNodeUseCase";
import { RejectNodeEnrollmentUseCase } from "../use-cases/RejectNodeEnrollmentUseCase";
import { RevokeNodeTrustUseCase } from "../use-cases/RevokeNodeTrustUseCase";
import { RecordNodeHeartbeatUseCase } from "../use-cases/RecordNodeHeartbeatUseCase";
import { RecordNodeOperationalUpdateUseCase } from "../use-cases/RecordNodeOperationalUpdateUseCase";
import { ListTrustedNodeInventoryUseCase } from "../use-cases/ListTrustedNodeInventoryUseCase";
import { GetNodeInventoryDetailUseCase } from "../use-cases/GetNodeInventoryDetailUseCase";
import { ListNodeInventoryUseCase } from "../use-cases/ListNodeInventoryUseCase";
import { NodeTrustUseCaseErrorCodes } from "../use-cases/NodeTrustUseCaseShared";

class InMemoryNodeTrustRepository
  implements INodeTrustIdentityPersistenceRepository, INodeEnrollmentRequestPersistenceRepository, IPlatformTransactionManager {
  public readonly nodes = new Map<string, NodeIdentityPersistenceRecord>();
  public readonly enrollmentRequests = new Map<string, NodeEnrollmentRequestPersistenceRecord>();
  public readonly enrollmentStatusTransitions: Array<{
    readonly requestId: string;
    readonly toStatus: typeof NodeEnrollmentRequestStatuses[keyof typeof NodeEnrollmentRequestStatuses];
    readonly reviewedAt?: string;
    readonly reviewedByUserIdentityId?: string;
    readonly decisionNote?: string;
  }> = [];
  public transactionCallCount = 0;

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

  async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    this.transactionCallCount += 1;
    const snapshot = Object.freeze({
      nodes: new Map(this.nodes),
      enrollmentRequests: new Map(this.enrollmentRequests),
      enrollmentStatusTransitions: [...this.enrollmentStatusTransitions],
    });
    try {
      return await operation();
    } catch (error) {
      this.nodes.clear();
      this.enrollmentRequests.clear();
      this.enrollmentStatusTransitions.length = 0;
      for (const [key, value] of snapshot.nodes.entries()) {
        this.nodes.set(key, value);
      }
      for (const [key, value] of snapshot.enrollmentRequests.entries()) {
        this.enrollmentRequests.set(key, value);
      }
      this.enrollmentStatusTransitions.push(...snapshot.enrollmentStatusTransitions);
      throw error;
    }
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
    async assertCanActivateNode(_input) {},
    async assertCanQueryTrustedNodeInventory(_input) {},
  };
}

function createDenyingAuthorizationHook(input: {
  readonly reviewPending?: boolean;
  readonly approve?: boolean;
  readonly activate?: boolean;
  readonly reject?: boolean;
  readonly revoke?: boolean;
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
    async assertCanRevokeNode(_request) {
      if (input.revoke) {
        throw new Error("admin role required to revoke trusted nodes");
      }
    },
    async assertCanRecordHeartbeat(_request) {},
    async assertCanActivateNode(_request) {
      if (input.activate) {
        throw new Error("admin role required to activate approved nodes");
      }
    },
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
        enabledCapabilities: [NodeRoleCapabilities.executor],
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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

  it("returns enrollment detail records for authorized administrators", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-detail-1",
        nodeId: "node-detail-1",
        nodeType: NodeTypes.compute,
        displayName: "Detail Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-east-1"],
        requestedAt: "2026-04-05T17:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "node-detail-1",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "node-detail-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-detail",
        context: {
          actorUserIdentityId: "node-detail-1",
        },
      },
    });

    const useCase = new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      requestId: "enroll-detail-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollmentRequest.requestId).toBe("enroll-detail-1");
    expect(result.value.enrollmentRequest.nodeId).toBe("node-detail-1");
  });

  it("blocks unauthorized actors from reading enrollment detail records", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-detail-denied-1",
        nodeId: "node-detail-denied-1",
        nodeType: NodeTypes.compute,
        displayName: "Detail Denied Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["us-east-1"],
        requestedAt: "2026-04-05T17:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T17:00:00.000Z",
        createdBy: "node-detail-denied-1",
        lastModifiedAt: "2026-04-05T17:00:00.000Z",
        lastModifiedBy: "node-detail-denied-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-detail-denied",
        context: {
          actorUserIdentityId: "node-detail-denied-1",
        },
      },
    });

    const useCase = new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ reviewPending: true }),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "member-1",
      requestId: "enroll-detail-denied-1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.forbidden);
      expect(result.error.message).toContain("admin role required");
    }
  });

  it("approves enrollment requests and stages node activation prerequisites with certificate hook", async () => {
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
          enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.api],
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
    expect(result.value.node.trustState).toBe(NodeTrustStates.pendingApproval);
    expect(result.value.node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
    ]);
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

  it("routes node approval persistence through the configured transaction manager", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-approve-transaction-1",
        nodeId: "node-approve-transaction-1",
        nodeType: NodeTypes.compute,
        displayName: "Approve Transaction Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["transaction"],
        requestedAt: "2026-04-05T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "node-approve-transaction-1",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "node-approve-transaction-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-approve-transaction-1",
        context: {
          actorUserIdentityId: "node-approve-transaction-1",
        },
      },
    });
    const useCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      transactionManager: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:06:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-transaction-1",
      requestId: "enroll-approve-transaction-1",
    });

    expect(result.ok).toBeTrue();
    expect(repository.transactionCallCount).toBe(1);
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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

  it("rejects enrollment registration when capability profile declaration is incomplete", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const useCase = new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:00:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node:hybrid-invalid-capability",
      nodeId: "node-hybrid-invalid-capability",
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Invalid Capability Node",
      capabilityProfile: {
        enabledCapabilities: [
          NodeRoleCapabilities.scheduler,
          NodeRoleCapabilities.executor,
        ],
        supportsRemoteScheduling: true,
      },
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidRequest);
      expect(result.error.message).toContain("must also include 'api'");
    }
  });

  it("updates existing node capability profile from approved enrollment metadata", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-existing-capability-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Existing Capability Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        deploymentTags: ["hybrid"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-existing-capability-node",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-existing-capability-1",
        nodeId: "node-existing-capability-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Existing Capability Node",
        capabilityProfile: {
          enabledCapabilities: [
            NodeRoleCapabilities.api,
            NodeRoleCapabilities.executor,
            NodeRoleCapabilities.previewWorker,
          ],
          supportsRemoteScheduling: true,
          maxConcurrentWorkloads: 3,
        },
        deploymentTags: ["hybrid"],
        requestedAt: "2026-04-05T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "node-existing-capability-1",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "node-existing-capability-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-existing-capability-enrollment",
        context: {
          actorUserIdentityId: "node-existing-capability-1",
        },
      },
    });

    const useCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:05:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      requestId: "enroll-existing-capability-1",
      certificateRef: "cert:node-existing-capability-1:v1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
      NodeRoleCapabilities.previewWorker,
    ]);
    expect(result.value.node.capabilityProfile.maxConcurrentWorkloads).toBe(3);
  });

  it("transitions approved nodes to trusted state through explicit activation lifecycle", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const certificateHook = new StubCertificateHook();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-activate-lifecycle-1",
        nodeId: "node-activate-lifecycle-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Activation Lifecycle Node 1",
        capabilityProfile: {
          enabledCapabilities: [
            NodeRoleCapabilities.executor,
            NodeRoleCapabilities.api,
          ],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["hybrid"],
        requestedAt: "2026-04-05T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "node-activate-lifecycle-1",
        lastModifiedAt: "2026-04-05T18:00:00.000Z",
        lastModifiedBy: "node-activate-lifecycle-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-activate-lifecycle-1",
        context: {
          actorUserIdentityId: "node-activate-lifecycle-1",
        },
      },
    });

    const approveUseCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      certificateHook,
      clock: createFixedClock("2026-04-05T18:05:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const approval = await approveUseCase.execute({
      actorUserIdentityId: "admin-1",
      requestId: "enroll-activate-lifecycle-1",
    });

    expect(approval.ok).toBeTrue();
    if (!approval.ok) {
      return;
    }
    expect(approval.value.node.approvalStatus).toBe(NodeApprovalStatuses.approved);
    expect(approval.value.node.trustState).toBe(NodeTrustStates.pendingApproval);
    expect(approval.value.node.certificate?.certificateRef).toBe("cert:node-activate-lifecycle-1:v1");

    const activateUseCase = new ActivateApprovedNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:06:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const activation = await activateUseCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activate-lifecycle-1",
    });

    expect(activation.ok).toBeTrue();
    if (!activation.ok) {
      return;
    }
    expect(activation.value.node.trustState).toBe(NodeTrustStates.trusted);
    expect(activation.value.node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
    ]);
  });

  it("activates approved nodes into trusted state while preserving capabilities and trust metadata", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    await repository.registerNode({
      record: {
        nodeId: "node-activate-1",
        nodeType: NodeTypes.compute,
        displayName: "Activation Node 1",
        capabilityProfile: {
          enabledCapabilities: [
            NodeRoleCapabilities.api,
            NodeRoleCapabilities.executor,
            NodeRoleCapabilities.scheduler,
          ],
          supportsRemoteScheduling: true,
          maxConcurrentWorkloads: 4,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.pendingApproval,
        certificate: {
          certificateRef: "cert:node-activate-1:v1",
          certificateAssignedAt: "2026-04-05T18:10:00.000Z",
          certificateAuthorityRef: "ca:loom",
        },
        deploymentTags: ["region-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:05:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:05:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-activate-node-1",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new ActivateApprovedNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:20:00.000Z"),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activate-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.approvalStatus).toBe(NodeApprovalStatuses.approved);
    expect(result.value.node.trustState).toBe(NodeTrustStates.trusted);
    expect(result.value.node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
      NodeRoleCapabilities.scheduler,
    ]);
    expect(result.value.node.certificate?.certificateRef).toBe("cert:node-activate-1:v1");
    expect(result.value.mutation.changed).toBeTrue();
    expect(audit.events[audit.events.length - 1]?.type).toBe(NodeTrustAuditEventTypes.nodeActivated);
  });

  it("keeps approved-node activation idempotent for repeated activation attempts", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-activate-2",
        nodeType: NodeTypes.compute,
        displayName: "Activation Node 2",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.pendingApproval,
        certificate: {
          certificateRef: "cert:node-activate-2:v1",
        },
        deploymentTags: ["region-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        approvedAt: "2026-04-05T18:05:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:05:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-activate-node-2",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new ActivateApprovedNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:20:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const first = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activate-2",
    });
    expect(first.ok).toBeTrue();
    if (!first.ok) {
      return;
    }

    const second = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activate-2",
    });

    expect(second.ok).toBeTrue();
    if (!second.ok) {
      return;
    }

    expect(second.value.node.trustState).toBe(NodeTrustStates.trusted);
    expect(second.value.node.certificate?.certificateRef).toBe("cert:node-activate-2:v1");
    expect(second.value.mutation.changed).toBeFalse();
  });

  it("rejects activation attempts for unapproved nodes", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-activate-unapproved",
        nodeType: NodeTypes.compute,
        displayName: "Activation Node Unapproved",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        certificate: {
          certificateRef: "cert:node-activate-unapproved:v1",
        },
        deploymentTags: ["region-1"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "system",
        lastModifiedAt: "2026-04-05T18:05:00.000Z",
        lastModifiedBy: "system",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-activate-node-unapproved",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new ActivateApprovedNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activate-unapproved",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(result.error.message).toContain("cannot be activated before approval");
    }
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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

  it("routes node rejection persistence through the configured transaction manager", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-reject-transaction-1",
        nodeId: "node-reject-transaction-1",
        nodeType: NodeTypes.edge,
        displayName: "Reject Transaction Node 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: false,
        },
        deploymentTags: ["transaction"],
        requestedAt: "2026-04-05T18:10:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:10:00.000Z",
        createdBy: "node-reject-transaction-1",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "node-reject-transaction-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-reject-transaction-1",
        context: {
          actorUserIdentityId: "node-reject-transaction-1",
        },
      },
    });
    const useCase = new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      transactionManager: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:16:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-transaction-1",
      requestId: "enroll-reject-transaction-1",
    });

    expect(result.ok).toBeTrue();
    expect(repository.transactionCallCount).toBe(1);
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
    expect(result.value.node.revocation.reason).toBe(NodeRevocationReasons.policyViolation);
    expect(result.value.node.revocation.revokedByUserIdentityId).toBe("admin-1");
    expect(result.value.node.revocation.note).toBe("Heartbeat outlier detected.");
    expect(certificateHook.revokedCertificateRefs).toEqual(["cert:node-compute-9:v1"]);
  });

  it("blocks unauthorized actors from revoking trusted nodes", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-revoke-denied-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoke Denied Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-revoke-denied-1:v1",
        },
        deploymentTags: ["us-east-2"],
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
        operationKey: "seed-node-revoke-denied-1",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new RevokeNodeTrustUseCase({
      nodeRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ revoke: true }),
      clock: createFixedClock("2026-04-05T18:25:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "member-1",
      nodeId: "node-revoke-denied-1",
      reason: NodeRevocationReasons.operatorAction,
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.forbidden);
      expect(result.error.message).toContain("admin role required");
    }

    const persisted = await repository.findNodeById("node-revoke-denied-1");
    expect(persisted?.trustState).toBe(NodeTrustStates.trusted);
    expect(persisted?.revocation.state).toBe(NodeRevocationStates.active);
  });

  it("treats repeated revocation requests as safe no-op while preserving revocation metadata", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const certificateHook = new StubCertificateHook();
    const audit = new RecordingAuditSink();
    await repository.registerNode({
      record: {
        nodeId: "node-revoke-idempotent-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoke Idempotent Node",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-revoke-idempotent-1:v1",
        },
        deploymentTags: ["us-west-1"],
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
        operationKey: "seed-node-revoke-idempotent-1",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const firstUseCase = new RevokeNodeTrustUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      certificateHook,
      clock: createFixedClock("2026-04-05T18:25:00.000Z"),
      auditSink: audit,
    });

    const first = await firstUseCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-revoke-idempotent-1",
      reason: NodeRevocationReasons.policyViolation,
      note: "Initial revocation",
    });
    expect(first.ok).toBeTrue();
    if (!first.ok) {
      return;
    }
    expect(first.value.mutation.changed).toBeTrue();

    const secondUseCase = new RevokeNodeTrustUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      certificateHook,
      clock: createFixedClock("2026-04-05T18:30:00.000Z"),
      auditSink: audit,
    });

    const second = await secondUseCase.execute({
      actorUserIdentityId: "admin-2",
      nodeId: "node-revoke-idempotent-1",
    });
    expect(second.ok).toBeTrue();
    if (!second.ok) {
      return;
    }

    expect(second.value.node.trustState).toBe(NodeTrustStates.revoked);
    expect(second.value.node.revocation.reason).toBe(NodeRevocationReasons.policyViolation);
    expect(second.value.node.revocation.revokedByUserIdentityId).toBe("admin-1");
    expect(second.value.node.revocation.note).toBe("Initial revocation");
    expect(second.value.mutation.changed).toBeFalse();
    expect(certificateHook.revokedCertificateRefs).toEqual(["cert:node-revoke-idempotent-1:v1"]);
    expect(audit.events.filter((event) => event.type === NodeTrustAuditEventTypes.nodeRevoked)).toHaveLength(2);
  });

  it("records heartbeat for active nodes and rejects revoked-node heartbeat updates", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    await repository.registerNode({
      record: {
        nodeId: "node-compute-heartbeat",
        nodeType: NodeTypes.compute,
        displayName: "Compute Heartbeat",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
      auditSink: audit,
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
      expect(revokedHeartbeat.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
    }

    expect(audit.events.some((event) => event.type === NodeTrustAuditEventTypes.heartbeatRecorded)).toBeTrue();
    expect(audit.events.some((event) => event.type === NodeTrustAuditEventTypes.heartbeatRejected)).toBeTrue();
  });

  it("records secure operational updates and synchronizes capability/deployment metadata", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    await repository.registerNode({
      record: {
        nodeId: "node-operational-sync-1",
        nodeType: NodeTypes.compute,
        displayName: "Operational Sync 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-operational-sync-1:v1",
        },
        deploymentTags: ["edge-east"],
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
        operationKey: "seed-operational-sync-1",
        context: {
          actorUserIdentityId: "system",
        },
      },
    });

    const useCase = new RecordNodeOperationalUpdateUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:31:00.000Z"),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node-operational-sync-1",
      nodeId: "node-operational-sync-1",
      heartbeatStatus: NodeHeartbeatStatuses.degraded,
      seenAt: "2026-04-05T18:31:30.000Z",
      observedBy: "node-agent-v2",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.api, NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["EDGE-WEST", "scheduler"],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.lastSeen?.heartbeatStatus).toBe(NodeHeartbeatStatuses.degraded);
    expect(result.value.node.lastSeen?.lastSeenAt).toBe("2026-04-05T18:31:30.000Z");
    expect(result.value.node.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.api,
      NodeRoleCapabilities.executor,
    ]);
    expect(result.value.node.deploymentTags).toEqual(["edge-west", "scheduler"]);
    expect(result.value.update.capabilityProfileSynchronized).toBeTrue();
    expect(result.value.update.deploymentTagsSynchronized).toBeTrue();
    expect(audit.events.some((event) => event.type === NodeTrustAuditEventTypes.heartbeatRecorded)).toBeTrue();
    const transitionEvent = audit.events.find((event) => event.type === NodeTrustAuditEventTypes.availabilityTransitioned);
    expect(transitionEvent).toBeDefined();
    expect((transitionEvent?.details as { previousHeartbeatStatus?: string } | undefined)?.previousHeartbeatStatus).toBe("online");
    expect((transitionEvent?.details as { heartbeatStatus?: string } | undefined)?.heartbeatStatus).toBe("degraded");
  });

  it("enforces node-authenticated trust gates for approved, pending, rejected, unknown, and revoked states", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();
    const heartbeatUseCase = new RecordNodeHeartbeatUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:40:00.000Z"),
      auditSink: audit,
    });

    await repository.registerNode({
      record: {
        nodeId: "node-heartbeat-approved-1",
        nodeType: NodeTypes.compute,
        displayName: "Heartbeat Approved",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:heartbeat-approved-1:v1",
        },
        deploymentTags: ["heartbeat"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:30:00.000Z",
        approvedAt: "2026-04-05T18:31:00.000Z",
        createdAt: "2026-04-05T18:30:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:31:00.000Z",
        lastModifiedBy: "seed",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-heartbeat-approved-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });
    await repository.registerNode({
      record: {
        nodeId: "node-heartbeat-pending-1",
        nodeType: NodeTypes.compute,
        displayName: "Heartbeat Pending",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.pending,
        trustState: NodeTrustStates.pendingApproval,
        deploymentTags: ["heartbeat"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:30:00.000Z",
        createdAt: "2026-04-05T18:30:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:30:00.000Z",
        lastModifiedBy: "seed",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-heartbeat-pending-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });
    await repository.registerNode({
      record: {
        nodeId: "node-heartbeat-rejected-1",
        nodeType: NodeTypes.compute,
        displayName: "Heartbeat Rejected",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.quarantined,
        deploymentTags: ["heartbeat"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:30:00.000Z",
        createdAt: "2026-04-05T18:30:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:30:00.000Z",
        lastModifiedBy: "seed",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-heartbeat-rejected-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });
    await repository.registerNode({
      record: {
        nodeId: "node-heartbeat-revoked-1",
        nodeType: NodeTypes.compute,
        displayName: "Heartbeat Revoked",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.revoked,
        deploymentTags: ["heartbeat"],
        revocation: {
          state: NodeRevocationStates.revoked,
          reason: NodeRevocationReasons.operatorAction,
          revokedAt: "2026-04-05T18:35:00.000Z",
          revokedByUserIdentityId: "admin-1",
        },
        enrolledAt: "2026-04-05T18:30:00.000Z",
        revokedAt: "2026-04-05T18:35:00.000Z",
        createdAt: "2026-04-05T18:30:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:35:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-heartbeat-revoked-1",
        context: {
          actorUserIdentityId: "admin-1",
        },
      },
    });

    const approved = await heartbeatUseCase.execute({
      actorUserIdentityId: "node-heartbeat-approved-1",
      nodeId: "node-heartbeat-approved-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(approved.ok).toBeTrue();

    const unknown = await heartbeatUseCase.execute({
      actorUserIdentityId: "node-heartbeat-unknown-1",
      nodeId: "node-heartbeat-unknown-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(unknown.ok).toBeFalse();
    if (!unknown.ok) {
      expect(unknown.error.code).toBe(NodeTrustUseCaseErrorCodes.notFound);
    }

    const pending = await heartbeatUseCase.execute({
      actorUserIdentityId: "node-heartbeat-pending-1",
      nodeId: "node-heartbeat-pending-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(pending.ok).toBeFalse();
    if (!pending.ok) {
      expect(pending.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(pending.error.message).toContain("pending approval");
    }

    const rejected = await heartbeatUseCase.execute({
      actorUserIdentityId: "node-heartbeat-rejected-1",
      nodeId: "node-heartbeat-rejected-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(rejected.ok).toBeFalse();
    if (!rejected.ok) {
      expect(rejected.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(rejected.error.message).toContain("rejected");
    }

    const revoked = await heartbeatUseCase.execute({
      actorUserIdentityId: "node-heartbeat-revoked-1",
      nodeId: "node-heartbeat-revoked-1",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    });
    expect(revoked.ok).toBeFalse();
    if (!revoked.ok) {
      expect(revoked.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(revoked.error.message).toContain("revoked");
    }

    expect(audit.events.filter((event) => event.type === NodeTrustAuditEventTypes.heartbeatRecorded)).toHaveLength(1);
    expect(audit.events.filter((event) => event.type === NodeTrustAuditEventTypes.heartbeatRejected)).toHaveLength(4);
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
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
      capabilityAnyOf: [NodeRoleCapabilities.executor],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.nodes).toHaveLength(1);
    expect(result.value.nodes[0]?.nodeId).toBe("trusted-1");
    expect(audit.events[audit.events.length - 1]?.type).toBe(NodeTrustAuditEventTypes.trustedInventoryQueried);
  });

  it("lists admin inventory across pending and offline operational states", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const audit = new RecordingAuditSink();

    await repository.saveEnrollmentRequest({
      record: {
        requestId: "pending-inventory-1",
        nodeId: "node:pending:inventory-1",
        nodeType: NodeTypes.hybrid,
        displayName: "Pending Inventory 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["inventory"],
        requestedAt: "2026-04-05T18:45:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:45:00.000Z",
        createdBy: "node:pending:inventory-1",
        lastModifiedAt: "2026-04-05T18:45:00.000Z",
        lastModifiedBy: "node:pending:inventory-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-pending-inventory-1",
        context: {
          actorUserIdentityId: "node:pending:inventory-1",
        },
      },
    });

    await repository.registerNode({
      record: {
        nodeId: "node:trusted:offline-1",
        nodeType: NodeTypes.compute,
        displayName: "Trusted Offline 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:trusted:offline-1:v1",
        },
        deploymentTags: ["inventory"],
        lastSeen: {
          lastSeenAt: "2026-04-05T18:46:00.000Z",
          heartbeatStatus: NodeHeartbeatStatuses.offline,
        },
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T18:40:00.000Z",
        approvedAt: "2026-04-05T18:41:00.000Z",
        createdAt: "2026-04-05T18:40:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:46:00.000Z",
        lastModifiedBy: "seed",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-trusted-offline-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const useCase = new ListNodeInventoryUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      auditSink: audit,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      deploymentTagAnyOf: ["inventory"],
      operationalStates: ["pending", "offline"],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.nodes).toHaveLength(2);
    expect(result.value.nodes.some((node) => node.nodeId === "node:pending:inventory-1")).toBeTrue();
    expect(result.value.nodes.some((node) => node.nodeId === "node:trusted:offline-1")).toBeTrue();
    expect(audit.events[audit.events.length - 1]?.type).toBe(NodeTrustAuditEventTypes.inventoryQueried);
  });

  it("returns inventory detail for pending-only nodes", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "pending-detail-1",
        nodeId: "node:pending:detail-1",
        nodeType: NodeTypes.compute,
        displayName: "Pending Detail 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["inventory"],
        requestedAt: "2026-04-05T18:55:00.000Z",
        status: NodeEnrollmentRequestStatuses.underReview,
        createdAt: "2026-04-05T18:55:00.000Z",
        createdBy: "node:pending:detail-1",
        lastModifiedAt: "2026-04-05T18:55:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-pending-detail-1",
        context: {
          actorUserIdentityId: "node:pending:detail-1",
        },
      },
    });

    const useCase = new GetNodeInventoryDetailUseCase({
      nodeRepository: repository,
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node:pending:detail-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.operationalState).toBe("pending");
    expect(result.value.node.pendingEnrollment?.requestId).toBe("pending-detail-1");
    expect(result.value.node.presenceState).toBe("unknown");
  });

  it("expires stale pending enrollment requests and allows re-enrollment retries", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-stale-1",
        nodeId: "node-stale-retry-1",
        nodeType: NodeTypes.compute,
        displayName: "Stale Retry 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["stale"],
        requestedAt: "2026-04-01T18:00:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-01T18:00:00.000Z",
        createdBy: "node-stale-retry-1",
        lastModifiedAt: "2026-04-01T18:00:00.000Z",
        lastModifiedBy: "node-stale-retry-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-stale-enrollment-1",
        context: {
          actorUserIdentityId: "node-stale-retry-1",
        },
      },
    });

    const useCase = new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:00:00.000Z"),
      pendingEnrollmentStaleAfterMs: 1000 * 60 * 60 * 24,
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node-stale-retry-1",
      nodeId: "node-stale-retry-1",
      nodeType: NodeTypes.compute,
      displayName: "Stale Retry 1 New Request",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
      deploymentTags: ["stale"],
      requestId: "enroll-stale-2",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    const stale = await repository.findEnrollmentRequestById("enroll-stale-1");
    expect(stale?.status).toBe(NodeEnrollmentRequestStatuses.expired);
    expect(result.value.enrollmentRequest.requestId).toBe("enroll-stale-2");
  });

  it("rejects enrollment registrations that reuse an existing request id", async () => {
    const repository = new InMemoryNodeTrustRepository();
    const useCase = new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:10:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const first = await useCase.execute({
      actorUserIdentityId: "node-dup-request-1",
      nodeId: "node-dup-request-1",
      nodeType: NodeTypes.compute,
      displayName: "Duplicate Request Id Node 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
      requestId: "enroll-request-duplicate-1",
    });
    expect(first.ok).toBeTrue();

    const duplicate = await useCase.execute({
      actorUserIdentityId: "node-dup-request-2",
      nodeId: "node-dup-request-2",
      nodeType: NodeTypes.hybrid,
      displayName: "Duplicate Request Id Node 2",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
      requestId: "enroll-request-duplicate-1",
    });

    expect(duplicate.ok).toBeFalse();
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(NodeTrustUseCaseErrorCodes.conflict);
      expect(duplicate.error.message).toContain("already exists");
    }
  });

  it("blocks enrollment approval when the target node is already revoked", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-revoked-approve-1",
        nodeId: "node-revoked-approve-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked Approval Guard 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["revoked"],
        requestedAt: "2026-04-05T18:11:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:11:00.000Z",
        createdBy: "node-revoked-approve-1",
        lastModifiedAt: "2026-04-05T18:11:00.000Z",
        lastModifiedBy: "node-revoked-approve-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-enroll-revoked-approve-1",
        context: {
          actorUserIdentityId: "node-revoked-approve-1",
        },
      },
    });
    await repository.registerNode({
      record: {
        nodeId: "node-revoked-approve-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked Approval Guard 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.revoked,
        deploymentTags: ["revoked"],
        revocation: {
          state: NodeRevocationStates.revoked,
          reason: NodeRevocationReasons.operatorAction,
          revokedAt: "2026-04-05T18:10:00.000Z",
          revokedByUserIdentityId: "admin-1",
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        revokedAt: "2026-04-05T18:10:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-node-revoked-approve-1",
        context: {
          actorUserIdentityId: "admin-1",
        },
      },
    });

    const useCase = new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:12:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-2",
      requestId: "enroll-revoked-approve-1",
      certificateRef: "cert:revoked-approve-1:v1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(result.error.message).toContain("revoked");
    }
  });

  it("keeps revoked node trust state immutable when rejecting a stale enrollment", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.saveEnrollmentRequest({
      record: {
        requestId: "enroll-revoked-reject-1",
        nodeId: "node-revoked-reject-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked Reject Guard 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        deploymentTags: ["revoked"],
        requestedAt: "2026-04-05T18:13:00.000Z",
        status: NodeEnrollmentRequestStatuses.submitted,
        createdAt: "2026-04-05T18:13:00.000Z",
        createdBy: "node-revoked-reject-1",
        lastModifiedAt: "2026-04-05T18:13:00.000Z",
        lastModifiedBy: "node-revoked-reject-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-enroll-revoked-reject-1",
        context: {
          actorUserIdentityId: "node-revoked-reject-1",
        },
      },
    });
    await repository.registerNode({
      record: {
        nodeId: "node-revoked-reject-1",
        nodeType: NodeTypes.compute,
        displayName: "Revoked Reject Guard 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.revoked,
        deploymentTags: ["revoked"],
        revocation: {
          state: NodeRevocationStates.revoked,
          reason: NodeRevocationReasons.operatorAction,
          revokedAt: "2026-04-05T18:10:00.000Z",
          revokedByUserIdentityId: "admin-1",
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        revokedAt: "2026-04-05T18:10:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "admin-1",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-node-revoked-reject-1",
        context: {
          actorUserIdentityId: "admin-1",
        },
      },
    });

    const useCase = new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: repository,
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:14:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-2",
      requestId: "enroll-revoked-reject-1",
      decisionNote: "Rejecting stale submission for revoked node.",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.enrollmentRequest.status).toBe(NodeEnrollmentRequestStatuses.rejected);
    expect(result.value.node?.trustState).toBe(NodeTrustStates.revoked);
    expect(result.value.nodeMutation?.changed).toBeFalse();
  });

  it("rejects activation when revocation timestamps are present even if state is inconsistent", async () => {
    const repository = new InMemoryNodeTrustRepository();
    await repository.registerNode({
      record: {
        nodeId: "node-activation-revoked-metadata-1",
        nodeType: NodeTypes.compute,
        displayName: "Activation Revoked Metadata 1",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.pendingApproval,
        certificate: {
          certificateRef: "cert:activation-revoked-metadata-1:v1",
        },
        deploymentTags: ["activation"],
        revocation: {
          state: NodeRevocationStates.active,
          revokedAt: "2026-04-05T18:10:00.000Z",
        },
        enrolledAt: "2026-04-05T18:00:00.000Z",
        revokedAt: "2026-04-05T18:10:00.000Z",
        createdAt: "2026-04-05T18:00:00.000Z",
        createdBy: "seed",
        lastModifiedAt: "2026-04-05T18:10:00.000Z",
        lastModifiedBy: "seed",
        revision: 1,
      },
      mutation: {
        operationKey: "seed-activation-revoked-metadata-1",
        context: {
          actorUserIdentityId: "seed",
        },
      },
    });

    const useCase = new ActivateApprovedNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createAllowAllAuthorizationHook(),
      clock: createFixedClock("2026-04-05T18:15:00.000Z"),
      auditSink: new RecordingAuditSink(),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin-1",
      nodeId: "node-activation-revoked-metadata-1",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(NodeTrustUseCaseErrorCodes.invalidState);
      expect(result.error.message).toContain("revoked");
    }
  });
});

