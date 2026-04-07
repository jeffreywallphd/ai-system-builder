import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
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
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type {
  ITrustMaterialDistributionPort,
  PublishTrustBundleInput,
  PublishTrustBundleResult,
  ResolveRuntimeTrustMaterialPackageInput,
  ResolveRuntimeTrustMaterialPackageResult,
} from "../../security/ports/ITrustMaterialDistributionPort";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "../../security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "../use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";

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

class StubTrustMaterialDistributionPort implements ITrustMaterialDistributionPort {
  public lastResolveInput?: ResolveRuntimeTrustMaterialPackageInput;
  public resolveResult?: ResolveRuntimeTrustMaterialPackageResult;

  public async publishTrustBundle(_input: PublishTrustBundleInput): Promise<PublishTrustBundleResult> {
    throw new Error("not implemented");
  }

  public async resolveRuntimeTrustMaterialPackage(
    input: ResolveRuntimeTrustMaterialPackageInput,
  ): Promise<ResolveRuntimeTrustMaterialPackageResult | undefined> {
    this.lastResolveInput = input;
    return this.resolveResult;
  }
}

describe("ResolveApprovedNodeRuntimeTrustMaterialUseCase", () => {
  it("returns runtime trust material for approved trusted nodes", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:alpha", createNodeRecord({
      nodeId: "node:alpha",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      certificateRef: "cert:node:alpha:v1",
      revocationState: NodeRevocationStates.active,
    }));

    const distribution = new StubTrustMaterialDistributionPort();
    distribution.resolveResult = Object.freeze({
      packageId: "runtime-trust-package:node:node:alpha",
      occurredAt: "2026-04-05T12:00:00.000Z",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      leafCertificatePem: "-----BEGIN CERTIFICATE-----leaf-----END CERTIFICATE-----",
      certificateChainPem: "-----BEGIN CERTIFICATE-----chain-----END CERTIFICATE-----",
      trustBundlePem: "-----BEGIN CERTIFICATE-----bundle-----END CERTIFICATE-----",
      protectedReferences: Object.freeze([]),
    });
    const runtimeResolver = new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: distribution,
    });

    const useCase = new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository,
      runtimeTrustMaterialResolver: runtimeResolver,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node:alpha",
      nodeId: "node:alpha",
      includeLeafCertificate: true,
      includeCertificateChain: true,
      includeTrustBundle: true,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected node runtime trust material retrieval to succeed.");
    }

    expect(result.value.runtimeTrustMaterial.targetReferenceId).toBe("node:alpha");
    expect(result.value.runtimeTrustMaterial.leafCertificatePem).toContain("BEGIN CERTIFICATE");
    expect(distribution.lastResolveInput?.targetKind).toBe("node");
    expect(distribution.lastResolveInput?.includeProtectedReferences).toBeFalse();
  });

  it("rejects runtime retrieval for revoked nodes", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:revoked", createNodeRecord({
      nodeId: "node:revoked",
      approvalStatus: NodeApprovalStatuses.rejected,
      trustState: NodeTrustStates.revoked,
      certificateRef: "cert:node:revoked:v1",
      revocationState: NodeRevocationStates.revoked,
      revokedAt: "2026-04-05T12:30:00.000Z",
    }));

    const useCase = new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository,
      runtimeTrustMaterialResolver: new ResolveRuntimeTrustMaterialPackageUseCase({
        trustMaterialDistributionPort: new StubTrustMaterialDistributionPort(),
      }),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node:revoked",
      nodeId: "node:revoked",
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected revoked node runtime retrieval to fail.");
    }
    expect(result.error.code).toBe("node-trust-invalid-state");
  });

  it("rejects actor/node mismatches", async () => {
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.byNodeId.set("node:alpha", createNodeRecord({
      nodeId: "node:alpha",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      certificateRef: "cert:node:alpha:v1",
      revocationState: NodeRevocationStates.active,
    }));

    const useCase = new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository,
      runtimeTrustMaterialResolver: new ResolveRuntimeTrustMaterialPackageUseCase({
        trustMaterialDistributionPort: new StubTrustMaterialDistributionPort(),
      }),
    });

    const result = await useCase.execute({
      actorUserIdentityId: "node:other",
      nodeId: "node:alpha",
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected actor/node mismatch to fail.");
    }
    expect(result.error.code).toBe("node-trust-forbidden");
  });
});

function createNodeRecord(input: {
  readonly nodeId: string;
  readonly approvalStatus: NodeIdentityPersistenceRecord["approvalStatus"];
  readonly trustState: NodeIdentityPersistenceRecord["trustState"];
  readonly certificateRef?: string;
  readonly revocationState: NodeIdentityPersistenceRecord["revocation"]["state"];
  readonly revokedAt?: string;
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
      })
      : undefined,
    deploymentTags: Object.freeze(["trust"]),
    lastSeen: Object.freeze({
      lastSeenAt: "2026-04-05T12:00:00.000Z",
      heartbeatStatus: NodeHeartbeatStatuses.online,
    }),
    revocation: Object.freeze({
      state: input.revocationState,
      revokedAt: input.revokedAt,
    }),
    enrolledAt: "2026-04-05T11:00:00.000Z",
    approvedAt: input.approvalStatus === NodeApprovalStatuses.approved ? "2026-04-05T11:10:00.000Z" : undefined,
    revokedAt: input.revokedAt,
    createdAt: "2026-04-05T11:00:00.000Z",
    createdBy: "seed",
    lastModifiedAt: "2026-04-05T12:00:00.000Z",
    lastModifiedBy: "seed",
    revision: 0,
  });
}

