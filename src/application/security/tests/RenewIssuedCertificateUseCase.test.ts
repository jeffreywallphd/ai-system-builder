import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../domain/security/CertificateAuthorityDomain";
import { CertificateSubjectProfileKinds } from "../../../domain/security/CertificateIssuancePolicyDomain";
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
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import type {
  CertificateAuthorityProtectedMaterialDescriptor,
  ICertificateAuthorityRootMaterialStorage,
  LoadCertificateAuthorityRootMaterialsInput,
  LoadedCertificateAuthorityProtectedMaterial,
  PersistCertificateAuthorityRootMaterialsInput,
} from "../ports/ICertificateAuthorityRootMaterialStorage";
import type {
  ApprovedNodeCertificateEligibilityDecision,
  ApprovedNodeCertificateEligibilityInput,
  INodeCertificateEligibilityPort,
} from "../ports/INodeCertificateEligibilityPort";
import type {
  InitializeInternalCertificateAuthorityInput,
  InitializeInternalCertificateAuthorityResult,
  IssueCertificateMaterialInput,
  IssueCertificateMaterialResult,
  RevokeCertificateMaterialInput,
  RevokeCertificateMaterialResult,
} from "../ports/ICertificateAuthorityIssuerPort";
import type { CertificateLifecycleAuditEvent, CertificateLifecycleAuditSink } from "../ports/CertificateLifecycleAuditPorts";
import {
  IssuedCertificateRenewalNotAllowedError,
  RenewIssuedCertificateInvalidRequestError,
  RenewIssuedCertificateUseCase,
} from "../use-cases/RenewIssuedCertificateUseCase";
import { CertificateIssuancePolicyViolationError } from "../use-cases/IssueCertificateForSubjectUseCase";

class InMemoryCertificateAuthorityRepository implements ICertificateAuthorityRootPersistenceRepository {
  public authority?: CertificateAuthorityRootPersistenceRecord;

  public async findCertificateAuthorityById(id: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authority?.certificateAuthorityId === id ? this.authority : undefined;
  }

  public async findActiveCertificateAuthority(): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authority?.status === CertificateAuthorityStatuses.active ? this.authority : undefined;
  }

  public async listCertificateAuthorities(
    _query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return this.authority ? [this.authority] : [];
  }

  public async saveCertificateAuthority(
    input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    this.authority = input.record;
    return Object.freeze({ record: input.record, changed: true, wasReplay: false });
  }

  public async updateCertificateAuthorityStatus(
    input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    if (!this.authority) {
      throw new Error("missing authority");
    }

    this.authority = Object.freeze({
      ...this.authority,
      status: input.status,
      retiredAt: input.retiredAt,
      compromisedAt: input.compromisedAt,
    });

    return Object.freeze({ record: this.authority, changed: true, wasReplay: false });
  }

  public async updateCertificateAuthorityRotationPolicy(
    input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    if (!this.authority) {
      throw new Error("missing authority");
    }

    this.authority = Object.freeze({
      ...this.authority,
      rotationPolicy: input.rotationPolicy,
    });

    return Object.freeze({ record: this.authority, changed: true, wasReplay: false });
  }
}

class InMemoryIssuedCertificateRepository implements IIssuedCertificatePersistenceRepository {
  public readonly recordsBySerial = new Map<string, IssuedCertificatePersistenceRecord>();
  public readonly supersedeCalls: SupersedeIssuedCertificatePersistenceRecordInput[] = [];

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.recordsBySerial.get(serialNumber.trim().toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(
    input: {
      readonly kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
      readonly referenceId: string;
      readonly workspaceId?: string;
    },
  ): Promise<IssuedCertificatePersistenceRecord | undefined> {
    const candidates = [...this.recordsBySerial.values()]
      .filter((record) => (
        record.subjectReference.kind === input.kind
        && record.subjectReference.referenceId === input.referenceId
        && record.subjectReference.workspaceId === input.workspaceId
      ))
      .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt));
    return candidates[0];
  }

  public async listIssuedCertificates(
    _query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return [...this.recordsBySerial.values()];
  }

  public async saveIssuedCertificate(
    input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    const serial = input.record.serialNumber.trim().toUpperCase();
    const existing = this.recordsBySerial.get(serial);
    const next = Object.freeze({
      ...input.record,
      serialNumber: serial,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.recordsBySerial.set(serial, next);

    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  public async revokeIssuedCertificate(
    _input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async supersedeIssuedCertificate(
    input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    this.supersedeCalls.push(input);
    const serial = input.serialNumber.trim().toUpperCase();
    const existing = this.recordsBySerial.get(serial);
    if (!existing) {
      throw new Error("certificate not found");
    }

    const next = Object.freeze({
      ...existing,
      status: CertificateStatuses.superseded,
      revocation: undefined,
      supersededBySerialNumber: input.supersededBySerialNumber.trim().toUpperCase(),
      revision: existing.revision + 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? existing.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.recordsBySerial.set(serial, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }
}

class InMemoryTrustMaterialRepository implements ITrustMaterialReferencePersistenceRepository {
  public readonly records = new Map<string, TrustMaterialReferencePersistenceRecord>();

  public async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.records.get(materialRef);
  }

  public async listTrustMaterials(
    _query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.records.values()];
  }

  public async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    this.records.set(input.record.materialRef, input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }
}

class StubCertificateMaterialStorage implements ICertificateAuthorityRootMaterialStorage {
  public async persistRootMaterials(
    input: PersistCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<CertificateAuthorityProtectedMaterialDescriptor>> {
    return input.materials.map((material) => Object.freeze({
      materialRef: material.materialRef,
      kind: material.kind,
      secretRef: material.secretRef ?? `secret-store:${material.materialRef}`,
      secretRefRedacted: "secret-st...acted",
      keyScope: material.keyScope ?? "default",
      source: "test",
    }));
  }

  public async loadRootMaterials(
    _input: LoadCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<LoadedCertificateAuthorityProtectedMaterial>> {
    throw new Error("not implemented");
  }
}

class StubIssuerPort {
  private serialCounter = 0;

  public async initializeInternalCertificateAuthority(
    _input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult> {
    throw new Error("not implemented");
  }

  public async issueCertificateMaterial(input: IssueCertificateMaterialInput): Promise<IssueCertificateMaterialResult> {
    this.serialCounter += 1;
    const serialNumber = this.serialCounter === 1 ? "AABBCC11" : "AABBCC12";
    return Object.freeze({
      certificateAuthorityId: input.certificateAuthorityId,
      serialNumber,
      notBefore: "2026-09-01T00:00:00.000Z",
      notAfter: "2027-09-01T00:00:00.000Z",
      certificatePem: `issued-certificate-pem-${serialNumber}`,
      certificateChainPem: "issued-chain-pem",
      certificateFingerprintSha256: "a".repeat(64),
    });
  }

  public async revokeCertificateMaterial(
    _input: RevokeCertificateMaterialInput,
  ): Promise<RevokeCertificateMaterialResult> {
    throw new Error("not implemented");
  }
}

class StubNodeEligibilityPort implements INodeCertificateEligibilityPort {
  public readonly decisionsByNodeId = new Map<string, ApprovedNodeCertificateEligibilityDecision>();

  public async resolveApprovedNodeCertificateEligibility(
    input: ApprovedNodeCertificateEligibilityInput,
  ): Promise<ApprovedNodeCertificateEligibilityDecision> {
    const decision = this.decisionsByNodeId.get(input.nodeId);
    if (!decision) {
      return Object.freeze({
        eligible: false,
        violations: Object.freeze([`Node '${input.nodeId}' is missing.`]),
      });
    }
    return decision;
  }
}

class CapturingCertificateLifecycleAuditSink implements CertificateLifecycleAuditSink {
  public readonly events: CertificateLifecycleAuditEvent[] = [];

  public async recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("RenewIssuedCertificateUseCase", () => {
  it("issues a replacement certificate and supersedes the previous certificate by default", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    issuedCertificates.recordsBySerial.set("C0FFEE", createNodeIssuedRecord({ serialNumber: "C0FFEE", status: CertificateStatuses.issued }));
    const trustMaterials = new InMemoryTrustMaterialRepository();
    const nodeEligibility = new StubNodeEligibilityPort();
    nodeEligibility.decisionsByNodeId.set("node:compute:1", {
      eligible: true,
      metadata: Object.freeze({
        nodeId: "node:compute:1",
        enrollmentRequestId: "enrollment:node:compute:1",
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["workflow-execution"]),
          supportsRemoteScheduling: true,
        }),
      }),
    });
    const auditSink = new CapturingCertificateLifecycleAuditSink();

    const useCase = new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: trustMaterials,
      certificateMaterialStorage: new StubCertificateMaterialStorage(),
      issuer: new StubIssuerPort(),
      nodeCertificateEligibilityPort: nodeEligibility,
      auditSink,
    });

    const result = await useCase.execute({
      operationKey: "op:cert:renew:1",
      serialNumber: "c0ffee",
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----replacement-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "rsa-4096",
      certificateMaterialRef: "trust:cert:node:1:v2",
      certificateChainMaterialRef: "trust:chain:ca:root:v1",
      occurredAt: "2026-09-01T00:00:00.000Z",
    });

    expect(result.previousSerialNumber).toBe("C0FFEE");
    expect(result.replacementSerialNumber).toBe("AABBCC11");
    expect(result.profileKind).toBe(CertificateSubjectProfileKinds.approvedNode);
    expect(result.previousCertificateDisposition).toBe("supersede");
    expect(issuedCertificates.recordsBySerial.get("C0FFEE")?.status).toBe(CertificateStatuses.superseded);
    expect(issuedCertificates.recordsBySerial.get("C0FFEE")?.supersededBySerialNumber).toBe("AABBCC11");
    expect(issuedCertificates.recordsBySerial.get("AABBCC11")?.subjectReference.referenceId).toBe("node:compute:1");
    expect(auditSink.events.some((event) => event.type === "certificate-renewal-started")).toBe(true);
    expect(auditSink.events.some((event) => event.type === "certificate-renewal-succeeded")).toBe(true);
  });

  it("supports overlap by preserving prior certificate status when requested", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    issuedCertificates.recordsBySerial.set("C0FFEE", createServiceIssuedRecord({ serialNumber: "C0FFEE", status: CertificateStatuses.issued }));

    const useCase = new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: new InMemoryTrustMaterialRepository(),
      certificateMaterialStorage: new StubCertificateMaterialStorage(),
      issuer: new StubIssuerPort(),
    });

    const result = await useCase.execute({
      operationKey: "op:cert:renew:2",
      serialNumber: "C0FFEE",
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----replacement-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "rsa-4096",
      certificateMaterialRef: "trust:cert:service:api:v2",
      certificateChainMaterialRef: "trust:chain:ca:root:v1",
      previousCertificateDisposition: "preserve",
      gracePeriodDays: 14,
      occurredAt: "2026-09-01T00:00:00.000Z",
    });

    expect(result.previousCertificateDisposition).toBe("preserve");
    expect(result.gracePeriodDays).toBe(14);
    expect(issuedCertificates.recordsBySerial.get("C0FFEE")?.status).toBe(CertificateStatuses.issued);
    expect(issuedCertificates.supersedeCalls).toHaveLength(0);
    expect(issuedCertificates.recordsBySerial.has("AABBCC11")).toBe(true);
  });

  it("rejects renewal for revoked certificates", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    issuedCertificates.recordsBySerial.set("DEADBE", createNodeIssuedRecord({ serialNumber: "DEADBE", status: CertificateStatuses.revoked }));

    const useCase = new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: new InMemoryTrustMaterialRepository(),
      certificateMaterialStorage: new StubCertificateMaterialStorage(),
      issuer: new StubIssuerPort(),
    });

    await expect(useCase.execute({
      operationKey: "op:cert:renew:3",
      serialNumber: "DEADBE",
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----replacement-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "rsa-4096",
      certificateMaterialRef: "trust:cert:node:1:v3",
      certificateChainMaterialRef: "trust:chain:ca:root:v1",
      occurredAt: "2026-09-01T00:00:00.000Z",
    })).rejects.toBeInstanceOf(IssuedCertificateRenewalNotAllowedError);
  });

  it("rejects node renewal when node subject is no longer eligible", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    issuedCertificates.recordsBySerial.set("C0FFEE", createNodeIssuedRecord({ serialNumber: "C0FFEE", status: CertificateStatuses.issued }));
    const nodeEligibility = new StubNodeEligibilityPort();
    nodeEligibility.decisionsByNodeId.set("node:compute:1", {
      eligible: false,
      violations: Object.freeze(["Node 'node:compute:1' is revoked and cannot receive a certificate."]),
    });

    const useCase = new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: new InMemoryTrustMaterialRepository(),
      certificateMaterialStorage: new StubCertificateMaterialStorage(),
      issuer: new StubIssuerPort(),
      nodeCertificateEligibilityPort: nodeEligibility,
    });

    await expect(useCase.execute({
      operationKey: "op:cert:renew:4",
      serialNumber: "C0FFEE",
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----replacement-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "rsa-4096",
      certificateMaterialRef: "trust:cert:node:1:v4",
      certificateChainMaterialRef: "trust:chain:ca:root:v1",
      occurredAt: "2026-09-01T00:00:00.000Z",
    })).rejects.toBeInstanceOf(CertificateIssuancePolicyViolationError);

    expect(issuedCertificates.recordsBySerial.has("AABBCC11")).toBe(false);
  });

  it("rejects unsupported overlap input when supersede disposition is requested", async () => {
    const authorities = new InMemoryCertificateAuthorityRepository();
    authorities.authority = createAuthority();
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    issuedCertificates.recordsBySerial.set("C0FFEE", createServiceIssuedRecord({ serialNumber: "C0FFEE", status: CertificateStatuses.issued }));

    const useCase = new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: authorities,
      issuedCertificateRepository: issuedCertificates,
      trustMaterialRepository: new InMemoryTrustMaterialRepository(),
      certificateMaterialStorage: new StubCertificateMaterialStorage(),
      issuer: new StubIssuerPort(),
    });

    await expect(useCase.execute({
      operationKey: "op:cert:renew:5",
      serialNumber: "C0FFEE",
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----replacement-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "rsa-4096",
      certificateMaterialRef: "trust:cert:service:api:v3",
      certificateChainMaterialRef: "trust:chain:ca:root:v1",
      previousCertificateDisposition: "supersede",
      gracePeriodDays: 3,
      occurredAt: "2026-09-01T00:00:00.000Z",
    })).rejects.toBeInstanceOf(RenewIssuedCertificateInvalidRequestError);
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

function createNodeIssuedRecord(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status,
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
    usages: [CertificateUsageKinds.clientAuth, CertificateUsageKinds.nodeEnrollment],
    validity: {
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    },
    issuedAt: "2026-04-05T12:00:00.000Z",
    certificateMaterialRef: "trust:cert:node:1:v1",
    certificateChainMaterialRef: "trust:chain:ca:root:v1",
    trustMaterialRef: "trust:bundle:node:1:v1",
    publicKeyAlgorithm: "rsa-4096",
    revocation: undefined,
    supersededBySerialNumber: undefined,
    createdAt: "2026-04-05T12:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-05T12:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createServiceIssuedRecord(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status,
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
    usages: [CertificateUsageKinds.serviceIdentity],
    validity: {
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    },
    issuedAt: "2026-04-05T12:00:00.000Z",
    certificateMaterialRef: "trust:cert:service:api:v1",
    certificateChainMaterialRef: "trust:chain:ca:root:v1",
    trustMaterialRef: "trust:bundle:service:api:v1",
    publicKeyAlgorithm: "rsa-4096",
    revocation: undefined,
    supersededBySerialNumber: undefined,
    createdAt: "2026-04-05T12:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-05T12:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
