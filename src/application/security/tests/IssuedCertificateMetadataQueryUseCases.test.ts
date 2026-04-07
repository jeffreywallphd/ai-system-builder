import { describe, expect, it } from "bun:test";
import {
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "@domain/security/CertificateAuthorityDomain";
import type { CertificateMetadataListAuthorizationQuery, CertificateQueryAuthorizationHook } from "../ports/CertificateQueryAuthorizationPorts";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import { GetIssuedCertificateMetadataUseCase } from "../use-cases/GetIssuedCertificateMetadataUseCase";
import { ListIssuedCertificateMetadataUseCase } from "../use-cases/ListIssuedCertificateMetadataUseCase";
import {
  parseCertificateMetadataListView,
  parseIssuedCertificateMetadataView,
} from "@shared/schemas/security/CertificateAuthoritySchemaContracts";
import type {
  CertificateAuthorityPersistenceMutationResult,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
} from "@shared/dto/security/CertificateAuthorityDtos";

class InMemoryIssuedCertificateRepository implements IIssuedCertificatePersistenceRepository {
  public readonly records = new Map<string, IssuedCertificatePersistenceRecord>();

  public async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.records.get(serialNumber.trim().toUpperCase());
  }

  public async findLatestIssuedCertificateBySubjectReference(input: {
    readonly kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
    readonly referenceId: string;
    readonly workspaceId?: string;
  }): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return [...this.records.values()]
      .filter((record) => (
        record.subjectReference.kind === input.kind
        && record.subjectReference.referenceId === input.referenceId
        && record.subjectReference.workspaceId === input.workspaceId
      ))
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0];
  }

  public async listIssuedCertificates(
    query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    const filtered = [...this.records.values()]
      .filter((record) => {
        if (query.certificateAuthorityId && record.certificateAuthorityId !== query.certificateAuthorityId) {
          return false;
        }
        if (query.statuses?.length && !query.statuses.includes(record.status)) {
          return false;
        }
        if (query.subjectReferenceKinds?.length && !query.subjectReferenceKinds.includes(record.subjectReference.kind)) {
          return false;
        }
        if (query.subjectReferenceId && record.subjectReference.referenceId !== query.subjectReferenceId) {
          return false;
        }
        if (query.usageAnyOf?.length && !query.usageAnyOf.some((usage) => record.usages.includes(usage))) {
          return false;
        }
        if (!(query.includeRevoked ?? false) && record.status === CertificateStatuses.revoked) {
          return false;
        }
        if (query.issuedAfter && Date.parse(record.issuedAt) < Date.parse(query.issuedAfter)) {
          return false;
        }
        if (query.issuedBefore && Date.parse(record.issuedAt) > Date.parse(query.issuedBefore)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));

    if (query.offset || query.limit) {
      const offset = query.offset ?? 0;
      const limit = query.limit ?? filtered.length;
      return filtered.slice(offset, offset + limit);
    }

    return filtered;
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

class StubAuthorizationHook implements CertificateQueryAuthorizationHook {
  public listDenied = false;
  public getDenied = false;
  public lastListQuery?: CertificateMetadataListAuthorizationQuery;

  public async assertCanListIssuedCertificateMetadata(input: {
    readonly actorUserIdentityId: string;
    readonly query: CertificateMetadataListAuthorizationQuery;
  }): Promise<void> {
    this.lastListQuery = input.query;
    if (this.listDenied) {
      throw new Error("forbidden-list");
    }
  }

  public async assertCanGetIssuedCertificateMetadata(): Promise<void> {
    if (this.getDenied) {
      throw new Error("forbidden-get");
    }
  }
}

describe("Issued certificate metadata query use cases", () => {
  it("lists certificate metadata with operational filters and sanitized fields", async () => {
    const repository = new InMemoryIssuedCertificateRepository();
    const authorizationHook = new StubAuthorizationHook();

    repository.records.set("AA11", createIssuedCertificateRecord({
      serialNumber: "AA11",
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      subjectReferenceId: "node:alpha",
      issuedAt: "2026-01-05T00:00:00.000Z",
      notAfter: "2026-02-01T00:00:00.000Z",
      status: CertificateStatuses.issued,
      revocation: undefined,
    }));
    repository.records.set("BB22", createIssuedCertificateRecord({
      serialNumber: "BB22",
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      subjectReferenceId: "node:beta",
      issuedAt: "2026-01-06T00:00:00.000Z",
      notAfter: "2026-01-10T00:00:00.000Z",
      status: CertificateStatuses.revoked,
      revocation: {
        reason: "policy-violation",
        revokedAt: "2026-01-08T00:00:00.000Z",
        revokedByActorId: "user:security-admin",
        note: "manual revoke",
      },
    }));

    const useCase = new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: repository,
      authorizationHook,
      clock: {
        now: () => new Date("2026-02-15T00:00:00.000Z"),
      },
    });

    const result = await useCase.execute({
      actorUserIdentityId: "user:admin",
      linkedNodeId: "node:alpha",
      trustStatuses: ["expired"],
      issuedAfter: "2026-01-01T00:00:00.000Z",
      includeRevoked: true,
      limit: 10,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful list result.");
    }

    parseCertificateMetadataListView(result.value);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]?.serialNumber).toBe("AA11");
    expect(result.value.items[0]?.trust.status).toBe("expired");
    expect(result.value.items[0]?.revocation).toBeUndefined();
    expect(JSON.stringify(result.value)).not.toContain("certificateMaterialRef");
    expect(JSON.stringify(result.value)).not.toContain("trustMaterialRef");
    expect(authorizationHook.lastListQuery?.linkedNodeId).toBe("node:alpha");
  });

  it("returns forbidden outcome when list authorization fails", async () => {
    const repository = new InMemoryIssuedCertificateRepository();
    const authorizationHook = new StubAuthorizationHook();
    authorizationHook.listDenied = true;

    const useCase = new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: repository,
      authorizationHook,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "user:admin",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected forbidden result.");
    }
    expect(result.error.code).toBe("list-issued-certificate-metadata-forbidden");
  });

  it("applies subject-type filtering with pagination seams", async () => {
    const repository = new InMemoryIssuedCertificateRepository();
    repository.records.set("DD44", createIssuedCertificateRecord({
      serialNumber: "DD44",
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      subjectReferenceId: "node:1",
      issuedAt: "2026-03-03T00:00:00.000Z",
      notAfter: "2027-03-03T00:00:00.000Z",
      status: CertificateStatuses.issued,
      revocation: undefined,
    }));
    repository.records.set("EE55", createIssuedCertificateRecord({
      serialNumber: "EE55",
      subjectReferenceKind: CertificateSubjectReferenceKinds.node,
      subjectReferenceId: "node:2",
      issuedAt: "2026-03-02T00:00:00.000Z",
      notAfter: "2027-03-02T00:00:00.000Z",
      status: CertificateStatuses.issued,
      revocation: undefined,
    }));
    repository.records.set("FF66", createIssuedCertificateRecord({
      serialNumber: "FF66",
      subjectReferenceKind: CertificateSubjectReferenceKinds.service,
      subjectReferenceId: "service:a",
      issuedAt: "2026-03-01T00:00:00.000Z",
      notAfter: "2027-03-01T00:00:00.000Z",
      status: CertificateStatuses.issued,
      revocation: undefined,
    }));

    const useCase = new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: repository,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "user:admin",
      subjectReferenceKinds: [CertificateSubjectReferenceKinds.node],
      includeRevoked: true,
      limit: 1,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful list result.");
    }

    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]?.subjectReference.kind).toBe(CertificateSubjectReferenceKinds.node);
    expect(result.value.pagination.hasMore).toBe(true);
  });

  it("loads single certificate metadata detail and excludes unsafe internals", async () => {
    const repository = new InMemoryIssuedCertificateRepository();
    repository.records.set("CC33", createIssuedCertificateRecord({
      serialNumber: "CC33",
      subjectReferenceKind: CertificateSubjectReferenceKinds.service,
      subjectReferenceId: "service:authoritative",
      issuedAt: "2026-03-01T00:00:00.000Z",
      notAfter: "2027-03-01T00:00:00.000Z",
      status: CertificateStatuses.issued,
      revocation: undefined,
    }));

    const useCase = new GetIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: repository,
      clock: {
        now: () => new Date("2026-03-15T00:00:00.000Z"),
      },
    });

    const result = await useCase.execute({
      actorUserIdentityId: "user:admin",
      serialNumber: "cc33",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful detail result.");
    }

    parseIssuedCertificateMetadataView(result.value);
    expect(result.value.serialNumber).toBe("CC33");
    expect(result.value.trust.status).toBe("active");
    expect(JSON.stringify(result.value)).not.toContain("certificateMaterialRef");
    expect(JSON.stringify(result.value)).not.toContain("storageLocator");
  });

  it("returns not-found outcome for unknown serial detail queries", async () => {
    const repository = new InMemoryIssuedCertificateRepository();
    const useCase = new GetIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: repository,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "user:admin",
      serialNumber: "AB12",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected not-found result.");
    }
    expect(result.error.code).toBe("get-issued-certificate-metadata-not-found");
  });
});

function createIssuedCertificateRecord(input: {
  readonly serialNumber: string;
  readonly subjectReferenceKind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
  readonly subjectReferenceId: string;
  readonly issuedAt: string;
  readonly notAfter: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly revocation: IssuedCertificatePersistenceRecord["revocation"];
}): IssuedCertificatePersistenceRecord {
  return Object.freeze({
    certificateAuthorityId: "ca:internal:root:v1",
    serialNumber: input.serialNumber,
    status: input.status,
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
      notAfter: input.notAfter,
    },
    issuedAt: input.issuedAt,
    certificateMaterialRef: "trust:cert:secret",
    certificateChainMaterialRef: "trust:chain:secret",
    trustMaterialRef: "trust:bundle:secret",
    publicKeyAlgorithm: "rsa-4096",
    publicKeyFingerprintSha256: "abc123",
    revocation: input.revocation,
    supersededBySerialNumber: undefined,
    createdAt: input.issuedAt,
    createdBy: "user:admin",
    lastModifiedAt: input.issuedAt,
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

