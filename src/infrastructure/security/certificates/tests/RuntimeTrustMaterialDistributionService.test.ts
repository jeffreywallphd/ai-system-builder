import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "@domain/security/CertificateAuthorityDomain";
import type {
  ICertificateAuthorityRootMaterialStorage,
  LoadCertificateAuthorityRootMaterialsInput,
  LoadedCertificateAuthorityProtectedMaterial,
  PersistCertificateAuthorityRootMaterialsInput,
  CertificateAuthorityProtectedMaterialDescriptor,
} from "@application/security/ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityRootPersistenceRepository } from "@application/security/ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateLifecycleEventPersistenceRepository } from "@application/security/ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "@application/security/ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "@application/security/ports/ITrustMaterialReferencePersistenceRepository";
import type {
  CertificateAuthorityPersistenceMutationResult,
  CertificateAuthorityRootLookupQuery,
  CertificateAuthorityRootPersistenceRecord,
  AppendCertificateStatusHistoryPersistenceRecordInput,
  CertificateDistributionEventLookupQuery,
  CertificateDistributionEventPersistenceRecord,
  CertificateRevocationHistoryLookupQuery,
  CertificateRevocationHistoryPersistenceRecord,
  CertificateStatusHistoryLookupQuery,
  CertificateStatusHistoryPersistenceRecord,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveCertificateAuthorityRootPersistenceRecordInput,
  SaveCertificateDistributionEventPersistenceRecordInput,
  SaveCertificateRevocationHistoryPersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SaveTrustMaterialReferencePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
  TrustMaterialReferenceLookupQuery,
  TrustMaterialReferencePersistenceRecord,
  UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  UpdateCertificateAuthorityStatusPersistenceRecordInput,
} from "@shared/dto/security/CertificateAuthorityDtos";
import { RuntimeTrustMaterialDistributionService } from "../RuntimeTrustMaterialDistributionService";

class InMemoryCertificateAuthorityRepository implements ICertificateAuthorityRootPersistenceRepository {
  public readonly byId = new Map<string, CertificateAuthorityRootPersistenceRecord>();

  public async findCertificateAuthorityById(id: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.byId.get(id);
  }

  public async findActiveCertificateAuthority(): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return [...this.byId.values()].find((record) => record.status === CertificateAuthorityStatuses.active);
  }

  public async listCertificateAuthorities(
    _query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return [...this.byId.values()];
  }

  public async saveCertificateAuthority(
    _input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async updateCertificateAuthorityStatus(
    _input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async updateCertificateAuthorityRotationPolicy(
    _input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented");
  }
}

class InMemoryIssuedCertificateRepository implements IIssuedCertificatePersistenceRepository {
  public readonly bySerial = new Map<string, IssuedCertificatePersistenceRecord>();

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.bySerial.get(serialNumber.trim().toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(input: {
    readonly kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
    readonly referenceId: string;
    readonly workspaceId?: string;
  }): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return [...this.bySerial.values()]
      .filter((record) => (
        record.subjectReference.kind === input.kind
        && record.subjectReference.referenceId === input.referenceId
        && record.subjectReference.workspaceId === input.workspaceId
      ))
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0];
  }

  public async listIssuedCertificates(
    _query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return [...this.bySerial.values()];
  }

  public async saveIssuedCertificate(
    _input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async revokeIssuedCertificate(
    _input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async supersedeIssuedCertificate(
    _input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented");
  }
}

class InMemoryTrustMaterialReferenceRepository implements ITrustMaterialReferencePersistenceRepository {
  public readonly byRef = new Map<string, TrustMaterialReferencePersistenceRecord>();

  public async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.byRef.get(materialRef);
  }

  public async listTrustMaterials(
    _query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.byRef.values()];
  }

  public async saveTrustMaterial(
    _input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    throw new Error("not implemented");
  }
}

class InMemoryLifecycleEventsRepository implements ICertificateLifecycleEventPersistenceRepository {
  public readonly distributionEvents: CertificateDistributionEventPersistenceRecord[] = [];

  public async findLatestStatusEventBySerialNumber(
    _serialNumber: string,
  ): Promise<CertificateStatusHistoryPersistenceRecord | undefined> {
    return undefined;
  }

  public async listCertificateStatusHistory(
    _query: CertificateStatusHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateStatusHistoryPersistenceRecord>> {
    return [];
  }

  public async appendCertificateStatusHistory(
    _input: AppendCertificateStatusHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateStatusHistoryPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async findLatestCertificateRevocationBySerialNumber(
    _serialNumber: string,
  ): Promise<CertificateRevocationHistoryPersistenceRecord | undefined> {
    return undefined;
  }

  public async listCertificateRevocations(
    _query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>> {
    return [];
  }

  public async saveCertificateRevocation(
    _input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async listCertificateDistributionEvents(
    _query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>> {
    return this.distributionEvents;
  }

  public async saveCertificateDistributionEvent(
    input: SaveCertificateDistributionEventPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateDistributionEventPersistenceRecord>> {
    this.distributionEvents.push(input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }
}

class InMemoryMaterialStorage implements ICertificateAuthorityRootMaterialStorage {
  public readonly materials = new Map<string, string>();

  public async persistRootMaterials(
    _input: PersistCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<CertificateAuthorityProtectedMaterialDescriptor>> {
    throw new Error("not implemented");
  }

  public async loadRootMaterials(
    input: LoadCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<LoadedCertificateAuthorityProtectedMaterial>> {
    return input.materials.map((material) => {
      const value = this.materials.get(material.materialRef);
      if (!value) {
        throw new Error(`missing material:${material.materialRef}`);
      }
      return Object.freeze({
        materialRef: material.materialRef,
        kind: material.kind,
        plaintextValue: value,
      });
    });
  }
}

describe("RuntimeTrustMaterialDistributionService", () => {
  it("returns scoped runtime trust package material for allowed node consumers", async () => {
    const certificateAuthorityRepository = new InMemoryCertificateAuthorityRepository();
    const issuedCertificateRepository = new InMemoryIssuedCertificateRepository();
    const trustMaterialReferenceRepository = new InMemoryTrustMaterialReferenceRepository();
    const certificateLifecycleEventRepository = new InMemoryLifecycleEventsRepository();
    const certificateMaterialStorage = new InMemoryMaterialStorage();

    certificateAuthorityRepository.byId.set("ca:internal:root:v1", createAuthorityRecord());
    issuedCertificateRepository.bySerial.set("AA11", createIssuedCertificateRecord({
      serialNumber: "AA11",
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      subjectReferenceId: "node:alpha",
    }));

    trustMaterialReferenceRepository.byRef.set("trust:cert:node:alpha:v1", createTrustMaterialRecord({
      materialRef: "trust:cert:node:alpha:v1",
      kind: "certificate-pem",
      storageLocator: "secret-store:node-alpha-cert",
    }));
    trustMaterialReferenceRepository.byRef.set("trust:chain:node:alpha:v1", createTrustMaterialRecord({
      materialRef: "trust:chain:node:alpha:v1",
      kind: "certificate-chain-pem",
      storageLocator: "secret-store:node-alpha-chain",
    }));
    trustMaterialReferenceRepository.byRef.set("trust:ca:root:cert:v1", createTrustMaterialRecord({
      materialRef: "trust:ca:root:cert:v1",
      kind: "certificate-pem",
      storageLocator: "secret-store:ca-root-cert",
    }));

    certificateMaterialStorage.materials.set(
      "trust:cert:node:alpha:v1",
      "-----BEGIN CERTIFICATE-----leaf-----END CERTIFICATE-----\n",
    );
    certificateMaterialStorage.materials.set(
      "trust:chain:node:alpha:v1",
      "-----BEGIN CERTIFICATE-----chain-----END CERTIFICATE-----\n",
    );
    certificateMaterialStorage.materials.set(
      "trust:ca:root:cert:v1",
      "-----BEGIN CERTIFICATE-----root-----END CERTIFICATE-----\n",
    );

    const service = new RuntimeTrustMaterialDistributionService({
      certificateAuthorityRepository,
      issuedCertificateRepository,
      trustMaterialReferenceRepository,
      certificateMaterialStorage,
      certificateLifecycleEventRepository,
    });

    const result = await service.resolveRuntimeTrustMaterialPackage({
      operationKey: "runtime-package-op-1",
      actorUserIdentityId: "user:runtime-node-agent",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      workspaceId: "workspace:alpha",
      includeProtectedReferences: true,
      occurredAt: "2026-04-05T01:00:00.000Z",
    });

    expect(result).toBeDefined();
    expect(result?.targetReferenceId).toBe("node:alpha");
    expect(result?.leafCertificatePem).toContain("BEGIN CERTIFICATE");
    expect(result?.certificateChainPem).toContain("chain");
    expect(result?.trustBundlePem).toContain("root");
    expect(result?.protectedReferences).toHaveLength(3);
    expect(result?.protectedReferences[0]?.accessRef.startsWith("secret-store:")).toBeTrue();
    expect(result?.protectedReferences[0]?.accessRefRedacted).not.toBe(result?.protectedReferences[0]?.accessRef);
    expect(certificateLifecycleEventRepository.distributionEvents).toHaveLength(1);
    expect(certificateLifecycleEventRepository.distributionEvents[0]?.targetKind).toBe("node");
  });

  it("returns undefined when serial-scoped certificate does not match requested target scope", async () => {
    const certificateAuthorityRepository = new InMemoryCertificateAuthorityRepository();
    const issuedCertificateRepository = new InMemoryIssuedCertificateRepository();
    const trustMaterialReferenceRepository = new InMemoryTrustMaterialReferenceRepository();
    const certificateMaterialStorage = new InMemoryMaterialStorage();

    certificateAuthorityRepository.byId.set("ca:internal:root:v1", createAuthorityRecord());
    issuedCertificateRepository.bySerial.set("CC33", createIssuedCertificateRecord({
      serialNumber: "CC33",
      subjectReferenceKind: CertificateSubjectReferenceKinds.service,
      subjectReferenceId: "service:authoritative",
    }));

    const service = new RuntimeTrustMaterialDistributionService({
      certificateAuthorityRepository,
      issuedCertificateRepository,
      trustMaterialReferenceRepository,
      certificateMaterialStorage,
    });

    const result = await service.resolveRuntimeTrustMaterialPackage({
      operationKey: "runtime-package-op-2",
      actorUserIdentityId: "user:runtime-node-agent",
      targetKind: "node",
      targetReferenceId: "node:alpha",
      serialNumber: "CC33",
      includeLeafCertificate: true,
      includeCertificateChain: true,
      includeTrustBundle: false,
      includeProtectedReferences: false,
      occurredAt: "2026-04-05T01:00:00.000Z",
    });

    expect(result).toBeUndefined();
  });
});

function createAuthorityRecord(): CertificateAuthorityRootPersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    displayName: "AI Loom Internal Root",
    status: CertificateAuthorityStatuses.active,
    subject: {
      commonName: "AI Loom Root",
      dnsNames: ["ca.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: [],
    },
    serialNumber: "AABBCC",
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2036-01-01T00:00:00.000Z",
    },
    signatureAlgorithm: "sha256WithRSAEncryption",
    rootCertificateMaterialRef: "trust:ca:root:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:root:key:v1",
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

function createIssuedCertificateRecord(input: {
  readonly serialNumber: string;
  readonly subjectReferenceKind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
  readonly subjectReferenceId: string;
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: CertificateStatuses.issued,
    subject: {
      commonName: `${input.subjectReferenceId}.ai-loom.internal`,
      dnsNames: [`${input.subjectReferenceId}.ai-loom.internal`],
      ipAddresses: [],
      uriSanEntries: [],
    },
    subjectReference: {
      kind: input.subjectReferenceKind,
      referenceId: input.subjectReferenceId,
      workspaceId: "workspace:alpha",
    },
    usages: [CertificateUsageKinds.serverAuth],
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2027-01-01T00:00:00.000Z",
    },
    issuedAt: "2026-01-02T00:00:00.000Z",
    certificateMaterialRef: input.subjectReferenceKind === CertificateSubjectReferenceKinds.node
      ? "trust:cert:node:alpha:v1"
      : "trust:cert:service:authoritative:v1",
    certificateChainMaterialRef: input.subjectReferenceKind === CertificateSubjectReferenceKinds.node
      ? "trust:chain:node:alpha:v1"
      : "trust:chain:service:authoritative:v1",
    trustMaterialRef: undefined,
    publicKeyAlgorithm: "rsa-4096",
    publicKeyFingerprintSha256: "sha256:abc123",
    revocation: undefined,
    supersededBySerialNumber: undefined,
    createdAt: "2026-01-02T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-01-02T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createTrustMaterialRecord(input: {
  readonly materialRef: string;
  readonly kind: TrustMaterialReferencePersistenceRecord["kind"];
  readonly storageLocator: string;
}): TrustMaterialReferencePersistenceRecord {
  return Object.freeze({
    materialRef: input.materialRef,
    kind: input.kind,
    storageLocator: input.storageLocator,
    fingerprintSha256: "sha256:record",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

