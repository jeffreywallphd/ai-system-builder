import { describe, expect, it } from "bun:test";
import { CertificateAuthorityStatuses } from "@domain/security/CertificateAuthorityDomain";
import type { CertificateAuthorityBootstrapConfiguration } from "../ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type { CertificateAuthoritySecretMetadata } from "../ports/ICertificateAuthorityBootstrapSecretService";
import {
  CertificateAuthorityStartupStates,
  ResolveCertificateAuthorityStartupStateUseCase,
} from "../use-cases/ResolveCertificateAuthorityStartupStateUseCase";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
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

class StubConfigurationProvider {
  public constructor(private readonly configuration: CertificateAuthorityBootstrapConfiguration) {}

  public async loadConfiguration(): Promise<CertificateAuthorityBootstrapConfiguration> {
    return this.configuration;
  }
}

class StubSecretService {
  private readonly refs = new Map<string, CertificateAuthoritySecretMetadata>();
  private readonly failingRefs = new Set<string>();

  public setSecret(secretRef: string, exists: boolean): void {
    this.refs.set(secretRef, Object.freeze({
      secretRef,
      exists,
      source: "test-secret-store",
    }));
  }

  public setUnavailable(secretRef: string): void {
    this.failingRefs.add(secretRef);
  }

  public async getSecretMetadata(secretRef: string): Promise<CertificateAuthoritySecretMetadata> {
    if (this.failingRefs.has(secretRef)) {
      throw new Error("secret source unavailable");
    }

    return this.refs.get(secretRef) ?? Object.freeze({
      secretRef,
      exists: false,
      source: "test-secret-store",
    });
  }
}

class InMemoryCertificateAuthorityRepositories
  implements ICertificateAuthorityRootPersistenceRepository, ITrustMaterialReferencePersistenceRepository {
  private readonly authoritiesById = new Map<string, CertificateAuthorityRootPersistenceRecord>();
  private readonly trustMaterialsByRef = new Map<string, TrustMaterialReferencePersistenceRecord>();

  public addAuthority(record: CertificateAuthorityRootPersistenceRecord): void {
    this.authoritiesById.set(record.certificateAuthorityId, record);
  }

  public addTrustMaterial(record: TrustMaterialReferencePersistenceRecord): void {
    this.trustMaterialsByRef.set(record.materialRef, record);
  }

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
    this.authoritiesById.set(input.record.certificateAuthorityId, input.record);
    return Object.freeze({
      record: input.record,
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
    const record = Object.freeze({
      ...existing,
      status: input.status,
      retiredAt: input.retiredAt,
      compromisedAt: input.compromisedAt,
    });
    this.authoritiesById.set(record.certificateAuthorityId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async updateCertificateAuthorityRotationPolicy(
    input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    const existing = this.authoritiesById.get(input.certificateAuthorityId);
    if (!existing) {
      throw new Error("missing authority");
    }
    const record = Object.freeze({
      ...existing,
      rotationPolicy: input.rotationPolicy,
    });
    this.authoritiesById.set(record.certificateAuthorityId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
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
    this.trustMaterialsByRef.set(input.record.materialRef, input.record);
    return Object.freeze({
      record: input.record,
      changed: true,
      wasReplay: false,
    });
  }
}

describe("ResolveCertificateAuthorityStartupStateUseCase", () => {
  it("returns uninitialized when CA bootstrap configuration and persisted authority are absent", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider({
        source: "test",
      }),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.uninitialized);
  });

  it("returns initialized when persisted CA, trust metadata, and secret references are complete", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    repositories.addAuthority(createAuthorityRecord(CertificateAuthorityStatuses.active));
    repositories.addTrustMaterial(createTrustMaterial({
      materialRef: "trust:ca:cert:v1",
      kind: "certificate-pem",
      storageLocator: "env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM",
    }));
    repositories.addTrustMaterial(createTrustMaterial({
      materialRef: "trust:ca:key:v1",
      kind: "private-key-encrypted-pem",
      storageLocator: "env:AI_LOOM_INTERNAL_CA_ROOT_KEY_PEM",
    }));
    const secretService = new StubSecretService();
    secretService.setSecret("env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM", true);
    secretService.setSecret("env:AI_LOOM_INTERNAL_CA_ROOT_KEY_PEM", true);

    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider(createValidConfiguration()),
      secretService,
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.initialized);
  });

  it("returns invalid when bootstrap configuration is incomplete", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider({
        source: "test",
        certificateAuthorityId: "ca:internal:root:v1",
      }),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.invalid);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "bootstrap-config-incomplete")).toBeTrue();
  });

  it("returns revoked when persisted CA status is compromised", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    repositories.addAuthority(createAuthorityRecord(CertificateAuthorityStatuses.compromised));

    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider(createValidConfiguration()),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.revoked);
  });

  it("returns migration-required when persisted CA status is retired", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    repositories.addAuthority(createAuthorityRecord(CertificateAuthorityStatuses.retired));

    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider(createValidConfiguration()),
      secretService: new StubSecretService(),
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.migrationRequired);
  });

  it("returns invalid when configured secret source is unavailable", async () => {
    const repositories = new InMemoryCertificateAuthorityRepositories();
    repositories.addAuthority(createAuthorityRecord(CertificateAuthorityStatuses.active));
    repositories.addTrustMaterial(createTrustMaterial({
      materialRef: "trust:ca:cert:v1",
      kind: "certificate-pem",
      storageLocator: "secret-store:internal-ca:root-cert",
    }));
    repositories.addTrustMaterial(createTrustMaterial({
      materialRef: "trust:ca:key:v1",
      kind: "private-key-encrypted-pem",
      storageLocator: "secret-store:internal-ca:root-key",
    }));
    const secretService = new StubSecretService();
    secretService.setUnavailable("secret-store:internal-ca:root-cert");

    const useCase = new ResolveCertificateAuthorityStartupStateUseCase({
      configurationProvider: new StubConfigurationProvider({
        source: "test",
        certificateAuthorityId: "ca:internal:root:v1",
        rootCertificateMaterialRef: "trust:ca:cert:v1",
        rootPrivateKeyMaterialRef: "trust:ca:key:v1",
        rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
        rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
      }),
      secretService,
      certificateAuthorityRepository: repositories,
      trustMaterialRepository: repositories,
    });

    const result = await useCase.execute();
    expect(result.state).toBe(CertificateAuthorityStartupStates.invalid);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "authority-secret-source-unavailable"),
    ).toBeTrue();
  });
});

function createValidConfiguration(): CertificateAuthorityBootstrapConfiguration {
  return Object.freeze({
    source: "test",
    certificateAuthorityId: "ca:internal:root:v1",
    rootCertificateMaterialRef: "trust:ca:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    rootCertificateSecretRef: "env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM",
    rootPrivateKeySecretRef: "env:AI_LOOM_INTERNAL_CA_ROOT_KEY_PEM",
  });
}

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

