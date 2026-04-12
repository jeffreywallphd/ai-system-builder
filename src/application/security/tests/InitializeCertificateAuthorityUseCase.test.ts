import { describe, expect, it } from "bun:test";
import { CertificateAuthorityStatuses } from "@domain/security/CertificateAuthorityDomain";
import type { InitializeInternalCertificateAuthorityInput, InitializeInternalCertificateAuthorityResult } from "../ports/ICertificateAuthorityIssuerPort";
import type {
  CertificateAuthorityProtectedMaterialDescriptor,
  PersistCertificateAuthorityRootMaterialsInput,
} from "../ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import {
  CertificateAuthorityInitializationConflictError,
  CertificateAuthorityInitializationConflictPolicies,
  CertificateAuthorityInitializationOutcomes,
  InitializeCertificateAuthorityUseCase,
} from "../use-cases/InitializeCertificateAuthorityUseCase";
import type { CertificateLifecycleAuditEvent, CertificateLifecycleAuditSink } from "../ports/CertificateLifecycleAuditPorts";
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
} from "@shared/dto/security/CertificateAuthorityDtos";

class InMemoryCertificateAuthorityRepositories
  implements ICertificateAuthorityRootPersistenceRepository, ITrustMaterialReferencePersistenceRepository {
  private readonly authoritiesById = new Map<string, CertificateAuthorityRootPersistenceRecord>();
  private readonly trustMaterialsByRef = new Map<string, TrustMaterialReferencePersistenceRecord>();

  public async findCertificateAuthorityById(id: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authoritiesById.get(id);
  }

  public async findActiveCertificateAuthority(): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return [...this.authoritiesById.values()].find((authority) => authority.status === CertificateAuthorityStatuses.active);
  }

  public async listCertificateAuthorities(
    query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return [...this.authoritiesById.values()].filter((authority) => {
      if (query.statuses?.length && !query.statuses.includes(authority.status)) {
        return false;
      }
      if (!(query.includeRetired ?? false) && authority.status === CertificateAuthorityStatuses.retired) {
        return false;
      }
      if (!(query.includeCompromised ?? false) && authority.status === CertificateAuthorityStatuses.compromised) {
        return false;
      }
      return true;
    });
  }

  public async saveCertificateAuthority(
    input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = this.authoritiesById.get(input.record.certificateAuthorityId);
    const record = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      createdAt: existing?.createdAt ?? input.record.createdAt,
      createdBy: existing?.createdBy ?? input.record.createdBy,
    });
    this.authoritiesById.set(record.certificateAuthorityId, record);
    return Object.freeze({
      record,
      changed: true,
      wasReplay: false,
    });
  }

  public async updateCertificateAuthorityStatus(
    input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = this.authoritiesById.get(input.certificateAuthorityId);
    if (!existing) {
      throw new Error("missing authority");
    }
    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        status: input.status,
        retiredAt: input.retiredAt,
        compromisedAt: input.compromisedAt,
      },
    });
  }

  public async updateCertificateAuthorityRotationPolicy(
    input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = this.authoritiesById.get(input.certificateAuthorityId);
    if (!existing) {
      throw new Error("missing authority");
    }
    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        rotationPolicy: input.rotationPolicy,
      },
    });
  }

  public async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.trustMaterialsByRef.get(materialRef);
  }

  public async listTrustMaterials(
    _query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.trustMaterialsByRef.values()];
  }

  public async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    const existing = this.trustMaterialsByRef.get(input.record.materialRef);
    const record = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      createdAt: existing?.createdAt ?? input.record.createdAt,
      createdBy: existing?.createdBy ?? input.record.createdBy,
    });
    this.trustMaterialsByRef.set(record.materialRef, record);
    return Object.freeze({
      record,
      changed: true,
      wasReplay: false,
    });
  }
}

class StubCertificateAuthorityIssuerPort {
  public initializeCalls = 0;
  public lastInput?: InitializeInternalCertificateAuthorityInput;

  public async initializeInternalCertificateAuthority(
    input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult> {
    this.initializeCalls += 1;
    this.lastInput = input;
    return Object.freeze({
      certificateAuthorityId: input.certificateAuthorityId,
      serialNumber: "AABBCCDD",
      notBefore: "2026-04-05T00:00:00.000Z",
      notAfter: "2036-04-05T00:00:00.000Z",
      rootCertificatePem: "-----BEGIN CERTIFICATE-----root-cert-----END CERTIFICATE-----",
      encryptedRootPrivateKeyPem: "-----BEGIN ENCRYPTED PRIVATE KEY-----root-key-----END ENCRYPTED PRIVATE KEY-----",
      rootCertificateFingerprintSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  }

  public async issueCertificateMaterial(): Promise<never> {
    throw new Error("not implemented in test");
  }

  public async revokeCertificateMaterial(): Promise<never> {
    throw new Error("not implemented in test");
  }
}

class StubRootMaterialStorage {
  public persistCalls = 0;
  public lastInput?: PersistCertificateAuthorityRootMaterialsInput;

  public async persistRootMaterials(
    input: PersistCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<CertificateAuthorityProtectedMaterialDescriptor>> {
    this.persistCalls += 1;
    this.lastInput = input;
    return Object.freeze(input.materials.map((material) => Object.freeze({
      materialRef: material.materialRef,
      kind: material.kind,
      secretRef: material.secretRef ?? `secret-store:${material.materialRef}`,
      secretRefRedacted: "[redacted]",
      keyScope: material.keyScope ?? "default",
      source: "test-secret-store",
    })));
  }

  public async loadRootMaterials(): Promise<ReadonlyArray<never>> {
    throw new Error("not implemented in test");
  }
}

class CapturingCertificateLifecycleAuditSink implements CertificateLifecycleAuditSink {
  public readonly events: CertificateLifecycleAuditEvent[] = [];

  public async recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("InitializeCertificateAuthorityUseCase", () => {
  it("initializes internal CA metadata and protected material references in a clean environment", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    const issuer = new StubCertificateAuthorityIssuerPort();
    const materialStorage = new StubRootMaterialStorage();
    const auditEvents: string[] = [];
    const useCase = new InitializeCertificateAuthorityUseCase({
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
      rootMaterialStorage: materialStorage,
      issuer,
      auditHook: (event) => {
        auditEvents.push(event.event);
      },
    });

    const result = await useCase.execute({
      operationKey: "initialize-ca-root-v1",
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:admin",
      rootCertificateMaterialRef: "trust:ca:cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:key:v1",
      rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
      rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
      occurredAt: "2026-04-05T00:00:00.000Z",
    });

    const authority = await repositories.findCertificateAuthorityById("ca:internal:root:v1");
    const rootCertTrustMaterial = await repositories.findTrustMaterialByRef("trust:ca:cert:v1");
    const rootKeyTrustMaterial = await repositories.findTrustMaterialByRef("trust:ca:key:v1");

    expect(result.outcome).toBe(CertificateAuthorityInitializationOutcomes.initialized);
    expect(issuer.initializeCalls).toBe(1);
    expect(materialStorage.persistCalls).toBe(1);
    expect(authority?.status).toBe(CertificateAuthorityStatuses.active);
    expect(authority?.rootCertificateMaterialRef).toBe("trust:ca:cert:v1");
    expect(rootCertTrustMaterial?.storageLocator).toBe("secret-store:internal-ca:root-cert");
    expect(rootKeyTrustMaterial?.storageLocator).toBe("secret-store:internal-ca:root-key");
    expect(auditEvents).toEqual([
      "ca-initialize-started",
      "ca-initialize-succeeded",
    ]);
  });

  it("emits lifecycle audit sink events for initialization operations", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    const issuer = new StubCertificateAuthorityIssuerPort();
    const materialStorage = new StubRootMaterialStorage();
    const auditSink = new CapturingCertificateLifecycleAuditSink();
    const useCase = new InitializeCertificateAuthorityUseCase({
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
      rootMaterialStorage: materialStorage,
      issuer,
      auditSink,
    });

    await useCase.execute({
      operationKey: "initialize-ca-root-v1",
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:admin",
      rootCertificateMaterialRef: "trust:ca:cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:key:v1",
      rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
      rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
      occurredAt: "2026-04-05T00:00:00.000Z",
    });

    expect(auditSink.events.map((event) => event.type)).toEqual([
      "ca-initialize-started",
      "ca-initialize-succeeded",
    ]);
    expect((auditSink.events[1]?.details as Record<string, unknown>)?.rootPrivateKeySecretRef).toBe("[REDACTED]");
  });

  it("blocks repeated initialization when active root CA already exists by default", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    await repositories.saveCertificateAuthority({
      mutation: {
        operationKey: "seed",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createAuthorityRecord(CertificateAuthorityStatuses.active),
    });
    await repositories.saveTrustMaterial({
      mutation: {
        operationKey: "seed-trust-cert",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createTrustMaterial({
        materialRef: "trust:ca:cert:v1",
        kind: "certificate-pem",
        storageLocator: "secret-store:internal-ca:root-cert",
      }),
    });
    await repositories.saveTrustMaterial({
      mutation: {
        operationKey: "seed-trust-key",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createTrustMaterial({
        materialRef: "trust:ca:key:v1",
        kind: "private-key-encrypted-pem",
        storageLocator: "secret-store:internal-ca:root-key",
      }),
    });
    const useCase = new InitializeCertificateAuthorityUseCase({
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
      rootMaterialStorage: new StubRootMaterialStorage(),
      issuer: new StubCertificateAuthorityIssuerPort(),
    });

    await expect(useCase.execute({
      operationKey: "initialize-ca-root-v1",
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:admin",
      rootCertificateMaterialRef: "trust:ca:cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    })).rejects.toBeInstanceOf(CertificateAuthorityInitializationConflictError);
  });

  it("returns existing authority metadata safely when return-existing conflict policy is selected", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    await repositories.saveCertificateAuthority({
      mutation: {
        operationKey: "seed",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createAuthorityRecord(CertificateAuthorityStatuses.active),
    });
    await repositories.saveTrustMaterial({
      mutation: {
        operationKey: "seed-trust-cert",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createTrustMaterial({
        materialRef: "trust:ca:cert:v1",
        kind: "certificate-pem",
        storageLocator: "secret-store:internal-ca:root-cert",
      }),
    });
    await repositories.saveTrustMaterial({
      mutation: {
        operationKey: "seed-trust-key",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T00:00:00.000Z",
        },
      },
      record: createTrustMaterial({
        materialRef: "trust:ca:key:v1",
        kind: "private-key-encrypted-pem",
        storageLocator: "secret-store:internal-ca:root-key",
      }),
    });
    const useCase = new InitializeCertificateAuthorityUseCase({
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
      rootMaterialStorage: new StubRootMaterialStorage(),
      issuer: new StubCertificateAuthorityIssuerPort(),
    });

    const result = await useCase.execute({
      operationKey: "initialize-ca-root-v1",
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:admin",
      rootCertificateMaterialRef: "trust:ca:cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:key:v1",
      conflictPolicy: CertificateAuthorityInitializationConflictPolicies.returnExisting,
    });

    expect(result.outcome).toBe(CertificateAuthorityInitializationOutcomes.alreadyInitialized);
    expect(result.rootCertificateSecretRef).toBe("secret-store:internal-ca:root-cert");
    expect(result.rootPrivateKeySecretRef).toBe("secret-store:internal-ca:root-key");
  });
});

function createAuthorityRecord(
  status: CertificateAuthorityRootPersistenceRecord["status"],
): CertificateAuthorityRootPersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    displayName: "AI Loom Internal Root",
    status,
    subject: {
      commonName: "AI Loom Internal Root CA",
      dnsNames: [],
      ipAddresses: [],
      uriSanEntries: [],
    },
    serialNumber: "A1B2C3",
    validity: {
      notBefore: "2026-04-05T00:00:00.000Z",
      notAfter: "2036-04-05T00:00:00.000Z",
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
    createdAt: "2026-04-05T00:00:00.000Z",
    createdBy: "system-bootstrap",
    lastModifiedAt: "2026-04-05T00:00:00.000Z",
    lastModifiedBy: "system-bootstrap",
    revision: 1,
  });
}

function createTrustMaterial(
  input: {
    readonly materialRef: string;
    readonly kind: TrustMaterialReferencePersistenceRecord["kind"];
    readonly storageLocator: string;
  },
): TrustMaterialReferencePersistenceRecord {
  return Object.freeze({
    materialRef: input.materialRef,
    kind: input.kind,
    storageLocator: input.storageLocator,
    fingerprintSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: "2026-04-05T00:00:00.000Z",
    createdBy: "system-bootstrap",
    lastModifiedAt: "2026-04-05T00:00:00.000Z",
    lastModifiedBy: "system-bootstrap",
    revision: 1,
  });
}

