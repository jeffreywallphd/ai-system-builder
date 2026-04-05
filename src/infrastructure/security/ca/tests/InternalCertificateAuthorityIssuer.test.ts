import { describe, expect, it } from "bun:test";
import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { InternalCertificateAuthorityIssuer } from "../InternalCertificateAuthorityIssuer";
import type { ICertificateAuthorityRootPersistenceRepository } from "../../../../application/security/ports/ICertificateAuthorityRootPersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../../../../application/security/ports/ITrustMaterialReferencePersistenceRepository";
import type { ICertificateAuthorityRootMaterialStorage } from "../../../../application/security/ports/ICertificateAuthorityRootMaterialStorage";
import type {
  CertificateAuthorityPersistenceMutationResult,
  CertificateAuthorityRootLookupQuery,
  CertificateAuthorityRootPersistenceRecord,
  SaveCertificateAuthorityRootPersistenceRecordInput,
  SaveTrustMaterialReferencePersistenceRecordInput,
  TrustMaterialReferenceLookupQuery,
  TrustMaterialReferencePersistenceRecord,
  UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  UpdateCertificateAuthorityStatusPersistenceRecordInput,
} from "../../../../shared/dto/security/CertificateAuthorityDtos";
import { CertificateAuthorityStatuses, CertificateUsageKinds } from "../../../../domain/security/CertificateAuthorityDomain";

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
    _input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented in test");
  }

  async updateCertificateAuthorityRotationPolicy(
    _input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented in test");
  }
}

class InMemoryTrustMaterialRepository implements ITrustMaterialReferencePersistenceRepository {
  public readonly byRef = new Map<string, TrustMaterialReferencePersistenceRecord>();

  async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.byRef.get(materialRef);
  }

  async listTrustMaterials(_query: TrustMaterialReferenceLookupQuery): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.byRef.values()];
  }

  async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    this.byRef.set(input.record.materialRef, input.record);
    return {
      record: input.record,
      changed: true,
      wasReplay: false,
    };
  }
}

class InMemoryRootMaterialStorage implements ICertificateAuthorityRootMaterialStorage {
  public readonly byRef = new Map<string, {
    readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
    readonly plaintextValue: string;
    readonly secretRef: string;
    readonly keyScope: string;
  }>();

  async persistRootMaterials(input: {
    readonly certificateAuthorityId: string;
    readonly actorUserIdentityId: string;
    readonly reason?: string;
    readonly materials: ReadonlyArray<{
      readonly materialRef: string;
      readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
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
      const secretRef = material.secretRef ?? `secret-store:ca:${material.materialRef}`;
      const keyScope = material.keyScope ?? "default";
      this.byRef.set(material.materialRef, {
        kind: material.kind,
        plaintextValue: material.plaintextValue,
        secretRef,
        keyScope,
      });
      return {
        materialRef: material.materialRef,
        kind: material.kind,
        secretRef,
        secretRefRedacted: "secret-st...acted",
        keyScope,
        source: "in-memory-test",
      };
    });
  }

  async loadRootMaterials(input: {
    readonly certificateAuthorityId: string;
    readonly reason?: string;
    readonly materials: ReadonlyArray<{
      readonly materialRef: string;
      readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
      readonly secretRef: string;
      readonly keyScope?: string;
    }>;
  }): Promise<ReadonlyArray<{
    readonly materialRef: string;
    readonly kind: "certificate-pem" | "certificate-chain-pem" | "private-key-encrypted-pem" | "crl-pem";
    readonly plaintextValue: string;
  }>> {
    return input.materials.map((material) => {
      const loaded = this.byRef.get(material.materialRef);
      if (!loaded) {
        throw new Error(`missing material '${material.materialRef}'`);
      }
      if (loaded.secretRef !== material.secretRef) {
        throw new Error(`unexpected secretRef for '${material.materialRef}'`);
      }
      return {
        materialRef: material.materialRef,
        kind: material.kind,
        plaintextValue: loaded.plaintextValue,
      };
    });
  }
}

describe("InternalCertificateAuthorityIssuer", () => {
  it("initializes a root CA and issues signed certificates from persisted root material", async () => {
    const certificateAuthorityRepository = new InMemoryCertificateAuthorityRepository();
    const trustMaterialRepository = new InMemoryTrustMaterialRepository();
    const rootMaterialStorage = new InMemoryRootMaterialStorage();
    const issuer = new InternalCertificateAuthorityIssuer({
      certificateAuthorityRepository,
      trustMaterialRepository,
      rootMaterialStorage,
    });

    const initialized = await issuer.initializeInternalCertificateAuthority({
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        organization: "AI Loom",
        dnsNames: ["ca.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:security-admin",
    });

    const persisted = await rootMaterialStorage.persistRootMaterials({
      certificateAuthorityId: initialized.certificateAuthorityId,
      actorUserIdentityId: "user:security-admin",
      materials: [
        {
          materialRef: "trust:ca:cert:v1",
          kind: "certificate-pem",
          plaintextValue: initialized.rootCertificatePem,
        },
        {
          materialRef: "trust:ca:key:v1",
          kind: "private-key-encrypted-pem",
          plaintextValue: initialized.encryptedRootPrivateKeyPem,
        },
      ],
    });

    await trustMaterialRepository.saveTrustMaterial({
      mutation: {
        operationKey: "op:save-root-cert",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
      record: {
        materialRef: "trust:ca:cert:v1",
        kind: "certificate-pem",
        storageLocator: persisted[0]!.secretRef,
        fingerprintSha256: initialized.rootCertificateFingerprintSha256,
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
    });

    await trustMaterialRepository.saveTrustMaterial({
      mutation: {
        operationKey: "op:save-root-key",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
      record: {
        materialRef: "trust:ca:key:v1",
        kind: "private-key-encrypted-pem",
        storageLocator: persisted[1]!.secretRef,
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
    });

    await certificateAuthorityRepository.saveCertificateAuthority({
      mutation: {
        operationKey: "op:save-ca",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
      record: {
        certificateAuthorityId: initialized.certificateAuthorityId,
        displayName: "AI Loom Internal Root",
        status: CertificateAuthorityStatuses.active,
        subject: {
          commonName: "AI Loom Internal Root CA",
          organization: "AI Loom",
          dnsNames: ["ca.ai-loom.internal"],
          ipAddresses: [],
          uriSanEntries: [],
        },
        serialNumber: initialized.serialNumber,
        validity: {
          notBefore: initialized.notBefore,
          notAfter: initialized.notAfter,
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
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
    });

    const subjectKeyPair = generateKeyPairSync("ed25519");
    const subjectPublicKeyPem = subjectKeyPair.publicKey.export({ format: "pem", type: "spki" }).toString();
    const issued = await issuer.issueCertificateMaterial({
      certificateAuthorityId: "ca:internal:root:v1",
      subject: {
        commonName: "node-1.ai-loom.internal",
        dnsNames: ["node-1.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: ["spiffe://ai-loom.internal/node/node:compute:1"],
      },
      subjectReference: {
        kind: "node",
        referenceId: "node:compute:1",
      },
      usages: [
        CertificateUsageKinds.clientAuth,
        CertificateUsageKinds.nodeEnrollment,
      ],
      validityDays: 90,
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: subjectPublicKeyPem,
    });

    const rootX509 = new X509Certificate(initialized.rootCertificatePem);
    const issuedX509 = new X509Certificate(issued.certificatePem);

    expect(initialized.serialNumber).toMatch(/^[0-9A-F]{2,64}$/);
    expect(initialized.rootCertificateFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.serialNumber).toMatch(/^[0-9A-F]{2,64}$/);
    expect(issued.certificateFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(issuedX509.issuer).toContain("CN=AI Loom Internal Root CA");
    expect(issuedX509.subject).toContain("CN=node-1.ai-loom.internal");
    expect(issued.certificateChainPem).toContain("BEGIN CERTIFICATE");
    expect(rootX509.subject).toContain("CN=AI Loom Internal Root CA");
  });

  it("fails issuance when CA metadata or root trust material prerequisites are missing", async () => {
    const certificateAuthorityRepository = new InMemoryCertificateAuthorityRepository();
    const trustMaterialRepository = new InMemoryTrustMaterialRepository();
    const rootMaterialStorage = new InMemoryRootMaterialStorage();
    const issuer = new InternalCertificateAuthorityIssuer({
      certificateAuthorityRepository,
      trustMaterialRepository,
      rootMaterialStorage,
    });

    const subjectKeyPair = generateKeyPairSync("ed25519");
    const subjectPublicKeyPem = subjectKeyPair.publicKey.export({ format: "pem", type: "spki" }).toString();

    await expect(issuer.issueCertificateMaterial({
      certificateAuthorityId: "ca:missing",
      subject: {
        commonName: "node-1.ai-loom.internal",
        dnsNames: ["node-1.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: "node",
        referenceId: "node:compute:1",
      },
      usages: [CertificateUsageKinds.clientAuth],
      validityDays: 30,
      actorUserIdentityId: "user:security-admin",
      publicKeyPem: subjectPublicKeyPem,
    })).rejects.toThrow("was not found");
  });
});
