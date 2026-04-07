import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
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
import {
  NodeTrustPersistenceQueryPresets,
  normalizeNodeTrustMutationOperationKey,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type { NodeTrustPersistencePorts } from "../ports/NodeTrustPersistencePorts";

const EnrollmentTerminalStatuses = new Set([
  NodeEnrollmentRequestStatuses.approved,
  NodeEnrollmentRequestStatuses.rejected,
  NodeEnrollmentRequestStatuses.withdrawn,
  NodeEnrollmentRequestStatuses.expired,
]);

class InMemoryNodeTrustPersistenceAdapter
  implements INodeTrustIdentityPersistenceRepository, INodeEnrollmentRequestPersistenceRepository {
  private readonly nodesById = new Map<string, NodeIdentityPersistenceRecord>();
  private readonly enrollmentRequestsById = new Map<string, NodeEnrollmentRequestPersistenceRecord>();
  private readonly mutationReplayByOperationKey = new Map<string, unknown>();

  async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.nodesById.get(nodeId);
  }

  async listNodes(query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    const filtered = [...this.nodesById.values()].filter((record) => {
      if (query.nodeTypes && query.nodeTypes.length > 0 && !query.nodeTypes.includes(record.nodeType)) {
        return false;
      }
      if (query.approvalStatuses && query.approvalStatuses.length > 0 && !query.approvalStatuses.includes(record.approvalStatus)) {
        return false;
      }
      if (query.trustStates && query.trustStates.length > 0 && !query.trustStates.includes(record.trustState)) {
        return false;
      }
      if (query.revocationStates && query.revocationStates.length > 0 && !query.revocationStates.includes(record.revocation.state)) {
        return false;
      }
      if (
        query.capabilityAnyOf
        && query.capabilityAnyOf.length > 0
        && !query.capabilityAnyOf.some((capability) => record.capabilityProfile.enabledCapabilities.includes(capability))
      ) {
        return false;
      }
      if (
        query.deploymentTagAnyOf
        && query.deploymentTagAnyOf.length > 0
        && !query.deploymentTagAnyOf.some((tag) => record.deploymentTags.includes(tag.trim().toLowerCase()))
      ) {
        return false;
      }
      if (query.certificateAssigned === true && !record.certificate?.certificateRef) {
        return false;
      }
      if (query.certificateAssigned === false && !!record.certificate?.certificateRef) {
        return false;
      }
      if (query.activeOnly && !NodeTrustPersistenceQueryPresets.activeNodeTrustStates.includes(record.trustState)) {
        return false;
      }
      if (!query.includeRevoked && record.trustState === NodeTrustStates.revoked) {
        return false;
      }

      const lastSeenEpoch = record.lastSeen ? Date.parse(record.lastSeen.lastSeenAt) : undefined;
      if (query.lastSeenAfter && lastSeenEpoch !== undefined && lastSeenEpoch < Date.parse(query.lastSeenAfter)) {
        return false;
      }
      if (query.lastSeenBefore && lastSeenEpoch !== undefined && lastSeenEpoch > Date.parse(query.lastSeenBefore)) {
        return false;
      }
      if (query.lastSeenAfter && lastSeenEpoch === undefined) {
        return false;
      }
      if (query.enrolledAfter && Date.parse(record.enrolledAt) < Date.parse(query.enrolledAfter)) {
        return false;
      }
      if (query.enrolledBefore && Date.parse(record.enrolledAt) > Date.parse(query.enrolledBefore)) {
        return false;
      }
      return true;
    });

    return this.page(filtered, query.limit, query.offset);
  }

  async registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const operationKey = normalizeNodeTrustMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      const replayRecord = replay as NodeIdentityPersistenceRecord;
      return Object.freeze({
        record: replayRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.nodesById.get(input.record.nodeId);
    if (typeof input.mutation.expectedRevision === "number" && existing && existing.revision !== input.mutation.expectedRevision) {
      throw new Error("Node expectedRevision did not match persisted revision.");
    }

    const next: NodeIdentityPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.nodesById.set(next.nodeId, next);
    const result = Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
    this.mutationReplayByOperationKey.set(operationKey, next);
    return result;
  }

  async updateNodeApproval(
    input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodesById.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        approvalStatus: input.approvalStatus,
        approvedAt: input.approvedAt ?? existing.approvedAt,
        trustState: input.trustState ?? existing.trustState,
      },
    });
  }

  async updateNodeCertificateReference(
    input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodesById.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        certificate: input.certificate,
      },
    });
  }

  async updateNodeCapabilityProfile(
    input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodesById.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        capabilityProfile: input.capabilityProfile,
      },
    });
  }

  async revokeNode(
    input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodesById.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        trustState: input.trustState ?? NodeTrustStates.revoked,
        revocation: input.revocation,
        revokedAt: input.revocation.revokedAt ?? existing.revokedAt,
      },
    });
  }

  async recordNodeLastSeen(
    input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const existing = this.nodesById.get(input.nodeId);
    if (!existing) {
      throw new Error("Node not found.");
    }

    return this.registerNode({
      mutation: input.mutation,
      record: {
        ...existing,
        lastSeen: input.lastSeen,
      },
    });
  }

  async findEnrollmentRequestById(requestId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    return this.enrollmentRequestsById.get(requestId);
  }

  async findPendingEnrollmentRequestByNodeId(
    nodeId: string,
    asOf?: string,
  ): Promise<NodeEnrollmentRequestPersistenceRecord | undefined> {
    const asOfEpoch = asOf ? Date.parse(asOf) : undefined;
    for (const request of this.enrollmentRequestsById.values()) {
      if (request.nodeId !== nodeId) {
        continue;
      }
      if (!NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses.includes(request.status)) {
        continue;
      }
      if (asOfEpoch !== undefined && Date.parse(request.requestedAt) > asOfEpoch) {
        continue;
      }
      return request;
    }
    return undefined;
  }

  async listEnrollmentRequests(
    query: NodeEnrollmentRequestPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>> {
    const filtered = [...this.enrollmentRequestsById.values()].filter((record) => {
      if (query.nodeId && record.nodeId !== query.nodeId) {
        return false;
      }
      if (query.nodeTypes && query.nodeTypes.length > 0 && !query.nodeTypes.includes(record.nodeType)) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(record.status)) {
        return false;
      }
      if (!query.includeTerminal && !query.statuses && EnrollmentTerminalStatuses.has(record.status)) {
        return false;
      }
      if (query.requestedAfter && Date.parse(record.requestedAt) < Date.parse(query.requestedAfter)) {
        return false;
      }
      if (query.requestedBefore && Date.parse(record.requestedAt) > Date.parse(query.requestedBefore)) {
        return false;
      }
      if (query.reviewedByUserIdentityId && record.reviewedByUserIdentityId !== query.reviewedByUserIdentityId) {
        return false;
      }
      return true;
    });

    return this.page(filtered, query.limit, query.offset);
  }

  async saveEnrollmentRequest(
    input: SaveNodeEnrollmentRequestPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const operationKey = normalizeNodeTrustMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      const replayRecord = replay as NodeEnrollmentRequestPersistenceRecord;
      return Object.freeze({
        record: replayRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.enrollmentRequestsById.get(input.record.requestId);
    if (typeof input.mutation.expectedRevision === "number" && existing && existing.revision !== input.mutation.expectedRevision) {
      throw new Error("Enrollment request expectedRevision did not match persisted revision.");
    }

    const next: NodeEnrollmentRequestPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.enrollmentRequestsById.set(next.requestId, next);
    const result = Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
    this.mutationReplayByOperationKey.set(operationKey, next);
    return result;
  }

  async transitionEnrollmentRequestStatus(
    input: TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>> {
    const existing = this.enrollmentRequestsById.get(input.requestId);
    if (!existing) {
      throw new Error("Enrollment request not found.");
    }

    const reviewedAt = input.reviewedAt
      ?? (
        input.toStatus === NodeEnrollmentRequestStatuses.approved
        || input.toStatus === NodeEnrollmentRequestStatuses.rejected
      ? input.mutation.context.occurredAt ?? existing.lastModifiedAt
      : existing.reviewedAt
      );

    return this.saveEnrollmentRequest({
      mutation: input.mutation,
      record: {
        ...existing,
        status: input.toStatus,
        reviewedAt,
        reviewedByUserIdentityId: input.reviewedByUserIdentityId ?? existing.reviewedByUserIdentityId,
        decisionNote: input.decisionNote ?? existing.decisionNote,
      },
    });
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = offset && offset > 0 ? offset : 0;
    const normalizedLimit = limit && limit > 0 ? limit : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

describe("node trust persistence repository contract assumptions", () => {
  it("supports node registration plus approval, certificate, and heartbeat updates", async () => {
    const adapter = new InMemoryNodeTrustPersistenceAdapter();
    const ports: NodeTrustPersistencePorts = {
      nodeTrustIdentityPersistenceRepository: adapter,
      nodeEnrollmentRequestPersistenceRepository: adapter,
    };

    const initialNode: NodeIdentityPersistenceRecord = Object.freeze({
      nodeId: "node-compute-001",
      nodeType: NodeTypes.compute,
      displayName: "Compute Node 001",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
        maxConcurrentWorkloads: 2,
      },
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
      deploymentTags: ["us-east-1", "gpu"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: "2026-04-05T12:00:00.000Z",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "system-bootstrap",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "system-bootstrap",
      revision: 0,
    });

    await ports.nodeTrustIdentityPersistenceRepository.registerNode({
      record: initialNode,
      mutation: {
        operationKey: "op-node-register-1",
        context: {
          actorUserIdentityId: "system-bootstrap",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    await ports.nodeTrustIdentityPersistenceRepository.updateNodeApproval({
      nodeId: initialNode.nodeId,
      approvalStatus: NodeApprovalStatuses.approved,
      approvedAt: "2026-04-05T12:05:00.000Z",
      trustState: NodeTrustStates.trusted,
      mutation: {
        operationKey: "op-node-approval-1",
        context: {
          actorUserIdentityId: "admin-1",
          occurredAt: "2026-04-05T12:05:00.000Z",
        },
      },
    });
    const certificateWrite = await ports.nodeTrustIdentityPersistenceRepository.updateNodeCertificateReference({
      nodeId: initialNode.nodeId,
      certificate: {
        certificateRef: "cert:node-compute-001:v1",
        certificateAssignedAt: "2026-04-05T12:06:00.000Z",
        certificateAuthorityRef: "ca:platform",
      },
      mutation: {
        operationKey: "op-node-cert-1",
        context: {
          actorUserIdentityId: "admin-1",
          occurredAt: "2026-04-05T12:06:00.000Z",
        },
      },
    });
    await ports.nodeTrustIdentityPersistenceRepository.recordNodeLastSeen({
      nodeId: initialNode.nodeId,
      lastSeen: {
        lastSeenAt: "2026-04-05T12:10:00.000Z",
        heartbeatStatus: NodeHeartbeatStatuses.online,
        observedBy: "heartbeat-ingestor",
      },
      mutation: {
        operationKey: "op-node-heartbeat-1",
        context: {
          actorUserIdentityId: "system-heartbeat",
          occurredAt: "2026-04-05T12:10:00.000Z",
        },
      },
    });

    const activeNodes = await ports.nodeTrustIdentityPersistenceRepository.listNodes({
      activeOnly: true,
      capabilityAnyOf: [NodeRoleCapabilities.executor],
      deploymentTagAnyOf: ["US-EAST-1"],
      certificateAssigned: true,
    });

    expect(certificateWrite.record.revision).toBe(3);
    expect(activeNodes).toHaveLength(1);
    expect(activeNodes[0]?.lastSeen?.heartbeatStatus).toBe(NodeHeartbeatStatuses.online);
    expect(activeNodes[0]?.certificate?.certificateRef).toBe("cert:node-compute-001:v1");
  });

  it("supports pending enrollment lookup and enrollment status transitions", async () => {
    const adapter = new InMemoryNodeTrustPersistenceAdapter();
    const ports: NodeTrustPersistencePorts = {
      nodeTrustIdentityPersistenceRepository: adapter,
      nodeEnrollmentRequestPersistenceRepository: adapter,
    };

    const enrollment: NodeEnrollmentRequestPersistenceRecord = Object.freeze({
      requestId: "enrollment-001",
      nodeId: "node-hybrid-001",
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Node 001",
      capabilityProfile: {
        enabledCapabilities: [
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.api,
        ],
        supportsRemoteScheduling: true,
      },
      deploymentTags: ["hybrid", "region-1"],
      requestedAt: "2026-04-05T13:00:00.000Z",
      status: NodeEnrollmentRequestStatuses.submitted,
      createdAt: "2026-04-05T13:00:00.000Z",
      createdBy: "node-hybrid-001",
      lastModifiedAt: "2026-04-05T13:00:00.000Z",
      lastModifiedBy: "node-hybrid-001",
      revision: 0,
    });

    await ports.nodeEnrollmentRequestPersistenceRepository.saveEnrollmentRequest({
      record: enrollment,
      mutation: {
        operationKey: "op-enrollment-save-1",
        context: {
          actorUserIdentityId: "node-hybrid-001",
          occurredAt: "2026-04-05T13:00:00.000Z",
        },
      },
    });

    const pending = await ports.nodeEnrollmentRequestPersistenceRepository.findPendingEnrollmentRequestByNodeId(
      "node-hybrid-001",
      "2026-04-05T13:01:00.000Z",
    );
    expect(pending?.requestId).toBe("enrollment-001");

    await ports.nodeEnrollmentRequestPersistenceRepository.transitionEnrollmentRequestStatus({
      requestId: "enrollment-001",
      toStatus: NodeEnrollmentRequestStatuses.approved,
      reviewedByUserIdentityId: "admin-1",
      mutation: {
        operationKey: "op-enrollment-approve-1",
        context: {
          actorUserIdentityId: "admin-1",
          occurredAt: "2026-04-05T13:05:00.000Z",
        },
      },
    });

    const pendingAfterApproval = await ports.nodeEnrollmentRequestPersistenceRepository.findPendingEnrollmentRequestByNodeId(
      "node-hybrid-001",
    );
    const approvedRecords = await ports.nodeEnrollmentRequestPersistenceRepository.listEnrollmentRequests({
      statuses: [NodeEnrollmentRequestStatuses.approved],
      includeTerminal: true,
    });

    expect(pendingAfterApproval).toBeUndefined();
    expect(approvedRecords).toHaveLength(1);
    expect(approvedRecords[0]?.reviewedByUserIdentityId).toBe("admin-1");
  });

  it("supports node revocation and revoked-node list filtering", async () => {
    const adapter = new InMemoryNodeTrustPersistenceAdapter();
    const ports: NodeTrustPersistencePorts = {
      nodeTrustIdentityPersistenceRepository: adapter,
      nodeEnrollmentRequestPersistenceRepository: adapter,
    };

    await ports.nodeTrustIdentityPersistenceRepository.registerNode({
      record: {
        nodeId: "node-compute-002",
        nodeType: NodeTypes.compute,
        displayName: "Compute Node 002",
        capabilityProfile: {
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
        },
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        certificate: {
          certificateRef: "cert:node-compute-002:v1",
        },
        deploymentTags: ["us-west-2"],
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: "2026-04-05T14:00:00.000Z",
        approvedAt: "2026-04-05T14:01:00.000Z",
        createdAt: "2026-04-05T14:00:00.000Z",
        createdBy: "system-bootstrap",
        lastModifiedAt: "2026-04-05T14:00:00.000Z",
        lastModifiedBy: "system-bootstrap",
        revision: 0,
      },
      mutation: {
        operationKey: "op-node-register-2",
        context: {
          actorUserIdentityId: "system-bootstrap",
          occurredAt: "2026-04-05T14:00:00.000Z",
        },
      },
    });

    const revocationResult = await ports.nodeTrustIdentityPersistenceRepository.revokeNode({
      nodeId: "node-compute-002",
      revocation: {
        state: NodeRevocationStates.revoked,
        reason: "policy-violation",
        revokedAt: "2026-04-05T14:30:00.000Z",
        revokedByUserIdentityId: "admin-2",
        note: "Trust disabled by admin review.",
      },
      mutation: {
        operationKey: "op-node-revoke-2",
        context: {
          actorUserIdentityId: "admin-2",
          occurredAt: "2026-04-05T14:30:00.000Z",
        },
      },
    });

    const revokedNodes = await ports.nodeTrustIdentityPersistenceRepository.listNodes({
      trustStates: NodeTrustPersistenceQueryPresets.revokedNodeTrustStates,
      includeRevoked: true,
    });
    const activeNodes = await ports.nodeTrustIdentityPersistenceRepository.listNodes({
      activeOnly: true,
      includeRevoked: false,
    });

    expect(revocationResult.record.trustState).toBe(NodeTrustStates.revoked);
    expect(revocationResult.record.revocation.state).toBe(NodeRevocationStates.revoked);
    expect(revocationResult.record.revocation.reason).toBe("policy-violation");
    expect(revocationResult.record.revocation.revokedByUserIdentityId).toBe("admin-2");
    expect(revocationResult.record.revocation.note).toBe("Trust disabled by admin review.");
    expect(revocationResult.record.revokedAt).toBe("2026-04-05T14:30:00.000Z");
    expect(revokedNodes[0]?.nodeId).toBe("node-compute-002");
    expect(revokedNodes[0]?.revocation.note).toBe("Trust disabled by admin review.");
    expect(revokedNodes).toHaveLength(1);
    expect(activeNodes).toHaveLength(0);
  });
});

