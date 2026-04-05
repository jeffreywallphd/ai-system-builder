import { describe, expect, it } from "bun:test";
import { CertificateAuthorityStatuses, CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import { GetCertificateRenewalPlanningUseCase } from "../use-cases/GetCertificateRenewalPlanningUseCase";
import type {
  CertificateAuthorityPersistenceMutationResult,
  CertificateAuthorityRootLookupQuery,
  CertificateAuthorityRootPersistenceRecord,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveCertificateAuthorityRootPersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
  UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  UpdateCertificateAuthorityStatusPersistenceRecordInput,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

class InMemoryRenewalRepositories
  implements ICertificateAuthorityRootPersistenceRepository, IIssuedCertificatePersistenceRepository {
  public readonly authorities = new Map<string, CertificateAuthorityRootPersistenceRecord>();
  public readonly certificates = new Map<string, IssuedCertificatePersistenceRecord>();

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
    _query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    return [...this.authorities.values()];
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
    throw new Error("Not implemented for test.");
  }

  public async updateCertificateAuthorityRotationPolicy(
    _input: UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateAuthorityRootPersistenceRecord>> {
    throw new Error("Not implemented for test.");
  }

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.certificates.get(serialNumber.toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(): Promise<IssuedCertificatePersistenceRecord | undefined> {
    throw new Error("Not implemented for test.");
  }

  public async listIssuedCertificates(
    query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return [...this.certificates.values()].filter((certificate) => (
      !query.certificateAuthorityId || certificate.certificateAuthorityId === query.certificateAuthorityId
    ));
  }

  public async saveIssuedCertificate(
    _input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("Not implemented for test.");
  }

  public async revokeIssuedCertificate(
    _input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("Not implemented for test.");
  }

  public async supersedeIssuedCertificate(
    _input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    throw new Error("Not implemented for test.");
  }
}

describe("GetCertificateRenewalPlanningUseCase", () => {
  it("builds renewal planning state and summary for tracked certificates", async () => {
    const repositories = new InMemoryRenewalRepositories();
    repositories.authorities.set("ca:internal:root:v1", createAuthorityRecord());
    repositories.certificates.set("AA11", createCertificate({
      serialNumber: "AA11",
      status: CertificateStatuses.issued,
      notAfter: "2026-12-01T00:00:00.000Z",
    }));
    repositories.certificates.set("BB22", createCertificate({
      serialNumber: "BB22",
      status: CertificateStatuses.issued,
      notAfter: "2026-09-20T00:00:00.000Z",
    }));
    repositories.certificates.set("CC33", createCertificate({
      serialNumber: "CC33",
      status: CertificateStatuses.issued,
      notAfter: "2026-09-05T00:00:00.000Z",
    }));
    repositories.certificates.set("DD44", createCertificate({
      serialNumber: "DD44",
      status: CertificateStatuses.issued,
      notAfter: "2026-08-31T00:00:00.000Z",
    }));
    repositories.certificates.set("EE55", createCertificate({
      serialNumber: "EE55",
      status: CertificateStatuses.revoked,
      notAfter: "2026-10-15T00:00:00.000Z",
    }));

    const useCase = new GetCertificateRenewalPlanningUseCase({
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
      clock: {
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      },
    });

    const result = await useCase.execute();

    expect(result.summary.totalTracked).toBe(4);
    expect(result.summary.active).toBe(1);
    expect(result.summary.renewalSoon).toBe(1);
    expect(result.summary.renewalRequired).toBe(1);
    expect(result.summary.expired).toBe(1);
    expect(result.summary.stale).toBe(1);
    expect(result.attention.some((item) => item.code === "certificate-expired")).toBe(true);
    expect(result.attention.some((item) => item.code === "certificate-renewal-required")).toBe(true);
  });

  it("returns warning attention when no CA is available", async () => {
    const repositories = new InMemoryRenewalRepositories();
    const useCase = new GetCertificateRenewalPlanningUseCase({
      certificateAuthorityRepository: repositories,
      issuedCertificateRepository: repositories,
    });

    const result = await useCase.execute({
      asOf: "2026-09-01T00:00:00.000Z",
    });

    expect(result.certificateAuthority).toBeUndefined();
    expect(result.summary.totalTracked).toBe(0);
    expect(result.attention).toEqual([{
      scope: "certificate-authority",
      code: "certificate-authority-not-found",
      severity: "warning",
      message: "No certificate authority was found for renewal planning.",
    }]);
  });
});

function createAuthorityRecord(): CertificateAuthorityRootPersistenceRecord {
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
      notAfter: "2028-01-01T00:00:00.000Z",
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

function createCertificate(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly notAfter: string;
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status,
    subject: {
      commonName: `${input.serialNumber.toLowerCase()}.ai-loom.internal`,
      dnsNames: [`${input.serialNumber.toLowerCase()}.ai-loom.internal`],
      ipAddresses: [],
      uriSanEntries: [],
    },
    subjectReference: {
      kind: "node",
      referenceId: `node:${input.serialNumber.toLowerCase()}`,
    },
    usages: ["server-auth"],
    validity: {
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: input.notAfter,
    },
    issuedAt: "2026-01-01T00:00:00.000Z",
    certificateMaterialRef: `trust:cert:${input.serialNumber.toLowerCase()}:v1`,
    publicKeyAlgorithm: "rsa-4096",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
