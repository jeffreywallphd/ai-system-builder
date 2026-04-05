import { describe, expect, it } from "bun:test";
import {
  CertificateAuthorityStatuses,
  CertificateRevocationReasons,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../domain/security/CertificateAuthorityDomain";
import type {
  CertificateDistributionEventLookupQuery,
  CertificateDistributionEventPersistenceRecord,
  CertificateAuthorityRootPersistenceRecord,
  CertificateAuthorityRootLookupQuery,
  CertificateRevocationHistoryLookupQuery,
  CertificateRevocationHistoryPersistenceRecord,
  CertificateStatusHistoryLookupQuery,
  CertificateStatusHistoryPersistenceRecord,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  TrustMaterialReferenceLookupQuery,
  TrustMaterialReferencePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import {
  CertificateAuthorityPersistenceQueryPresets,
  normalizeCertificateAuthorityMutationOperationKey,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import type { CertificateAuthorityPersistencePorts } from "../ports/CertificateAuthorityPorts";

class InMemoryCertificateAuthorityPersistenceAdapter
  implements
    ICertificateAuthorityRootPersistenceRepository,
    ICertificateLifecycleEventPersistenceRepository,
    IIssuedCertificatePersistenceRepository,
    ITrustMaterialReferencePersistenceRepository {
  private readonly certificateAuthoritiesById = new Map<string, CertificateAuthorityRootPersistenceRecord>();
  private readonly certificatesBySerial = new Map<string, IssuedCertificatePersistenceRecord>();
  private readonly trustMaterialsByRef = new Map<string, TrustMaterialReferencePersistenceRecord>();
  private readonly statusHistoryById = new Map<string, CertificateStatusHistoryPersistenceRecord>();
  private readonly revocationsById = new Map<string, CertificateRevocationHistoryPersistenceRecord>();
  private readonly distributionEventsById = new Map<string, CertificateDistributionEventPersistenceRecord>();
  private readonly mutationReplayByOperationKey = new Map<string, unknown>();

  async findCertificateAuthorityById(
    certificateAuthorityId: string,
  ): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    return this.certificateAuthoritiesById.get(certificateAuthorityId);
  }

  async findActiveCertificateAuthority(asOf?: string): Promise<CertificateAuthorityRootPersistenceRecord | undefined> {
    const asOfEpoch = asOf ? Date.parse(asOf) : Number.POSITIVE_INFINITY;
    for (const value of this.certificateAuthoritiesById.values()) {
      if (value.status !== CertificateAuthorityStatuses.active) {
        continue;
      }
      if (Date.parse(value.validity.notBefore) <= asOfEpoch && Date.parse(value.validity.notAfter) > asOfEpoch) {
        return value;
      }
    }
    return undefined;
  }

  async listCertificateAuthorities(
    query: CertificateAuthorityRootLookupQuery,
  ): Promise<ReadonlyArray<CertificateAuthorityRootPersistenceRecord>> {
    const rows = [...this.certificateAuthoritiesById.values()].filter((row) => {
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(row.status)) {
        return false;
      }
      if (!query.includeRetired && row.status === CertificateAuthorityStatuses.retired) {
        return false;
      }
      if (!query.includeCompromised && row.status === CertificateAuthorityStatuses.compromised) {
        return false;
      }
      if (query.activeAt) {
        const activeAt = Date.parse(query.activeAt);
        if (Date.parse(row.validity.notBefore) > activeAt || Date.parse(row.validity.notAfter) <= activeAt) {
          return false;
        }
      }
      return true;
    });

    return this.page(rows, query.limit, query.offset);
  }

  async saveCertificateAuthority(input: {
    readonly record: CertificateAuthorityRootPersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as CertificateAuthorityRootPersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.certificateAuthoritiesById.get(input.record.certificateAuthorityId);
    const next: CertificateAuthorityRootPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.certificateAuthoritiesById.set(next.certificateAuthorityId, next);
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
  }

  async updateCertificateAuthorityStatus(input: {
    readonly certificateAuthorityId: string;
    readonly status: CertificateAuthorityRootPersistenceRecord["status"];
    readonly retiredAt?: string;
    readonly compromisedAt?: string;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const existing = this.certificateAuthoritiesById.get(input.certificateAuthorityId);
    if (!existing) {
      throw new Error("Certificate authority not found.");
    }

    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        status: input.status,
        retiredAt: input.retiredAt ?? existing.retiredAt,
        compromisedAt: input.compromisedAt ?? existing.compromisedAt,
      },
    });
  }

  async updateCertificateAuthorityRotationPolicy(input: {
    readonly certificateAuthorityId: string;
    readonly rotationPolicy: CertificateAuthorityRootPersistenceRecord["rotationPolicy"];
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const existing = this.certificateAuthoritiesById.get(input.certificateAuthorityId);
    if (!existing) {
      throw new Error("Certificate authority not found.");
    }

    return this.saveCertificateAuthority({
      mutation: input.mutation,
      record: {
        ...existing,
        rotationPolicy: input.rotationPolicy,
      },
    });
  }

  async findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined> {
    return this.certificatesBySerial.get(serialNumber.trim().toUpperCase());
  }

  async findLatestIssuedCertificateBySubjectReference(input: {
    readonly kind: typeof CertificateSubjectReferenceKinds[keyof typeof CertificateSubjectReferenceKinds];
    readonly referenceId: string;
    readonly workspaceId?: string;
  }): Promise<IssuedCertificatePersistenceRecord | undefined> {
    const candidates = [...this.certificatesBySerial.values()]
      .filter((record) => (
        record.subjectReference.kind === input.kind
        && record.subjectReference.referenceId === input.referenceId
        && record.subjectReference.workspaceId === input.workspaceId
      ))
      .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt));

    return candidates[0];
  }

  async listIssuedCertificates(query: IssuedCertificateLookupQuery): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>> {
    const rows = [...this.certificatesBySerial.values()].filter((row) => {
      if (query.certificateAuthorityId && row.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(row.status)) {
        return false;
      }
      if (query.subjectReferenceKinds && query.subjectReferenceKinds.length > 0 && !query.subjectReferenceKinds.includes(row.subjectReference.kind)) {
        return false;
      }
      if (query.subjectReferenceId && row.subjectReference.referenceId !== query.subjectReferenceId) {
        return false;
      }
      if (query.usageAnyOf && query.usageAnyOf.length > 0 && !query.usageAnyOf.some((usage) => row.usages.includes(usage))) {
        return false;
      }
      if (!query.includeRevoked && row.status === CertificateStatuses.revoked) {
        return false;
      }
      if (query.validAt) {
        const validAt = Date.parse(query.validAt);
        if (Date.parse(row.validity.notBefore) > validAt || Date.parse(row.validity.notAfter) <= validAt) {
          return false;
        }
      }
      if (query.issuedAfter && Date.parse(row.issuedAt) < Date.parse(query.issuedAfter)) {
        return false;
      }
      if (query.issuedBefore && Date.parse(row.issuedAt) > Date.parse(query.issuedBefore)) {
        return false;
      }
      return true;
    });

    return this.page(rows, query.limit, query.offset);
  }

  async saveIssuedCertificate(input: {
    readonly record: IssuedCertificatePersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as IssuedCertificatePersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const serial = input.record.serialNumber.trim().toUpperCase();
    const existing = this.certificatesBySerial.get(serial);
    const next: IssuedCertificatePersistenceRecord = Object.freeze({
      ...input.record,
      serialNumber: serial,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.certificatesBySerial.set(serial, next);
    const statusEventId = `status:${serial}:${next.status}:${next.lastModifiedAt}`;
    this.statusHistoryById.set(statusEventId, Object.freeze({
      statusEventId,
      certificateAuthorityId: next.certificateAuthorityId,
      serialNumber: next.serialNumber,
      previousStatus: existing?.status,
      currentStatus: next.status,
      occurredAt: next.lastModifiedAt,
      occurredBy: next.lastModifiedBy,
      reason: "save-issued-certificate",
    }));
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
  }

  async revokeIssuedCertificate(input: {
    readonly serialNumber: string;
    readonly revocation: IssuedCertificatePersistenceRecord["revocation"];
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const existing = this.certificatesBySerial.get(input.serialNumber.trim().toUpperCase());
    if (!existing) {
      throw new Error("Issued certificate not found.");
    }

    return this.saveIssuedCertificate({
      mutation: input.mutation,
      record: {
        ...existing,
        status: CertificateStatuses.revoked,
        revocation: input.revocation,
        supersededBySerialNumber: undefined,
      },
    });
  }

  async supersedeIssuedCertificate(input: {
    readonly serialNumber: string;
    readonly supersededBySerialNumber: string;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const existing = this.certificatesBySerial.get(input.serialNumber.trim().toUpperCase());
    if (!existing) {
      throw new Error("Issued certificate not found.");
    }

    return this.saveIssuedCertificate({
      mutation: input.mutation,
      record: {
        ...existing,
        status: CertificateStatuses.superseded,
        supersededBySerialNumber: input.supersededBySerialNumber.trim().toUpperCase(),
        revocation: undefined,
      },
    });
  }

  async findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined> {
    return this.trustMaterialsByRef.get(materialRef);
  }

  async findLatestStatusEventBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateStatusHistoryPersistenceRecord | undefined> {
    const normalizedSerial = serialNumber.trim().toUpperCase();
    return [...this.statusHistoryById.values()]
      .filter((event) => event.serialNumber === normalizedSerial)
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0];
  }

  async listCertificateStatusHistory(
    query: CertificateStatusHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateStatusHistoryPersistenceRecord>> {
    const rows = [...this.statusHistoryById.values()].filter((event) => {
      if (query.certificateAuthorityId && event.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.serialNumber && event.serialNumber !== query.serialNumber.trim().toUpperCase()) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(event.currentStatus)) {
        return false;
      }
      if (query.occurredAfter && Date.parse(event.occurredAt) < Date.parse(query.occurredAfter)) {
        return false;
      }
      if (query.occurredBefore && Date.parse(event.occurredAt) > Date.parse(query.occurredBefore)) {
        return false;
      }
      return true;
    }).sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

    return this.page(rows, query.limit, query.offset);
  }

  async appendCertificateStatusHistory(input: {
    readonly record: CertificateStatusHistoryPersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as CertificateStatusHistoryPersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const next = Object.freeze({
      ...input.record,
      serialNumber: input.record.serialNumber.trim().toUpperCase(),
      occurredBy: input.mutation.context.actorUserIdentityId,
      occurredAt: input.mutation.context.occurredAt ?? input.record.occurredAt,
    });
    this.statusHistoryById.set(next.statusEventId, next);
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  async findLatestCertificateRevocationBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateRevocationHistoryPersistenceRecord | undefined> {
    const normalizedSerial = serialNumber.trim().toUpperCase();
    return [...this.revocationsById.values()]
      .filter((revocation) => revocation.serialNumber === normalizedSerial)
      .sort((left, right) => Date.parse(right.revokedAt) - Date.parse(left.revokedAt))[0];
  }

  async listCertificateRevocations(
    query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>> {
    const rows = [...this.revocationsById.values()].filter((revocation) => {
      if (query.certificateAuthorityId && revocation.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.serialNumber && revocation.serialNumber !== query.serialNumber.trim().toUpperCase()) {
        return false;
      }
      if (query.reasons && query.reasons.length > 0 && !query.reasons.includes(revocation.reason)) {
        return false;
      }
      if (query.revokedAfter && Date.parse(revocation.revokedAt) < Date.parse(query.revokedAfter)) {
        return false;
      }
      if (query.revokedBefore && Date.parse(revocation.revokedAt) > Date.parse(query.revokedBefore)) {
        return false;
      }
      return true;
    }).sort((left, right) => Date.parse(right.revokedAt) - Date.parse(left.revokedAt));

    return this.page(rows, query.limit, query.offset);
  }

  async saveCertificateRevocation(input: {
    readonly record: CertificateRevocationHistoryPersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as CertificateRevocationHistoryPersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.revocationsById.get(input.record.revocationId);
    const next = Object.freeze({
      ...input.record,
      serialNumber: input.record.serialNumber.trim().toUpperCase(),
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.revocationsById.set(next.revocationId, next);
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
  }

  async listCertificateDistributionEvents(
    query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>> {
    const rows = [...this.distributionEventsById.values()].filter((event) => {
      if (query.materialRef && event.materialRef !== query.materialRef) {
        return false;
      }
      if (query.certificateAuthorityId && event.certificateAuthorityId !== query.certificateAuthorityId) {
        return false;
      }
      if (query.serialNumber && event.serialNumber !== query.serialNumber.trim().toUpperCase()) {
        return false;
      }
      if (query.targetKinds && query.targetKinds.length > 0 && !query.targetKinds.includes(event.targetKind)) {
        return false;
      }
      if (query.targetReferenceId && event.targetReferenceId !== query.targetReferenceId) {
        return false;
      }
      if (query.workspaceId && event.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(event.status)) {
        return false;
      }
      if (query.occurredAfter && Date.parse(event.occurredAt) < Date.parse(query.occurredAfter)) {
        return false;
      }
      if (query.occurredBefore && Date.parse(event.occurredAt) > Date.parse(query.occurredBefore)) {
        return false;
      }
      return true;
    }).sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

    return this.page(rows, query.limit, query.offset);
  }

  async saveCertificateDistributionEvent(input: {
    readonly record: CertificateDistributionEventPersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as CertificateDistributionEventPersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.distributionEventsById.get(input.record.distributionEventId);
    const next = Object.freeze({
      ...input.record,
      serialNumber: input.record.serialNumber?.trim().toUpperCase(),
      revision: existing ? existing.revision + 1 : 1,
      occurredBy: input.mutation.context.actorUserIdentityId,
      occurredAt: input.mutation.context.occurredAt ?? input.record.occurredAt,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.distributionEventsById.set(next.distributionEventId, next);
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
  }

  async listTrustMaterials(
    query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>> {
    const rows = [...this.trustMaterialsByRef.values()].filter((row) => {
      if (query.kinds && query.kinds.length > 0 && !query.kinds.includes(row.kind)) {
        return false;
      }
      if (query.materialRefPrefix && !row.materialRef.startsWith(query.materialRefPrefix)) {
        return false;
      }
      return true;
    });

    return this.page(rows, query.limit, query.offset);
  }

  async saveTrustMaterial(input: {
    readonly record: TrustMaterialReferencePersistenceRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly expectedRevision?: number;
      readonly context: {
        readonly actorUserIdentityId: string;
        readonly occurredAt?: string;
      };
    };
  }) {
    const operationKey = normalizeCertificateAuthorityMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay as TrustMaterialReferencePersistenceRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.trustMaterialsByRef.get(input.record.materialRef);
    const next: TrustMaterialReferencePersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.trustMaterialsByRef.set(next.materialRef, next);
    this.mutationReplayByOperationKey.set(operationKey, next);
    return Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = offset && offset > 0 ? offset : 0;
    const normalizedLimit = limit && limit > 0 ? limit : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

describe("certificate authority application ports and repository contracts", () => {
  it("supports authority initialization records, issuance, lookup, and revocation", async () => {
    const adapter = new InMemoryCertificateAuthorityPersistenceAdapter();
    const ports: CertificateAuthorityPersistencePorts = {
      certificateAuthorityRootPersistenceRepository: adapter,
      issuedCertificatePersistenceRepository: adapter,
      trustMaterialReferencePersistenceRepository: adapter,
      certificateLifecycleEventPersistenceRepository: adapter,
    };

    await ports.certificateAuthorityRootPersistenceRepository.saveCertificateAuthority({
      record: {
        certificateAuthorityId: "ca:internal:root:v1",
        displayName: "AI Loom Internal Root",
        status: CertificateAuthorityStatuses.active,
        subject: {
          commonName: "AI Loom Internal Root CA",
          organization: "AI Loom",
          dnsNames: ["ca.ai-loom.internal"],
          ipAddresses: [],
          uriSanEntries: [],
        },
        serialNumber: "A1B2C3",
        validity: {
          notBefore: "2026-04-05T12:00:00.000Z",
          notAfter: "2036-04-05T12:00:00.000Z",
        },
        signatureAlgorithm: "sha256WithRSAEncryption",
        rootCertificateMaterialRef: "trust:ca-root-cert:v1",
        rootPrivateKeyMaterialRef: "trust:ca-root-key:v1",
        rotationPolicy: {
          profileId: "rotation:default",
          autoRotateEnabled: true,
          rotateBeforeExpiryDays: 90,
          overlapDays: 30,
          maxLifetimeDays: 3650,
          nextRotationDueAt: "2035-01-01T00:00:00.000Z",
        },
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-ca-save-1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    await ports.issuedCertificatePersistenceRepository.saveIssuedCertificate({
      record: {
        certificateAuthorityId: "ca:internal:root:v1",
        serialNumber: "C0FFEE",
        status: CertificateStatuses.issued,
        subject: {
          commonName: "node-01.ai-loom.internal",
          dnsNames: ["node-01.ai-loom.internal"],
          ipAddresses: [],
          uriSanEntries: [],
        },
        subjectReference: {
          kind: CertificateSubjectReferenceKinds.node,
          referenceId: "node:01",
        },
        usages: [
          CertificateUsageKinds.serverAuth,
          CertificateUsageKinds.clientAuth,
        ],
        validity: {
          notBefore: "2026-04-05T12:00:00.000Z",
          notAfter: "2027-04-05T12:00:00.000Z",
        },
        issuedAt: "2026-04-05T12:00:00.000Z",
        certificateMaterialRef: "trust:cert:node-01:v1",
        certificateChainMaterialRef: "trust:cert-chain:root:v1",
        trustMaterialRef: "trust:bundle:node-01:v1",
        publicKeyAlgorithm: "rsa-4096",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-cert-save-1",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const revoked = await ports.issuedCertificatePersistenceRepository.revokeIssuedCertificate({
      serialNumber: "C0FFEE",
      revocation: {
        reason: CertificateRevocationReasons.policyViolation,
        revokedAt: "2026-07-01T00:00:00.000Z",
        revokedByActorId: "user:security-admin",
        note: "certificate rotated after policy event",
      },
      mutation: {
        operationKey: "op-cert-revoke-1",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2026-07-01T00:00:00.000Z",
        },
      },
    });

    const activeRoot = await ports.certificateAuthorityRootPersistenceRepository.findActiveCertificateAuthority(
      "2026-06-01T00:00:00.000Z",
    );
    const revokedCertificates = await ports.issuedCertificatePersistenceRepository.listIssuedCertificates({
      statuses: CertificateAuthorityPersistenceQueryPresets.revokedCertificateStatuses,
      includeRevoked: true,
    });
    const statusHistory = await ports.certificateLifecycleEventPersistenceRepository.listCertificateStatusHistory({
      serialNumber: "C0FFEE",
    });

    expect(activeRoot?.certificateAuthorityId).toBe("ca:internal:root:v1");
    expect(revoked.record.status).toBe(CertificateStatuses.revoked);
    expect(revoked.record.revocation?.reason).toBe(CertificateRevocationReasons.policyViolation);
    expect(revokedCertificates).toHaveLength(1);
    expect(statusHistory.length).toBeGreaterThanOrEqual(2);
  });

  it("supports rotation policy updates and trust material references", async () => {
    const adapter = new InMemoryCertificateAuthorityPersistenceAdapter();
    const ports: CertificateAuthorityPersistencePorts = {
      certificateAuthorityRootPersistenceRepository: adapter,
      issuedCertificatePersistenceRepository: adapter,
      trustMaterialReferencePersistenceRepository: adapter,
      certificateLifecycleEventPersistenceRepository: adapter,
    };

    await ports.certificateAuthorityRootPersistenceRepository.saveCertificateAuthority({
      record: {
        certificateAuthorityId: "ca:internal:root:v2",
        displayName: "AI Loom Internal Root v2",
        status: CertificateAuthorityStatuses.active,
        subject: {
          commonName: "AI Loom Internal Root CA v2",
          dnsNames: [],
          ipAddresses: [],
          uriSanEntries: [],
        },
        serialNumber: "B1C2D3",
        validity: {
          notBefore: "2027-01-01T00:00:00.000Z",
          notAfter: "2037-01-01T00:00:00.000Z",
        },
        signatureAlgorithm: "sha384WithRSAEncryption",
        rootCertificateMaterialRef: "trust:ca-root-cert:v2",
        rootPrivateKeyMaterialRef: "trust:ca-root-key:v2",
        rotationPolicy: {
          profileId: "rotation:default",
          autoRotateEnabled: true,
          rotateBeforeExpiryDays: 90,
          overlapDays: 30,
          maxLifetimeDays: 3650,
        },
        createdAt: "2027-01-01T00:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2027-01-01T00:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-ca-save-v2",
        context: {
          actorUserIdentityId: "user:admin",
          occurredAt: "2027-01-01T00:00:00.000Z",
        },
      },
    });

    const rotationUpdate = await ports.certificateAuthorityRootPersistenceRepository.updateCertificateAuthorityRotationPolicy({
      certificateAuthorityId: "ca:internal:root:v2",
      rotationPolicy: {
        profileId: "rotation:default",
        autoRotateEnabled: true,
        rotateBeforeExpiryDays: 180,
        overlapDays: 45,
        maxLifetimeDays: 3650,
        nextRotationDueAt: "2036-01-01T00:00:00.000Z",
      },
      mutation: {
        operationKey: "op-ca-rotation-v2",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2028-01-01T00:00:00.000Z",
        },
      },
    });

    await ports.trustMaterialReferencePersistenceRepository.saveTrustMaterial({
      record: {
        materialRef: "trust:bundle:root:v2",
        kind: "certificate-chain-pem",
        storageLocator: "vault://ca/trust/bundle/root-v2",
        fingerprintSha256: "AA-BB-CC",
        createdAt: "2028-01-01T00:00:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2028-01-01T00:00:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-trust-save-v2",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2028-01-01T00:00:00.000Z",
        },
      },
    });

    const trustMaterials = await ports.trustMaterialReferencePersistenceRepository.listTrustMaterials({
      kinds: ["certificate-chain-pem"],
    });
    const distributionSaved = await ports.certificateLifecycleEventPersistenceRepository.saveCertificateDistributionEvent({
      record: {
        distributionEventId: "distribution:root:v2:node-01",
        materialRef: "trust:bundle:root:v2",
        certificateAuthorityId: "ca:internal:root:v2",
        targetKind: "node",
        targetReferenceId: "node:01",
        transport: "node-trust-bundle-sync",
        status: "published",
        occurredAt: "2028-01-01T00:00:00.000Z",
        occurredBy: "user:security-admin",
        createdAt: "2028-01-01T00:00:00.000Z",
        createdBy: "user:security-admin",
        lastModifiedAt: "2028-01-01T00:00:00.000Z",
        lastModifiedBy: "user:security-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-distribution-save-v2",
        context: {
          actorUserIdentityId: "user:security-admin",
          occurredAt: "2028-01-01T00:00:00.000Z",
        },
      },
    });
    const distributionEvents = await ports.certificateLifecycleEventPersistenceRepository.listCertificateDistributionEvents({
      targetKinds: ["node"],
    });

    expect(rotationUpdate.record.rotationPolicy.rotateBeforeExpiryDays).toBe(180);
    expect(trustMaterials).toHaveLength(1);
    expect(trustMaterials[0]?.materialRef).toBe("trust:bundle:root:v2");
    expect(distributionSaved.record.status).toBe("published");
    expect(distributionEvents).toHaveLength(1);
  });
});
