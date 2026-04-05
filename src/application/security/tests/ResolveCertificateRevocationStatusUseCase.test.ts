import { describe, expect, it } from "bun:test";
import { CertificateRevocationReasons, CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import { CertificateRevocationRegistryStatuses } from "../ports/ICertificateRevocationStatusRegistry";
import { ResolveCertificateRevocationStatusUseCase } from "../use-cases/ResolveCertificateRevocationStatusUseCase";
import type {
  AppendCertificateStatusHistoryPersistenceRecordInput,
  CertificateAuthorityPersistenceMutationResult,
  CertificateDistributionEventLookupQuery,
  CertificateDistributionEventPersistenceRecord,
  CertificateRevocationHistoryLookupQuery,
  CertificateRevocationHistoryPersistenceRecord,
  CertificateStatusHistoryLookupQuery,
  CertificateStatusHistoryPersistenceRecord,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveCertificateDistributionEventPersistenceRecordInput,
  SaveCertificateRevocationHistoryPersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

class InMemoryIssuedCertificateRepository implements IIssuedCertificatePersistenceRepository {
  public readonly recordsBySerial = new Map<string, IssuedCertificatePersistenceRecord>();

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.recordsBySerial.get(serialNumber.trim().toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return undefined;
  }

  public async listIssuedCertificates(
    _query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    return [...this.recordsBySerial.values()];
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

class InMemoryLifecycleEventRepository implements ICertificateLifecycleEventPersistenceRepository {
  public readonly revocationsBySerial = new Map<string, CertificateRevocationHistoryPersistenceRecord>();

  public async findLatestStatusEventBySerialNumber(): Promise<CertificateStatusHistoryPersistenceRecord | undefined> {
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
    serialNumber: string,
  ): Promise<CertificateRevocationHistoryPersistenceRecord | undefined> {
    return this.revocationsBySerial.get(serialNumber.trim().toUpperCase());
  }

  public async listCertificateRevocations(
    _query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>> {
    return [...this.revocationsBySerial.values()];
  }

  public async saveCertificateRevocation(
    _input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>> {
    throw new Error("not implemented");
  }

  public async listCertificateDistributionEvents(
    _query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>> {
    return [];
  }

  public async saveCertificateDistributionEvent(
    _input: SaveCertificateDistributionEventPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateDistributionEventPersistenceRecord>> {
    throw new Error("not implemented");
  }
}

describe("ResolveCertificateRevocationStatusUseCase", () => {
  it("returns active for issued certificates that are currently valid", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    issuedCertificates.recordsBySerial.set("AABBCC", createIssuedRecord({
      serialNumber: "AABBCC",
      status: CertificateStatuses.issued,
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    }));

    const useCase = new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
    });

    const result = await useCase.resolveCertificateRevocationStatus({
      serialNumber: "aabbcc",
      asOf: "2026-07-01T00:00:00.000Z",
    });

    expect(result.status).toBe(CertificateRevocationRegistryStatuses.active);
    expect(result.active).toBe(true);
    expect(result.revoked).toBe(false);
  });

  it("returns revoked with revocation metadata for revoked certificates", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    issuedCertificates.recordsBySerial.set("C0FFEE", createIssuedRecord({
      serialNumber: "C0FFEE",
      status: CertificateStatuses.revoked,
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
      revocation: undefined,
    }));
    lifecycleEvents.revocationsBySerial.set("C0FFEE", Object.freeze({
      revocationId: "revocation:C0FFEE:1782864000000",
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "C0FFEE",
      reason: CertificateRevocationReasons.policyViolation,
      revokedAt: "2026-07-01T00:00:00.000Z",
      revokedByActorId: "user:security-admin",
      createdAt: "2026-07-01T00:00:00.000Z",
      createdBy: "user:security-admin",
      lastModifiedAt: "2026-07-01T00:00:00.000Z",
      lastModifiedBy: "user:security-admin",
      revision: 1,
    }));

    const useCase = new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
    });

    const result = await useCase.resolveCertificateRevocationStatus({
      serialNumber: "C0FFEE",
      asOf: "2026-07-02T00:00:00.000Z",
    });

    expect(result.status).toBe(CertificateRevocationRegistryStatuses.revoked);
    expect(result.revoked).toBe(true);
    expect(result.revocation?.reason).toBe(CertificateRevocationReasons.policyViolation);
  });

  it("distinguishes expired and not-found certificates", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    issuedCertificates.recordsBySerial.set("DEADBE", createIssuedRecord({
      serialNumber: "DEADBE",
      status: CertificateStatuses.issued,
      notBefore: "2025-04-05T12:00:00.000Z",
      notAfter: "2026-01-05T12:00:00.000Z",
    }));

    const useCase = new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
    });

    const expired = await useCase.resolveCertificateRevocationStatus({
      serialNumber: "DEADBE",
      asOf: "2026-07-01T00:00:00.000Z",
    });
    const missing = await useCase.resolveCertificateRevocationStatus({
      serialNumber: "BADA55",
      asOf: "2026-07-01T00:00:00.000Z",
    });

    expect(expired.status).toBe(CertificateRevocationRegistryStatuses.expired);
    expect(expired.expired).toBe(true);
    expect(missing.status).toBe(CertificateRevocationRegistryStatuses.notFound);
  });
});

function createIssuedRecord(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly notBefore: string;
  readonly notAfter: string;
  readonly revocation?: IssuedCertificatePersistenceRecord["revocation"];
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
    usages: ["client-auth"],
    validity: {
      notBefore: input.notBefore,
      notAfter: input.notAfter,
    },
    issuedAt: input.notBefore,
    certificateMaterialRef: `trust:cert:${input.serialNumber.toLowerCase()}:v1`,
    publicKeyAlgorithm: "rsa-4096",
    revocation: input.revocation,
    createdAt: input.notBefore,
    createdBy: "user:admin",
    lastModifiedAt: input.notBefore,
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}
