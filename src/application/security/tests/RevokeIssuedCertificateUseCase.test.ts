import { describe, expect, it } from "bun:test";
import { CertificateRevocationReasons, CertificateStatuses } from "@domain/security/CertificateAuthorityDomain";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  IssuedCertificateAlreadyRevokedError,
  RevokeIssuedCertificateInvalidRequestError,
  RevokeIssuedCertificateUseCase,
} from "../use-cases/RevokeIssuedCertificateUseCase";
import type { CertificateLifecycleAuditEvent, CertificateLifecycleAuditSink } from "../ports/CertificateLifecycleAuditPorts";
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
} from "@shared/dto/security/CertificateAuthorityDtos";

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
    input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    const serialNumber = input.record.serialNumber.trim().toUpperCase();
    const existing = this.recordsBySerial.get(serialNumber);
    const next = Object.freeze({
      ...input.record,
      serialNumber,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
    });

    this.recordsBySerial.set(serialNumber, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  public async revokeIssuedCertificate(
    input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>> {
    const existing = await this.findIssuedCertificateBySerialNumber(input.serialNumber);
    if (!existing) {
      throw new Error("certificate not found");
    }

    const updated: IssuedCertificatePersistenceRecord = Object.freeze({
      ...existing,
      status: CertificateStatuses.revoked,
      revocation: input.revocation,
      supersededBySerialNumber: undefined,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
      lastModifiedAt: input.mutation.context.occurredAt ?? existing.lastModifiedAt,
      revision: existing.revision + 1,
    });
    this.recordsBySerial.set(updated.serialNumber, updated);
    return Object.freeze({
      record: updated,
      changed: true,
      wasReplay: false,
    });
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
    input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>> {
    const next = Object.freeze({
      ...input.record,
      serialNumber: input.record.serialNumber.toUpperCase(),
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      revision: 1,
    });

    this.revocationsBySerial.set(next.serialNumber, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
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

class CapturingCertificateLifecycleAuditSink implements CertificateLifecycleAuditSink {
  public readonly events: CertificateLifecycleAuditEvent[] = [];

  public async recordCertificateLifecycleAuditEvent(event: CertificateLifecycleAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("RevokeIssuedCertificateUseCase", () => {
  it("revokes an issued certificate via explicit admin action and persists revocation metadata", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    const auditSink = new CapturingCertificateLifecycleAuditSink();
    issuedCertificates.recordsBySerial.set("C0FFEE", createIssuedRecord({
      serialNumber: "C0FFEE",
      status: CertificateStatuses.issued,
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
    }));

    const useCase = new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
      auditSink,
    });

    const result = await useCase.execute({
      operationKey: "op:certificate:revoke:1",
      serialNumber: "c0ffee",
      revocationReason: CertificateRevocationReasons.policyViolation,
      actorUserIdentityId: "user:security-admin",
      revokedAt: "2026-07-01T00:00:00.000Z",
      note: "node revoked by security review",
      reason: "admin-revocation",
    });

    expect(result.currentStatus).toBe(CertificateStatuses.revoked);
    expect(result.revocation.reason).toBe(CertificateRevocationReasons.policyViolation);
    expect(result.revocation.revokedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(lifecycleEvents.revocationsBySerial.get("C0FFEE")?.reason).toBe(CertificateRevocationReasons.policyViolation);
    expect(issuedCertificates.recordsBySerial.get("C0FFEE")?.status).toBe(CertificateStatuses.revoked);
    expect(auditSink.events.map((event) => event.type)).toEqual([
      "certificate-revocation-started",
      "certificate-revocation-succeeded",
    ]);
  });

  it("rejects duplicate revocation attempts", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    const auditSink = new CapturingCertificateLifecycleAuditSink();
    issuedCertificates.recordsBySerial.set("C0FFEE", createIssuedRecord({
      serialNumber: "C0FFEE",
      status: CertificateStatuses.revoked,
      lastModifiedAt: "2026-07-01T00:00:00.000Z",
      revocation: {
        reason: CertificateRevocationReasons.keyCompromise,
        revokedAt: "2026-07-01T00:00:00.000Z",
        revokedByActorId: "user:security-admin",
      },
    }));

    const useCase = new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
      auditSink,
    });

    await expect(useCase.execute({
      operationKey: "op:certificate:revoke:2",
      serialNumber: "C0FFEE",
      revocationReason: CertificateRevocationReasons.policyViolation,
      actorUserIdentityId: "user:security-admin",
    })).rejects.toBeInstanceOf(IssuedCertificateAlreadyRevokedError);
    expect(auditSink.events.map((event) => event.type)).toEqual([
      "certificate-revocation-started",
      "certificate-revocation-failed",
    ]);
    expect((auditSink.events[1]?.details as Record<string, unknown>)?.code).toBe("certificate-revocation-already-revoked");
  });

  it("rejects invalid revocation requests", async () => {
    const issuedCertificates = new InMemoryIssuedCertificateRepository();
    const lifecycleEvents = new InMemoryLifecycleEventRepository();
    issuedCertificates.recordsBySerial.set("DEADBE", createIssuedRecord({
      serialNumber: "DEADBE",
      status: CertificateStatuses.expired,
      lastModifiedAt: "2026-09-01T00:00:00.000Z",
    }));

    const useCase = new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: issuedCertificates,
      certificateLifecycleEventRepository: lifecycleEvents,
    });

    await expect(useCase.execute({
      operationKey: "op:certificate:revoke:3",
      serialNumber: " ",
      revocationReason: CertificateRevocationReasons.unspecified,
      actorUserIdentityId: "user:security-admin",
    })).rejects.toBeInstanceOf(RevokeIssuedCertificateInvalidRequestError);

    await expect(useCase.execute({
      operationKey: "op:certificate:revoke:4",
      serialNumber: "DEADBE",
      revocationReason: CertificateRevocationReasons.unspecified,
      actorUserIdentityId: "user:security-admin",
    })).rejects.toBeInstanceOf(RevokeIssuedCertificateInvalidRequestError);
  });
});

function createIssuedRecord(input: {
  readonly serialNumber: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly lastModifiedAt: string;
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
      notBefore: "2026-04-05T12:00:00.000Z",
      notAfter: "2027-04-05T12:00:00.000Z",
    },
    issuedAt: "2026-04-05T12:00:00.000Z",
    certificateMaterialRef: "trust:cert:node-01:v1",
    certificateChainMaterialRef: "trust:chain:root:v1",
    trustMaterialRef: "trust:bundle:node-01:v1",
    publicKeyAlgorithm: "rsa-4096",
    revocation: input.revocation,
    createdAt: "2026-04-05T12:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: input.lastModifiedAt,
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

