import { describe, expect, it } from "bun:test";
import { CertificateAuthorityStatuses, CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import type { CertificateAuthorityBootstrapConfiguration } from "../ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type { CertificateAuthoritySecretMetadata } from "../ports/ICertificateAuthorityBootstrapSecretService";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import { ResolveCertificateAuthorityStartupStateUseCase } from "../use-cases/ResolveCertificateAuthorityStartupStateUseCase";
import { GetCertificateAuthorityStatusIntrospectionUseCase } from "../use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import { parseCertificateAuthorityStatusIntrospectionView } from "../../../shared/schemas/security/CertificateAuthoritySchemaContracts";
import type {
  AppendCertificateStatusHistoryPersistenceRecordInput,
  CertificateAuthorityPersistenceMutationResult,
  CertificateAuthorityRootLookupQuery,
  CertificateAuthorityRootPersistenceRecord,
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
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import { CertificateDistributionEventStatuses, CertificateDistributionTargetKinds } from "../../../shared/dto/security/CertificateAuthorityDtos";

class StubConfigurationProvider {
  public constructor(private readonly configuration: CertificateAuthorityBootstrapConfiguration) {}

  public async loadConfiguration(): Promise<CertificateAuthorityBootstrapConfiguration> {
    return this.configuration;
  }
}

class StubSecretService {
  private readonly refs = new Map<string, CertificateAuthoritySecretMetadata>();

  public setSecret(secretRef: string, exists: boolean): void {
    this.refs.set(secretRef, Object.freeze({
      secretRef,
      exists,
      source: "test",
    }));
  }

  public async getSecretMetadata(secretRef: string): Promise<CertificateAuthoritySecretMetadata> {
    return this.refs.get(secretRef) ?? Object.freeze({
      secretRef,
      exists: false,
      source: "test",
    });
  }
}

class InMemorySecurityQueryRepositories
  implements
    ICertificateAuthorityRootPersistenceRepository,
    IIssuedCertificatePersistenceRepository,
    ITrustMaterialReferencePersistenceRepository,
    ICertificateLifecycleEventPersistenceRepository {
  public readonly authorities = new Map<string, CertificateAuthorityRootPersistenceRecord>();
  public readonly issuedCertificates = new Map<string, IssuedCertificatePersistenceRecord>();
  public readonly trustMaterials = new Map<string, TrustMaterialReferencePersistenceRecord>();
  public readonly distributionEvents = new Map<string, CertificateDistributionEventPersistenceRecord>();

  public async findCertificateAuthorityById(
    certificateAuthorityId: string,
  ): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.authorities.get(certificateAuthorityId);
  }

  public async findActiveCertificateAuthority(
    asOf?: string,
  ): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    const cursor = asOf ?? new Date().toISOString();
    return [...this.authorities.values()].find((authority) => (
      authority.status === CertificateAuthorityStatuses.active
      && authority.validity.notBefore <= cursor
      && authority.validity.notAfter > cursor
    ));
  }

  public async listCertificateAuthorities(
    query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return [...this.authorities.values()].filter((authority) => {
      if (query.statuses?.length && !query.statuses.includes(authority.status)) {
        return false;
      }
      if (!(query.includeRetired ?? false) && authority.status === CertificateAuthorityStatuses.retired) {
        return false;
      }
      if (!(query.includeCompromised ?? false) && authority.status === CertificateAuthorityStatuses.compromised) {
        return false;
      }
      if (query.activeAt) {
        return authority.validity.notBefore <= query.activeAt && authority.validity.notAfter > query.activeAt;
      }
      return true;
    });
  }

  public async saveCertificateAuthority(
    input: SaveCertificateAuthorityRootPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    this.authorities.set(input.record.certificateAuthorityId, input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }

  public async updateCertificateAuthorityStatus(
    _input: UpdateCertificateAuthorityStatusPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async updateCertificateAuthorityRotationPolicy(
    _input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.issuedCertificates.get(serialNumber.toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(): Promise<IssuedCertificatePersistenceRecord | undefined> {
    throw new Error("not implemented for test");
  }

  public async listIssuedCertificates(
    query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return [...this.issuedCertificates.values()].filter((certificate) => {
      if (query.certificateAuthorityId && certificate.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.statuses?.length && !query.statuses.includes(certificate.status)) {
        return false;
      }
      return true;
    });
  }

  public async saveIssuedCertificate(
    _input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async revokeIssuedCertificate(
    _input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async supersedeIssuedCertificate(
    _input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.trustMaterials.get(materialRef);
  }

  public async listTrustMaterials(
    _query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    return [...this.trustMaterials.values()];
  }

  public async saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>> {
    this.trustMaterials.set(input.record.materialRef, input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }

  public async findLatestStatusEventBySerialNumber(): Promise<CertificateStatusHistoryPersistenceRecord | undefined> {
    return undefined;
  }

  public async listCertificateStatusHistory(
    _query: CertificateStatusHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateStatusHistoryPersistenceRecord>> {
    return Object.freeze([]);
  }

  public async appendCertificateStatusHistory(
    _input: AppendCertificateStatusHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateStatusHistoryPersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async findLatestCertificateRevocationBySerialNumber(): Promise<CertificateRevocationHistoryPersistenceRecord | undefined> {
    return undefined;
  }

  public async listCertificateRevocations(
    _query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>> {
    return Object.freeze([]);
  }

  public async saveCertificateRevocation(
    _input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>> {
    throw new Error("not implemented for test");
  }

  public async listCertificateDistributionEvents(
    query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>> {
    return [...this.distributionEvents.values()].filter((event) => {
      if (query.certificateAuthorityId && event.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.statuses?.length && !query.statuses.includes(event.status)) {
        return false;
      }
      return true;
    });
  }

  public async saveCertificateDistributionEvent(
    input: SaveCertificateDistributionEventPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateDistributionEventPersistenceRecord>> {
    this.distributionEvents.set(input.record.distributionEventId, input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }
}

describe("GetCertificateAuthorityStatusIntrospectionUseCase", () => {
  it("returns healthy introspection view with sanitized authority metadata", async () => {
    const repositories = new InMemorySecurityQueryRepositories();
    repositories.authorities.set("ca:internal:root:v1", createAuthorityRecord({
      validityNotAfter: "2028-01-01T00:00:00.000Z",
    }));
    repositories.trustMaterials.set("trust:ca:cert:v1", createTrustMaterial({
      materialRef: "trust:ca:cert:v1",
      kind: "certificate-pem",
      storageLocator: "secret-store:internal-ca:root-cert",
    }));
    repositories.trustMaterials.set("trust:ca:key:v1", createTrustMaterial({
      materialRef: "trust:ca:key:v1",
      kind: "private-key-encrypted-pem",
      storageLocator: "secret-store:internal-ca:root-key",
    }));
    repositories.issuedCertificates.set("AA11", createIssuedCertificate({
      serialNumber: "AA11",
      status: CertificateStatuses.issued,
      issuedAt: "2026-06-01T00:00:00.000Z",
      notAfter: "2027-06-01T00:00:00.000Z",
    }));

    const secretService = new StubSecretService();
    secretService.setSecret("secret-store:internal-ca:root-cert", true);
    secretService.setSecret("secret-store:internal-ca:root-key", true);

    const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider(createValidConfiguration()),
      secretService,
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const useCase = new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
      certificateLifecycleEventRepository: repositories,
      clock: {
        now: () => new Date("2026-08-01T00:00:00.000Z"),
      },
    });

    const result = await useCase.execute();
    parseCertificateAuthorityStatusIntrospectionView(result);

    expect(result.state).toBe("healthy");
    expect(result.initialized).toBe(true);
    expect(result.active).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.authority?.certificateCounts.total).toBe(1);
    expect(JSON.stringify(result)).not.toContain("secret-store:");
  });

  it("returns uninitialized state when CA bootstrap and metadata are absent", async () => {
    const repositories = new InMemorySecurityQueryRepositories();
    const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider({
        source: "test",
      }),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const useCase = new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
      certificateLifecycleEventRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe("uninitialized");
    expect(result.initialized).toBe(false);
    expect(result.authority).toBeUndefined();
  });

  it("returns degraded when rotation threshold is near or trust distribution failures exist", async () => {
    const repositories = new InMemorySecurityQueryRepositories();
    repositories.authorities.set("ca:internal:root:v1", createAuthorityRecord({
      validityNotAfter: "2026-12-01T00:00:00.000Z",
    }));
    repositories.trustMaterials.set("trust:ca:cert:v1", createTrustMaterial({
      materialRef: "trust:ca:cert:v1",
      kind: "certificate-pem",
      storageLocator: "secret-store:internal-ca:root-cert",
    }));
    repositories.trustMaterials.set("trust:ca:key:v1", createTrustMaterial({
      materialRef: "trust:ca:key:v1",
      kind: "private-key-encrypted-pem",
      storageLocator: "secret-store:internal-ca:root-key",
    }));
    repositories.issuedCertificates.set("BB22", createIssuedCertificate({
      serialNumber: "BB22",
      status: CertificateStatuses.issued,
      issuedAt: "2026-08-01T00:00:00.000Z",
      notAfter: "2026-09-10T00:00:00.000Z",
    }));
    repositories.distributionEvents.set("distribution:1", Object.freeze({
      distributionEventId: "distribution:1",
      materialRef: "trust:bundle:root:v1",
      certificateAuthorityId: "ca:internal:root:v1",
      targetKind: CertificateDistributionTargetKinds.node,
      targetReferenceId: "node:1",
      transport: "node-trust-bundle-sync",
      status: CertificateDistributionEventStatuses.failed,
      occurredAt: "2026-09-01T00:00:00.000Z",
      occurredBy: "user:admin",
      createdAt: "2026-09-01T00:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-09-01T00:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    }));

    const secretService = new StubSecretService();
    secretService.setSecret("secret-store:internal-ca:root-cert", true);
    secretService.setSecret("secret-store:internal-ca:root-key", true);

    const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider(createValidConfiguration()),
      secretService,
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const useCase = new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
      certificateLifecycleEventRepository: repositories,
      clock: {
        now: () => new Date("2026-09-02T00:00:00.000Z"),
      },
    });

    const result = await useCase.execute({
      certificateExpiryWarningWindowDays: 30,
    });

    expect(result.state).toBe("degraded");
    expect(result.blocked).toBe(false);
    expect(result.healthFlags.rotationDueSoon).toBe(true);
    expect(result.healthFlags.hasExpiringCertificates).toBe(true);
    expect(result.healthFlags.hasDistributionFailures).toBe(true);
  });

  it("returns blocked when startup validation indicates configuration mismatch", async () => {
    const repositories = new InMemorySecurityQueryRepositories();
    repositories.authorities.set("ca:internal:root:v1", createAuthorityRecord({
      validityNotAfter: "2028-01-01T00:00:00.000Z",
    }));

    const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider({
        source: "test",
        certificateAuthorityId: "ca:internal:root:v1",
      }),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const useCase = new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
      certificateLifecycleEventRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe("blocked");
    expect(result.blocked).toBe(true);
    expect(result.healthFlags.configurationBlocked).toBe(true);
  });
});

function createValidConfiguration(): CertificateAuthorityBootstrapConfiguration {
  return Object.freeze({
    source: "test",
    certificateAuthorityId: "ca:internal:root:v1",
    rootCertificateMaterialRef: "trust:ca:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
    rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
  });
}

function createAuthorityRecord(input: {
  readonly validityNotAfter: string;
}): CertificateAuthorityRootPersistenceRecord {
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
    serialNumber: "A1B2C3",
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: input.validityNotAfter,
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
    createdBy: "system-bootstrap",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "system-bootstrap",
    revision: 1,
  });
}

function createTrustMaterial(input: {
  readonly materialRef: string;
  readonly kind: TrustMaterialReferencePersistenceRecord["kind"];
  readonly storageLocator: string;
}): TrustMaterialReferencePersistenceRecord {
  return Object.freeze({
    materialRef: input.materialRef,
    kind: input.kind,
    storageLocator: input.storageLocator,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system-bootstrap",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "system-bootstrap",
    revision: 1,
  });
}

function createIssuedCertificate(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly issuedAt: string;
  readonly notAfter: string;
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status,
    subject: {
      commonName: "node-01.ai-loom.internal",
      dnsNames: ["node-01.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: [],
    },
    subjectReference: {
      kind: "node",
      referenceId: "node:01",
    },
    usages: ["server-auth"],
    validity: {
      notBefore: "2026-06-01T00:00:00.000Z",
      notAfter: input.notAfter,
    },
    issuedAt: input.issuedAt,
    certificateMaterialRef: `trust:cert:${input.serialNumber.toLowerCase()}:v1`,
    publicKeyAlgorithm: "rsa-4096",
    createdAt: input.issuedAt,
    createdBy: "user:admin",
    lastModifiedAt: input.issuedAt,
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
