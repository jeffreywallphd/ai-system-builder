import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type {
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
  RecordNodeLastSeenPersistenceRecordInput,
  RegisterNodeIdentityPersistenceRecordInput,
  RevokeNodeIdentityPersistenceRecordInput,
  UpdateNodeApprovalPersistenceRecordInput,
  UpdateNodeCapabilityProfilePersistenceRecordInput,
  UpdateNodeCertificateReferencePersistenceRecordInput,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import { ResolveNodeMutualTlsTransportIdentityUseCase } from "../use-cases/ResolveNodeMutualTlsTransportIdentityUseCase";

class InMemoryNodeRepository implements INodeTrustIdentityPersistenceRepository {
  public readonly byNodeId = new Map<string, NodeIdentityPersistenceRecord>();

  public async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.byNodeId.get(nodeId);
  }

  public async listNodes(_query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    return Object.freeze([...this.byNodeId.values()]);
  }

  public async registerNode(
    _input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async updateNodeApproval(
    _input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async updateNodeCertificateReference(
    _input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async updateNodeCapabilityProfile(
    _input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async revokeNode(
    _input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async recordNodeLastSeen(
    _input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    throw new Error("not implemented");
  }
}

describe("ResolveNodeMutualTlsTransportIdentityUseCase", () => {
  it("accepts trusted nodes when mTLS certificate metadata matches node bindings", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:trusted:tls-1", createNodeRecord({
      nodeId: "node:trusted:tls-1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      revocationState: NodeRevocationStates.active,
      certificateRef: "AA11",
      certificateThumbprint: "AA:BB:CC:DD",
    }));

    const useCase = new ResolveNodeMutualTlsTransportIdentityUseCase({
      nodeRepository,
    });

    const result = await useCase.execute({
      nodeId: "node:trusted:tls-1",
      certificateSerialNumber: "aa11",
      certificateFingerprintSha256: "aabbccdd",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected certificate-bound node transport identity to resolve.");
    }
    expect(result.value.nodeId).toBe("node:trusted:tls-1");
    expect(result.value.certificateRef).toBe("AA11");
  });

  it("rejects revoked nodes even when certificate metadata matches", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:revoked:tls-1", createNodeRecord({
      nodeId: "node:revoked:tls-1",
      approvalStatus: NodeApprovalStatuses.rejected,
      trustState: NodeTrustStates.revoked,
      revocationState: NodeRevocationStates.revoked,
      certificateRef: "BB22",
    }));

    const useCase = new ResolveNodeMutualTlsTransportIdentityUseCase({
      nodeRepository,
    });

    const result = await useCase.execute({
      nodeId: "node:revoked:tls-1",
      certificateSerialNumber: "BB22",
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected revoked node to be rejected.");
    }
    expect(result.error.code).toBe("node-trust-invalid-state");
  });

  it("rejects unknown nodes and certificate mismatches", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:trusted:tls-2", createNodeRecord({
      nodeId: "node:trusted:tls-2",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      revocationState: NodeRevocationStates.active,
      certificateRef: "CC33",
    }));

    const useCase = new ResolveNodeMutualTlsTransportIdentityUseCase({
      nodeRepository,
    });

    const notFound = await useCase.execute({
      nodeId: "node:unknown",
      certificateSerialNumber: "CC33",
    });
    expect(notFound.ok).toBeFalse();
    if (!notFound.ok) {
      expect(notFound.error.code).toBe("node-trust-not-found");
    }

    const mismatch = await useCase.execute({
      nodeId: "node:trusted:tls-2",
      certificateSerialNumber: "EE55",
    });
    expect(mismatch.ok).toBeFalse();
    if (!mismatch.ok) {
      expect(mismatch.error.code).toBe("node-trust-forbidden");
    }
  });
});

function createNodeRecord(input: {
  readonly nodeId: string;
  readonly approvalStatus: NodeIdentityPersistenceRecord["approvalStatus"];
  readonly trustState: NodeIdentityPersistenceRecord["trustState"];
  readonly revocationState: NodeIdentityPersistenceRecord["revocation"]["state"];
  readonly certificateRef?: string;
  readonly certificateThumbprint?: string;
}): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId: input.nodeId,
    nodeType: NodeTypes.compute,
    displayName: `Node ${input.nodeId}`,
    capabilityProfile: {
      enabledCapabilities: [NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
    },
    approvalStatus: input.approvalStatus,
    trustState: input.trustState,
    certificate: input.certificateRef
      ? Object.freeze({
        certificateRef: input.certificateRef,
        certificateThumbprint: input.certificateThumbprint,
      })
      : undefined,
    deploymentTags: Object.freeze(["trust"]),
    revocation: Object.freeze({
      state: input.revocationState,
    }),
    enrolledAt: "2026-04-05T11:00:00.000Z",
    approvedAt: input.approvalStatus === NodeApprovalStatuses.approved ? "2026-04-05T11:10:00.000Z" : undefined,
    createdAt: "2026-04-05T11:00:00.000Z",
    createdBy: "seed",
    lastModifiedAt: "2026-04-05T12:00:00.000Z",
    lastModifiedBy: "seed",
    revision: 0,
  });
}
