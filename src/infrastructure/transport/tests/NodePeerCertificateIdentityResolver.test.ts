import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";
import type { INodeTrustIdentityPersistenceRepository } from "../../../application/nodes/ports/INodeTrustIdentityPersistenceRepository";
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
import { NodePeerCertificateIdentityResolver } from "../NodePeerCertificateIdentityResolver";

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

describe("NodePeerCertificateIdentityResolver", () => {
  it("resolves approved and trusted peer identity when certificate evidence matches", async () => {
    const repository = new InMemoryNodeRepository();
    repository.byNodeId.set("node:peer:1", createNodeRecord({
      nodeId: "node:peer:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      revocationState: NodeRevocationStates.active,
      certificateRef: "AA11",
      certificateThumbprint: "AA:BB:CC",
    }));

    const resolver = new NodePeerCertificateIdentityResolver(repository);
    const result = await resolver.resolveNodePeerCertificateIdentity({
      nodeId: "node:peer:1",
      certificateSerialNumber: "aa11",
      certificateFingerprintSha256: "aabbcc",
    });

    expect(result.resolution).toBe("resolved");
    expect(result.certificateBound).toBeTrue();
    expect(result.approved).toBeTrue();
    expect(result.trusted).toBeTrue();
    expect(result.revoked).toBeFalse();
  });

  it("reports mismatch and not-found states for unbound or unknown peer identities", async () => {
    const repository = new InMemoryNodeRepository();
    repository.byNodeId.set("node:peer:2", createNodeRecord({
      nodeId: "node:peer:2",
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
      revocationState: NodeRevocationStates.active,
      certificateRef: "BB22",
      certificateThumbprint: "11:22:33",
    }));

    const resolver = new NodePeerCertificateIdentityResolver(repository);
    const mismatch = await resolver.resolveNodePeerCertificateIdentity({
      nodeId: "node:peer:2",
      certificateSerialNumber: "CC33",
      certificateFingerprintSha256: "112233",
    });
    const missing = await resolver.resolveNodePeerCertificateIdentity({
      nodeId: "node:peer:missing",
      certificateSerialNumber: "CC33",
    });

    expect(mismatch.resolution).toBe("mismatch");
    expect(mismatch.certificateBound).toBeFalse();
    expect(mismatch.approved).toBeFalse();
    expect(mismatch.trusted).toBeFalse();
    expect(missing.resolution).toBe("not-found");
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
    deploymentTags: Object.freeze(["peer"]),
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
