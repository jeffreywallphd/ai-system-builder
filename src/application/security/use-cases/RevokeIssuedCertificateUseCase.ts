import {
  type CertificateRevocationReason,
  CertificateRevocationReasons,
  CertificateStatuses,
  createCertificateSerialNumber,
  createCertificateSubjectDescriptor,
  createCertificateValidityWindow,
  createIssuedCertificate,
  revokeIssuedCertificate,
} from "@domain/security/CertificateAuthorityDomain";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  normalizeCertificateAuthorityMutationOperationKey,
  type CertificateRevocationPersistenceRecord,
  type IssuedCertificatePersistenceRecord,
} from "@shared/dto/security/CertificateAuthorityDtos";
import {
  publishCertificateLifecycleAuditEventBestEffort,
  type CertificateLifecycleAuditSink,
} from "../ports/CertificateLifecycleAuditPorts";

export class RevokeIssuedCertificateInvalidRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RevokeIssuedCertificateInvalidRequestError";
  }
}

export class IssuedCertificateAlreadyRevokedError extends Error {
  public constructor(serialNumber: string) {
    super(`Issued certificate '${serialNumber}' is already revoked.`);
    this.name = "IssuedCertificateAlreadyRevokedError";
  }
}

export interface RevokeIssuedCertificateUseCaseInput {
  readonly operationKey: string;
  readonly serialNumber: string;
  readonly revocationReason: CertificateRevocationReason;
  readonly actorUserIdentityId: string;
  readonly revokedAt?: string;
  readonly note?: string;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface RevokeIssuedCertificateUseCaseResult {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly previousStatus: IssuedCertificatePersistenceRecord["status"];
  readonly currentStatus: IssuedCertificatePersistenceRecord["status"];
  readonly revokedAt: string;
  readonly revocation: CertificateRevocationPersistenceRecord;
}

export interface RevokeIssuedCertificateUseCaseDependencies {
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly certificateLifecycleEventRepository: ICertificateLifecycleEventPersistenceRepository;
  readonly auditSink?: CertificateLifecycleAuditSink;
  readonly auditHook?: (event: CertificateRevocationAuditEvent) => Promise<void> | void;
}

export type CertificateRevocationAuditEvent =
  | {
    readonly event: "certificate-revocation-started";
    readonly operationKey: string;
    readonly serialNumber: string;
    readonly actorUserIdentityId: string;
    readonly certificateAuthorityId?: string;
    readonly revocationReason: CertificateRevocationReason;
    readonly occurredAt: string;
  }
  | {
    readonly event: "certificate-revocation-succeeded";
    readonly operationKey: string;
    readonly serialNumber: string;
    readonly actorUserIdentityId: string;
    readonly certificateAuthorityId: string;
    readonly previousStatus: IssuedCertificatePersistenceRecord["status"];
    readonly currentStatus: IssuedCertificatePersistenceRecord["status"];
    readonly revocationReason: CertificateRevocationReason;
    readonly occurredAt: string;
  }
  | {
    readonly event: "certificate-revocation-failed";
    readonly operationKey: string;
    readonly serialNumber: string;
    readonly actorUserIdentityId: string;
    readonly certificateAuthorityId?: string;
    readonly revocationReason: CertificateRevocationReason;
    readonly code: string;
    readonly message: string;
    readonly occurredAt: string;
  };

export class RevokeIssuedCertificateUseCase {
  public constructor(private readonly dependencies: RevokeIssuedCertificateUseCaseDependencies) {}

  public async execute(input: RevokeIssuedCertificateUseCaseInput): Promise<RevokeIssuedCertificateUseCaseResult> {
    const normalized = normalizeInput(input);
    await this.emitAudit({
      event: "certificate-revocation-started",
      operationKey: normalized.operationKey,
      serialNumber: normalized.serialNumber,
      actorUserIdentityId: normalized.actorUserIdentityId,
      revocationReason: normalized.revocationReason,
      occurredAt: normalized.revokedAt,
    });

    let certificateAuthorityId: string | undefined;
    try {
      const existing = await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(
        normalized.serialNumber,
      );

      if (!existing) {
        throw new RevokeIssuedCertificateInvalidRequestError(
          `Issued certificate '${normalized.serialNumber}' was not found.`,
        );
      }

      certificateAuthorityId = existing.certificateAuthorityId;

      if (existing.status === CertificateStatuses.revoked) {
        throw new IssuedCertificateAlreadyRevokedError(normalized.serialNumber);
      }

      if (existing.status !== CertificateStatuses.issued) {
        throw new RevokeIssuedCertificateInvalidRequestError(
          `Issued certificate '${normalized.serialNumber}' cannot be revoked from status '${existing.status}'.`,
        );
      }

      const domainCertificate = createIssuedCertificate({
        certificateAuthorityId: existing.certificateAuthorityId,
        serialNumber: createCertificateSerialNumber(existing.serialNumber),
        status: existing.status,
        subject: createCertificateSubjectDescriptor(existing.subject),
        subjectReference: existing.subjectReference,
        usages: existing.usages,
        validity: createCertificateValidityWindow(existing.validity),
        issuedAt: existing.issuedAt,
        certificateMaterialRef: existing.certificateMaterialRef,
        certificateChainMaterialRef: existing.certificateChainMaterialRef,
        trustMaterialRef: existing.trustMaterialRef,
        publicKeyAlgorithm: existing.publicKeyAlgorithm,
        publicKeyFingerprintSha256: existing.publicKeyFingerprintSha256,
        revocation: existing.revocation,
        supersededBySerialNumber: existing.supersededBySerialNumber,
        createdAt: existing.createdAt,
        updatedAt: existing.lastModifiedAt,
      });

      const revokedDomainCertificate = revokeIssuedCertificate(domainCertificate, {
        reason: normalized.revocationReason,
        revokedAt: normalized.revokedAt,
        revokedByActorId: normalized.actorUserIdentityId,
        note: normalized.note,
      });

      const revokedAt = revokedDomainCertificate.revocation?.revokedAt as string;
      const revocation: CertificateRevocationPersistenceRecord = Object.freeze({
        reason: revokedDomainCertificate.revocation?.reason as CertificateRevocationReason,
        revokedAt,
        revokedByActorId: revokedDomainCertificate.revocation?.revokedByActorId,
        note: revokedDomainCertificate.revocation?.note,
      });

      const revokeResult = await this.dependencies.issuedCertificateRepository.revokeIssuedCertificate({
        serialNumber: normalized.serialNumber,
        revocation,
        mutation: {
          operationKey: `${normalized.operationKey}:revoke-issued-certificate`,
          context: {
            actorUserIdentityId: normalized.actorUserIdentityId,
            occurredAt: revokedAt,
            reason: normalized.reason,
            correlationId: normalized.correlationId,
          },
        },
      });

      const existingRevocation = await this.dependencies.certificateLifecycleEventRepository
        .findLatestCertificateRevocationBySerialNumber(normalized.serialNumber);

      if (!existingRevocation || existingRevocation.revokedAt !== revokedAt || existingRevocation.reason !== revocation.reason) {
        await this.dependencies.certificateLifecycleEventRepository.saveCertificateRevocation({
          mutation: {
            operationKey: `${normalized.operationKey}:save-revocation-history`,
            context: {
              actorUserIdentityId: normalized.actorUserIdentityId,
              occurredAt: revokedAt,
              reason: normalized.reason,
              correlationId: normalized.correlationId,
            },
          },
          record: Object.freeze({
            revocationId: toRevocationId(normalized.serialNumber, revokedAt),
            certificateAuthorityId: revokeResult.record.certificateAuthorityId,
            serialNumber: normalized.serialNumber,
            reason: revocation.reason,
            revokedAt,
            revokedByActorId: revocation.revokedByActorId,
            note: revocation.note,
            createdAt: revokedAt,
            createdBy: normalized.actorUserIdentityId,
            lastModifiedAt: revokedAt,
            lastModifiedBy: normalized.actorUserIdentityId,
            revision: 0,
          }),
        });
      }

      const result = Object.freeze({
        certificateAuthorityId: revokeResult.record.certificateAuthorityId,
        serialNumber: revokeResult.record.serialNumber,
        previousStatus: existing.status,
        currentStatus: revokeResult.record.status,
        revokedAt,
        revocation,
      });

      await this.emitAudit({
        event: "certificate-revocation-succeeded",
        operationKey: normalized.operationKey,
        serialNumber: normalized.serialNumber,
        actorUserIdentityId: normalized.actorUserIdentityId,
        certificateAuthorityId: result.certificateAuthorityId,
        previousStatus: result.previousStatus,
        currentStatus: result.currentStatus,
        revocationReason: result.revocation.reason,
        occurredAt: result.revokedAt,
      });

      return result;
    } catch (error) {
      await this.emitAudit({
        event: "certificate-revocation-failed",
        operationKey: normalized.operationKey,
        serialNumber: normalized.serialNumber,
        actorUserIdentityId: normalized.actorUserIdentityId,
        certificateAuthorityId,
        revocationReason: normalized.revocationReason,
        code: toErrorCode(error),
        message: toErrorMessage(error),
        occurredAt: normalized.revokedAt,
      });
      throw error;
    }
  }

  private async emitAudit(event: CertificateRevocationAuditEvent): Promise<void> {
    if (this.dependencies.auditHook) {
      try {
        await this.dependencies.auditHook(event);
      } catch {
        // Intentionally non-fatal.
      }
    }

    await publishCertificateLifecycleAuditEventBestEffort(this.dependencies.auditSink, {
      type: event.event,
      actorUserIdentityId: event.actorUserIdentityId,
      occurredAt: event.occurredAt,
      certificateAuthorityId: event.certificateAuthorityId,
      serialNumber: event.serialNumber,
      details: toAuditDetails(event),
    });
  }
}

function normalizeInput(input: RevokeIssuedCertificateUseCaseInput): {
  readonly operationKey: string;
  readonly serialNumber: string;
  readonly revocationReason: CertificateRevocationReason;
  readonly actorUserIdentityId: string;
  readonly revokedAt: string;
  readonly note?: string;
  readonly reason?: string;
  readonly correlationId?: string;
} {
  const revocationReason = input.revocationReason;
  if (!Object.values(CertificateRevocationReasons).includes(revocationReason)) {
    throw new RevokeIssuedCertificateInvalidRequestError(
      `Certificate revocation reason '${String(input.revocationReason)}' is invalid.`,
    );
  }

  return Object.freeze({
    operationKey: normalizeCertificateAuthorityMutationOperationKey(input.operationKey),
    serialNumber: normalizeSerial(input.serialNumber),
    revocationReason,
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId"),
    revokedAt: normalizeTimestamp(input.revokedAt),
    note: normalizeOptional(input.note),
    reason: normalizeOptional(input.reason),
    correlationId: normalizeOptional(input.correlationId),
  });
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new RevokeIssuedCertificateInvalidRequestError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSerial(serialNumber: string): string {
  const normalized = normalizeRequired(serialNumber, "serialNumber").toUpperCase();
  if (!/^[0-9A-F]{2,64}$/.test(normalized)) {
    throw new RevokeIssuedCertificateInvalidRequestError(
      "serialNumber must be a hexadecimal string (2-64 chars).",
    );
  }
  return normalized;
}

function normalizeTimestamp(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RevokeIssuedCertificateInvalidRequestError("revokedAt must be a valid timestamp when provided.");
  }

  return parsed.toISOString();
}

function toRevocationId(serialNumber: string, revokedAt: string): string {
  return `revocation:${serialNumber}:${Date.parse(revokedAt)}`;
}

function toErrorCode(error: unknown): string {
  if (error instanceof IssuedCertificateAlreadyRevokedError) {
    return "certificate-revocation-already-revoked";
  }
  if (error instanceof RevokeIssuedCertificateInvalidRequestError) {
    return "certificate-revocation-invalid-request";
  }
  return "certificate-revocation-failed";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "certificate revocation failed";
}

function toAuditDetails(event: CertificateRevocationAuditEvent): Readonly<Record<string, unknown>> {
  switch (event.event) {
    case "certificate-revocation-started":
      return Object.freeze({
        operationKey: event.operationKey,
        revocationReason: event.revocationReason,
      });
    case "certificate-revocation-succeeded":
      return Object.freeze({
        operationKey: event.operationKey,
        previousStatus: event.previousStatus,
        currentStatus: event.currentStatus,
        revocationReason: event.revocationReason,
      });
    case "certificate-revocation-failed":
      return Object.freeze({
        operationKey: event.operationKey,
        revocationReason: event.revocationReason,
        code: event.code,
        message: event.message,
      });
    default:
      return Object.freeze({});
  }
}

