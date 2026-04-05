import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../domain/security/CertificateAuthorityDomain";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  CertificateAuthorityPersistenceMutationResult,
  CertificateAuthorityRootLookupQuery,
  CertificateAuthorityRootPersistenceRecord,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveCertificateAuthorityRootPersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SaveTrustMaterialReferencePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
  TrustMaterialReferenceLookupQuery,
  TrustMaterialReferencePersistenceRecord,
  UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  UpdateCertificateAuthorityStatusPersistenceRecordInput,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
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
import type {
  IssueCertificateMaterialInput,
  IssueCertificateMaterialResult,
  InitializeInternalCertificateAuthorityInput,
  InitializeInternalCertificateAuthorityResult,
  RevokeCertificateMaterialInput,
  RevokeCertificateMaterialResult,
} from "../ports/ICertificateAuthorityIssuerPort";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateAuthorityRootMaterialStorage } from "../ports/ICertificateAuthorityRootMaterialStorage";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../../nodes/ports/INodeTrustIdentityPersistenceRepository";
import {
  CertificateIssuancePolicyViolationError,
  IssueCertificateForSubjectUseCase,
} from "../use-cases/IssueCertificateForSubjectUseCase";
import { CertificateSubjectProfileKinds } from "../../../domain/security/CertificateIssuancePolicyDomain";

class InMemoryCertificateAuthorityRepository implements ICertificateAuthorityRootPersistenceRepository {
  public authority?: CertificateAuthorityRootPersistenceRecord;

  async findCertificateAuthorityById(
    certificateAuthorityId: string,
  ): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authority?.certificateAuthorityId === certificateAuthorityId ? this.authority : undefined;
  }

  async findActiveCertificateAuthority(_asOf?: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authority?.status === CertificateAuthorityStatuses.active ? this.authority : undefined;
  }

  async listCertificateAuthorities(
    _query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return this.authority ? [this.authority] : [];
  }

  async saveCertificateAuthority(
    input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    this.authority = input.record;
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }

  async updateCertificateAuthorityStatus(
    input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    if (!this.authority) {
      throw new Error("missing authority");
    }

    this.authority = {
      ...this.authority,
      status: input.status,
      retiredAt: input.retiredAt,
      compromisedAt: input.compromisedAt,
    };

    return {
      record: this.authority,
      changed: true,
      wasReplay: false,
    };
  }

  async updateCertificateAuthorityRotationPolicy(
    input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    if (!this.authority) {
      throw new Error("missing authority");
    }

    this.authority = {
      ...this.authority,
      rotationPolicy: input.rotationPolicy,
    };

    return {
      record: this.authority,
      changed: true,
      wasReplay: false,
    };
  }
}

class InMemoryIssuedCertificateRepository implements IIssuedCertificatePersistenceRepository {
  public readonly records: IssuedCertificatePersistenceRecord[] = [];

  async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.records.find((record) => record.serialNumber === serialNumber);
  }

  async findLatestIssuedCertificateBySubjectReference(
    _input: {
      readonly kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
      readonly referenceId: string;
      readonly workspaceId?: string;
    },
  ): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.records[this.records.length - 1];
  }

  async listIssuedCertificates(_query: IssuedCertificateLookupQuery): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return this.records;
  }

  async saveIssuedCertificate(
    input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    this.records.push(input.record);
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }

  async revokeIssuedCertificate(
    _input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<never> {
    throw new Error("not implemented in test");
  }

  async supersedeIssuedCertificate(
    _input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<never> {
    throw new Error("not implemented in test");
  }
}

class InMemoryNodeRepository implements INodeTrustIdentityPersistenceRepository {
  public readonly nodesById = new Map<string, NodeIdentityPersistenceRecord>();

  async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.nodesById.get(nodeId);
  }

  async listNodes(_query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    return [...this.nodesById.values()];
  }

  async registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    this.nodesById.set(input.record.nodeId, input.record);
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
}

class InMemoryTrustMaterialRepository implements ITrustMaterialReferencePersistenceRepository {
  public readonly records = new Map<string, TrustMaterialReferencePersistenceRecord>();

  public throwOnSave = false;

  async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.records.get(materialRef);
  }

  async listTrustMaterials(
    _query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.records.values()];
  }

  async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    if (this.throwOnSave) {
      throw new Error("trust-material-save-failed");
    }
    this.records.set(input.record.materialRef, input.record);
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }
}

class StubCertificateMaterialStorage implements ICertificateAuthorityRootMaterialStorage {
  public readonly persisted = new Map<string, {
    readonly secretRef: string;
    readonly kind: string;
    readonly plaintextValue: string;
  }>();

  async persistRootMaterials(input: {
    readonly certificateAuthorityId: string;
    readonly actorUserIdentityId: string;
    readonly reason?: string;
    readonly materials: ReadonlyArray<{
      readonly materialRef: string;
      readonly kind: string;
      readonly plaintextValue: string;
      readonly keyScope?: string;
      readonly secretRef?: string;
    }>;
  }): Promise<ReadonlyArray<{
    readonly materialRef: string;
    readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
    readonly secretRef: string;
    readonly secretRefRedacted: string;
    readonly keyScope: string;
    readonly source: string;
  }>> {
    return input.materials.map((material) => {
      const secretRef = material.secretRef ?? `secret-store:issued:${material.materialRef}`;
      this.persisted.set(material.materialRef, {
        secretRef,
        kind: material.kind,
        plaintextValue: material.plaintextValue,
      });
      return {
        materialRef: material.materialRef,
        kind: material.kind as "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem",
        secretRef,
        secretRefRedacted: "secret-st...acted",
        keyScope: material.keyScope ?? "default",
        source: "test",
      };
    });
  }

  async loadRootMaterials(
    _input: {
      readonly certificateAuthorityId: string;
      readonly reason?: string;
      readonly materials: ReadonlyArray<{
        readonly materialRef: string;
        readonly kind: string;
        readonly secretRef: string;
        readonly keyScope?: string;
      }>;
    },
  ): Promise<ReadonlyArray<{
    readonly materialRef: string;
    readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
    readonly plaintextValue: string;
  }>> {
    throw new Error("not implemented in test");
  }
}

class StubIssuerPort {
  public issueCalls = 0;
  public revokeCalls: RevokeCertificateMaterialInput[] = [];

  async initializeInternalCertificateAuthority(
    _input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult> {
    throw new Error("not implemented in test");
  }

  async issueCertificateMaterial(input: IssueCertificateMaterialInput): Promise<IssueCertificateMaterialResult> {
    this.issueCalls += 1;
    return {
      certificateAuthorityId: input.certificateAuthorityId,
      serialNumber: "AABBCC11",
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2026-08-05T12:00:00.000Z",
      certificatePem: "issued-certificate-pem",
      certificateChainPem: "issued-chain-pem",
      certificateFingerprintSha256: "a".repeat(64),
    };
  }

  async revokeCertificateMaterial(
    input: RevokeCertificateMaterialInput,
  ): Promise<RevokeCertificateMaterialResult> {
    this.revokeCalls.push(input);
    return {
      certificateAuthorityId: input.certificateAuthorityId,
      serialNumber: input.serialNumber,
      revokedAt: input.revokedAt ?? "2026-04-05T12:01:00.000Z",
    };
  }
}

describe("IssueCertificateForSubjectUseCase", () => {
  it("prevents node issuance for unapproved nodes before issuer invocation", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.nodesById.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
    }));
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeRepository,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);
    expect(issuer.issueCalls).toBe(0);
  });

  it("prevents node issuance for revoked nodes", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.nodesById.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.revoked,
      revocationState: NodeRevocationStates.revoked,
      revokedAt: "2026-04-04T11:00:00.000Z",
    }));
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeRepository,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);
    expect(issuer.issueCalls).toBe(0);
  });

  it("issues node certificates for approved non-revoked nodes", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.nodesById.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
    }));
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeRepository,
    });

    const result = await useCase.execute(createNodeIssuanceRequest());

    expect(result.profileKind).toBe(CertificateSubjectProfileKinds.approvedNode);
    expect(issuer.issueCalls).toBe(1);
    expect(issuedCertificates.records).toHaveLength(1);
    expect(issuedCertificates.records[0]?.subjectReference.referenceId).toBe("node:compute:1");
  });

  it("keeps authoritative-server and internal-service issuance paths separated", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
    });

    await expect(useCase.execute({
      ...createServiceIssuanceRequest(),
      profileKind: CertificateSubjectProfileKinds.authoritativeServer,
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.service,
        referenceId: "service:api",
      },
      usages: [
        CertificateUsageKinds.serverAuth,
        CertificateUsageKinds.clientAuth,
      ],
    })).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);

    const serviceResult = await useCase.execute(createServiceIssuanceRequest());
    expect(serviceResult.profileKind).toBe(CertificateSubjectProfileKinds.internalService);
    expect(issuer.issueCalls).toBe(1);
  });

  it("persists issued certificate and chain trust material references", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.nodesById.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
    }));
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeRepository,
    });

    await useCase.execute(createNodeIssuanceRequest());

    expect(issuedCertificates.records).toHaveLength(1);
    expect(trustMaterials.records.get("trust:cert:node:1:v1")?.kind).toBe("certificate-pem");
    expect(trustMaterials.records.get("trust:chain:ca:root:v1")?.kind).toBe("certificate-chain-pem");
    expect(certificateMaterialStorage.persisted.get("trust:cert:node:1:v1")?.plaintextValue).toBe("issued-certificate-pem");
  });

  it("fails cleanly and attempts compensating revocation when trust material persistence fails after signing", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeRepository = new InMemoryNodeRepository();
    nodeRepository.nodesById.set("node:compute:1", createNode({
      nodeId: "node:compute:1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.pendingApproval,
    }));
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    trustMaterials.throwOnSave = true;
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeRepository,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toThrow("trust-material-save-failed");
    expect(issuer.revokeCalls).toHaveLength(1);
    expect(issuedCertificates.records).toHaveLength(0);
  });
});

function createAuthority(): CertificateAuthorityRootPersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    displayName: "AI Loom Internal Root",
    status: CertificateAuthorityStatuses.active,
    subject: {
      commonName: "AI Loom Internal Root CA",
      dnsNames: [],
      ipAddresses: [],
      uriSanEntries: [],
    },
    serialNumber: "AA11BB22",
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2036-01-01T00:00:00.000Z",
    },
    signatureAlgorithm: "sha256WithRSAEncryption",
    rootCertificateMaterialRef: "trust:ca:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    rotationPolicy: {
      profileId: "rotation:default",
      autoRotateEnabled: true,
      rotateBeforeExpiryDays: 90,
      overlapDays: 30,
      maxLifetimeDays: 3650,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createNode(input: {
  readonly nodeId: string;
  readonly approvalStatus: NodeIdentityPersistenceRecord["approvalStatus"];
  readonly trustState: NodeIdentityPersistenceRecord["trustState"];
  readonly revocationState?: NodeIdentityPersistenceRecord["revocation"]["state"];
  readonly revokedAt?: string;
}): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId: input.nodeId,
    nodeType: NodeTypes.compute,
    displayName: input.nodeId,
    capabilityProfile: {
      enabledCapabilities: ["api", "executor"],
      supportsRemoteScheduling: true,
    },
    approvalStatus: input.approvalStatus,
    trustState: input.trustState,
    deploymentTags: ["cluster:a"],
    revocation: {
      state: input.revocationState ?? NodeRevocationStates.active,
      revokedAt: input.revokedAt,
    },
    enrolledAt: "2026-04-01T00:00:00.000Z",
    approvedAt: input.approvalStatus === NodeApprovalStatuses.approved ? "2026-04-02T00:00:00.000Z" : undefined,
    revokedAt: input.revokedAt,
    createdAt: "2026-04-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-02T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createNodeIssuanceRequest() {
  return {
    operationKey: "issue-node-cert-1",
    profileKind: CertificateSubjectProfileKinds.approvedNode,
    certificateAuthorityId: "ca:internal:root:v1",
    subject: {
      commonName: "node-1.ai-loom.internal",
      dnsNames: ["node-1.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: ["spiffe://ai-loom.internal/node/node:compute:1"],
    },
    subjectReference: {
      kind: CertificateSubjectReferenceKinds.node,
      referenceId: "node:compute:1",
    },
    usages: [
      CertificateUsageKinds.clientAuth,
      CertificateUsageKinds.nodeEnrollment,
    ],
    validityDays: 90,
    actorUserIdentityId: "user:admin",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----test-----END PUBLIC KEY-----",
    publicKeyAlgorithm: "rsa-4096",
    certificateMaterialRef: "trust:cert:node:1:v1",
    certificateChainMaterialRef: "trust:chain:ca:root:v1",
    occurredAt: "2026-04-05T12:00:00.000Z",
  } as const;
}

function createServiceIssuanceRequest() {
  return {
    operationKey: "issue-service-cert-1",
    profileKind: CertificateSubjectProfileKinds.internalService,
    certificateAuthorityId: "ca:internal:root:v1",
    subject: {
      commonName: "api.ai-loom.internal",
      dnsNames: ["api.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: [],
    },
    subjectReference: {
      kind: CertificateSubjectReferenceKinds.service,
      referenceId: "service:api",
    },
    usages: [
      CertificateUsageKinds.serviceIdentity,
    ],
    validityDays: 45,
    actorUserIdentityId: "user:admin",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----test-----END PUBLIC KEY-----",
    publicKeyAlgorithm: "rsa-4096",
    certificateMaterialRef: "trust:cert:service:api:v1",
    certificateChainMaterialRef: "trust:chain:ca:root:v1",
    occurredAt: "2026-04-05T12:00:00.000Z",
  } as const;
}
