import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../domain/security/CertificateAuthorityDomain";
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
  ApprovedNodeCertificateEligibilityDecision,
  ApprovedNodeCertificateEligibilityInput,
  INodeCertificateEligibilityPort,
} from "../ports/INodeCertificateEligibilityPort";
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
import {
  CertificateIssuancePolicyViolationError,
  IssueCertificateForSubjectUseCase,
} from "../use-cases/IssueCertificateForSubjectUseCase";
import { CertificateSubjectProfileKinds } from "../../../domain/security/CertificateIssuancePolicyDomain";
import type { CertificateLifecycleAuditEvent, CertificateLifecycleAuditSink } from "../ports/CertificateLifecycleAuditPorts";

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

class StubNodeEligibilityPort implements INodeCertificateEligibilityPort {
  public readonly decisionsByNodeId = new Map<string, ApprovedNodeCertificateEligibilityDecision>();

  public readonly calls: ApprovedNodeCertificateEligibilityInput[] = [];

  async resolveApprovedNodeCertificateEligibility(
    input: ApprovedNodeCertificateEligibilityInput,
  ): Promise<ApprovedNodeCertificateEligibilityDecision> {
    this.calls.push(input);
    const decision = this.decisionsByNodeId.get(input.nodeId);
    if (!decision) {
      return Object.freeze({
        eligible: false,
        violations: Object.freeze([`Node '${input.nodeId}' does not exist and cannot receive an issued certificate.`]),
      });
    }
    return decision;
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

class CapturingCertificateLifecycleAuditSink implements CertificateLifecycleAuditSink {
  public readonly events: CertificateLifecycleAuditEvent[] = [];

  public async recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("IssueCertificateForSubjectUseCase", () => {
  it("requires node eligibility integration for approved-node issuance", async () => {
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

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toThrow(
      "Node certificate eligibility port is required for approved-node certificate issuance.",
    );
    expect(issuer.issueCalls).toBe(0);
  });

  it("prevents node issuance for unapproved nodes before issuer invocation", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: false,
      violations: Object.freeze(["Node 'node:compute:1' must be approved before certificate issuance."]),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);
    expect(issuer.issueCalls).toBe(0);
  });

  it("prevents node issuance for revoked nodes", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: false,
      violations: Object.freeze(["Node 'node:compute:1' is revoked and cannot receive a certificate."]),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);
    expect(issuer.issueCalls).toBe(0);
  });

  it("issues node certificates for approved non-revoked nodes", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: true,
      metadata: Object.freeze({
        nodeId: "node:compute:1",
        enrollmentRequestId: "enroll:node:compute:1:v1",
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["api", "executor"]),
          supportsRemoteScheduling: true,
        }),
      }),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
    });

    const result = await useCase.execute(createNodeIssuanceRequest());

    expect(result.profileKind).toBe(CertificateSubjectProfileKinds.approvedNode);
    expect(issuer.issueCalls).toBe(1);
    expect(issuedCertificates.records).toHaveLength(1);
    expect(issuedCertificates.records[0]?.subjectReference.referenceId).toBe("node:compute:1");
    expect(nodeEligibilityPort.calls).toHaveLength(1);
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
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: true,
      metadata: Object.freeze({
        nodeId: "node:compute:1",
        enrollmentRequestId: "enroll:node:compute:1:v1",
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["api", "executor"]),
          supportsRemoteScheduling: true,
        }),
      }),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
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
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: true,
      metadata: Object.freeze({
        nodeId: "node:compute:1",
        enrollmentRequestId: "enroll:node:compute:1:v1",
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["api", "executor"]),
          supportsRemoteScheduling: true,
        }),
      }),
    });
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
      nodeCertificateEligibilityPort: nodeEligibilityPort,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toThrow("trust-material-save-failed");
    expect(issuer.revokeCalls).toHaveLength(1);
    expect(issuedCertificates.records).toHaveLength(0);
  });

  it("emits a blocked issuance audit event when policy gate prevents signing", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: false,
      violations: Object.freeze(["Node 'node:compute:1' must be approved before certificate issuance."]),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const certificateMaterialStorage = new StubCertificateMaterialStorage();
    const auditSink = new CapturingCertificateLifecycleAuditSink();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
      auditSink,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);

    expect(auditSink.events.map((event) => event.type)).toEqual([
      "certificate-issuance-started",
      "certificate-issuance-blocked",
    ]);
    expect((auditSink.events[1]?.details as Record<string, unknown>)?.code).toBe("certificate-issuance-policy-violation");
  });

  it("emits a failed issuance audit event when post-signing persistence fails", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const nodeEligibilityPort = new StubNodeEligibilityPort();
    nodeEligibilityPort.decisionsByNodeId.set("node:compute:1", {
      eligible: true,
      metadata: Object.freeze({
        nodeId: "node:compute:1",
        enrollmentRequestId: "enroll:node:compute:1:v1",
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["api", "executor"]),
          supportsRemoteScheduling: true,
        }),
      }),
    });
    const issuer = new StubIssuerPort();
    const trustMaterials = new InMemoryTrustMaterialRepository();
    trustMaterials.throwOnSave = true;
    const certificateMaterialStorage = new StubCertificateMaterialStorage();
    const auditSink = new CapturingCertificateLifecycleAuditSink();

    const useCase = new IssueCertificateForSubjectUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage,
      issuer,
      nodeCertificateEligibilityPort: nodeEligibilityPort,
      auditSink,
    });

    await expect(useCase.execute(createNodeIssuanceRequest())).rejects.toThrow("trust-material-save-failed");

    expect(auditSink.events.map((event) => event.type)).toEqual([
      "certificate-issuance-started",
      "certificate-issuance-failed",
    ]);
    expect((auditSink.events[1]?.details as Record<string, unknown>)?.compensatingRevocationAttempted).toBe(true);
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
