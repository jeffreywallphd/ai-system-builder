import { CertificateStatuses, type CertificateStatus } from "../../../domain/security/CertificateAuthorityDomain";
import { CertificateSubjectProfileKinds, type CertificateSubjectProfileKind } from "../../../domain/security/CertificateIssuancePolicyDomain";
import type { ICertificateAuthorityIssuerPort } from "../ports/ICertificateAuthorityIssuerPort";
import type { ICertificateAuthorityRootMaterialStorage } from "../ports/ICertificateAuthorityRootMaterialStorage";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import type { INodeCertificateEligibilityPort } from "../ports/INodeCertificateEligibilityPort";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";
import {
  publishCertificateLifecycleAuditEventBestEffort,
  type CertificateLifecycleAuditSink,
} from "../ports/CertificateLifecycleAuditPorts";
import {
  CertificateIssuancePolicyViolationError,
  IssueCertificateForSubjectUseCase,
} from "./IssueCertificateForSubjectUseCase";
import { normalizeCertificateAuthorityMutationOperationKey, type IssuedCertificatePersistenceRecord } from "../../../shared/dto/security/CertificateAuthorityDtos";

const MillisecondsPerDay = 24 * 60 * 60 * 1000;

export const CertificateRenewalDispositionKinds = Object.freeze({
  supersede: "supersede",
  preserve: "preserve",
});

export type CertificateRenewalDispositionKind =
  typeof CertificateRenewalDispositionKinds[keyof typeof CertificateRenewalDispositionKinds];

export class RenewIssuedCertificateInvalidRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RenewIssuedCertificateInvalidRequestError";
  }
}

export class IssuedCertificateRenewalNotAllowedError extends Error {
  public constructor(serialNumber: string, status: CertificateStatus) {
    super(`Issued certificate '${serialNumber}' cannot be renewed from status '${status}'.`);
    this.name = "IssuedCertificateRenewalNotAllowedError";
  }
}

export interface RenewIssuedCertificateUseCaseInput {
  readonly operationKey: string;
  readonly serialNumber: string;
  readonly actorUserIdentityId: string;
  readonly validityDays?: number;
  readonly publicKeyPem: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly signatureAlgorithm?: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly certificateMaterialSecretRef?: string;
  readonly certificateMaterialKeyScope?: string;
  readonly certificateChainMaterialSecretRef?: string;
  readonly certificateChainMaterialKeyScope?: string;
  readonly previousCertificateDisposition?: CertificateRenewalDispositionKind;
  readonly gracePeriodDays?: number;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface RenewIssuedCertificateUseCaseResult {
  readonly previousSerialNumber: string;
  readonly replacementSerialNumber: string;
  readonly certificateAuthorityId: string;
  readonly profileKind: CertificateSubjectProfileKind;
  readonly previousCertificateDisposition: CertificateRenewalDispositionKind;
  readonly gracePeriodDays: number;
  readonly replacedAt: string;
}

export interface RenewIssuedCertificateUseCaseDependencies {
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly trustMaterialRepository: ITrustMaterialReferencePersistenceRepository;
  readonly certificateMaterialStorage: ICertificateAuthorityRootMaterialStorage;
  readonly issuer: ICertificateAuthorityIssuerPort;
  readonly nodeCertificateEligibilityPort?: INodeCertificateEligibilityPort;
  readonly issueCertificateForSubjectUseCase?: IssueCertificateForSubjectUseCase;
  readonly auditSink?: CertificateLifecycleAuditSink;
  readonly auditHook?: (event: CertificateRenewalAuditEvent) => Promise<void> | void;
}

export type CertificateRenewalAuditEvent =
  | {
    readonly event: "certificate-renewal-started";
    readonly operationKey: string;
    readonly serialNumber: string;
    readonly actorUserIdentityId: string;
    readonly occurredAt: string;
  }
  | {
    readonly event: "certificate-renewal-succeeded";
    readonly operationKey: string;
    readonly previousSerialNumber: string;
    readonly replacementSerialNumber: string;
    readonly certificateAuthorityId: string;
    readonly profileKind: CertificateSubjectProfileKind;
    readonly actorUserIdentityId: string;
    readonly occurredAt: string;
    readonly previousCertificateDisposition: CertificateRenewalDispositionKind;
    readonly gracePeriodDays: number;
  }
  | {
    readonly event: "certificate-renewal-failed";
    readonly operationKey: string;
    readonly serialNumber: string;
    readonly actorUserIdentityId: string;
    readonly certificateAuthorityId?: string;
    readonly occurredAt: string;
    readonly code: string;
    readonly message: string;
  };

export class RenewIssuedCertificateUseCase {
  private readonly issueCertificateForSubjectUseCase: IssueCertificateForSubjectUseCase;

  public constructor(private readonly dependencies: RenewIssuedCertificateUseCaseDependencies) {
    this.issueCertificateForSubjectUseCase = dependencies.issueCertificateForSubjectUseCase
      ?? new IssueCertificateForSubjectUseCase({
        certificateAuthorityRepository: dependencies.certificateAuthorityRepository,
        issuedCertificateRepository: dependencies.issuedCertificateRepository,
        trustMaterialRepository: dependencies.trustMaterialRepository,
        certificateMaterialStorage: dependencies.certificateMaterialStorage,
        issuer: dependencies.issuer,
        nodeCertificateEligibilityPort: dependencies.nodeCertificateEligibilityPort,
        auditSink: dependencies.auditSink,
      });
  }

  public async execute(input: RenewIssuedCertificateUseCaseInput): Promise<RenewIssuedCertificateUseCaseResult> {
    const normalized = normalizeInput(input);
    await this.emitAudit({
      event: "certificate-renewal-started",
      operationKey: normalized.operationKey,
      serialNumber: normalized.serialNumber,
      actorUserIdentityId: normalized.actorUserIdentityId,
      occurredAt: normalized.occurredAt,
    });

    let certificateAuthorityId: string | undefined;
    try {
      const existing = await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(
        normalized.serialNumber,
      );

      if (!existing) {
        throw new RenewIssuedCertificateInvalidRequestError(
          `Issued certificate '${normalized.serialNumber}' was not found.`,
        );
      }

      certificateAuthorityId = existing.certificateAuthorityId;
      assertRenewalEligible(existing);

      const profileKind = resolveProfileKind(existing);
      const replacement = await this.issueCertificateForSubjectUseCase.execute({
        operationKey: `${normalized.operationKey}:issue-replacement`,
        profileKind,
        certificateAuthorityId: existing.certificateAuthorityId,
        subject: existing.subject,
        subjectReference: existing.subjectReference,
        usages: existing.usages,
        validityDays: normalized.validityDays ?? resolveDefaultValidityDays(existing),
        actorUserIdentityId: normalized.actorUserIdentityId,
        publicKeyPem: normalized.publicKeyPem,
        publicKeyAlgorithm: normalized.publicKeyAlgorithm,
        publicKeyFingerprintSha256: normalized.publicKeyFingerprintSha256,
        signatureAlgorithm: normalized.signatureAlgorithm,
        certificateMaterialRef: normalized.certificateMaterialRef,
        certificateChainMaterialRef: normalized.certificateChainMaterialRef,
        trustMaterialRef: normalized.trustMaterialRef,
        certificateMaterialSecretRef: normalized.certificateMaterialSecretRef,
        certificateMaterialKeyScope: normalized.certificateMaterialKeyScope,
        certificateChainMaterialSecretRef: normalized.certificateChainMaterialSecretRef,
        certificateChainMaterialKeyScope: normalized.certificateChainMaterialKeyScope,
        occurredAt: normalized.occurredAt,
        reason: normalized.reason,
        correlationId: normalized.correlationId,
      });

      if (normalized.previousCertificateDisposition === CertificateRenewalDispositionKinds.supersede) {
        await this.dependencies.issuedCertificateRepository.supersedeIssuedCertificate({
          serialNumber: existing.serialNumber,
          supersededBySerialNumber: replacement.serialNumber,
          mutation: {
            operationKey: `${normalized.operationKey}:supersede-previous`,
            context: {
              actorUserIdentityId: normalized.actorUserIdentityId,
              occurredAt: normalized.occurredAt,
              reason: normalized.reason ?? "certificate-renewal-replacement",
              correlationId: normalized.correlationId,
            },
          },
        });
      }

      const result = Object.freeze({
        previousSerialNumber: existing.serialNumber,
        replacementSerialNumber: replacement.serialNumber,
        certificateAuthorityId: replacement.certificateAuthorityId,
        profileKind,
        previousCertificateDisposition: normalized.previousCertificateDisposition,
        gracePeriodDays: normalized.gracePeriodDays,
        replacedAt: normalized.occurredAt,
      });

      await this.emitAudit({
        event: "certificate-renewal-succeeded",
        operationKey: normalized.operationKey,
        previousSerialNumber: existing.serialNumber,
        replacementSerialNumber: replacement.serialNumber,
        certificateAuthorityId: replacement.certificateAuthorityId,
        profileKind,
        actorUserIdentityId: normalized.actorUserIdentityId,
        occurredAt: normalized.occurredAt,
        previousCertificateDisposition: normalized.previousCertificateDisposition,
        gracePeriodDays: normalized.gracePeriodDays,
      });

      return result;
    } catch (error) {
      await this.emitAudit({
        event: "certificate-renewal-failed",
        operationKey: normalized.operationKey,
        serialNumber: normalized.serialNumber,
        actorUserIdentityId: normalized.actorUserIdentityId,
        certificateAuthorityId,
        occurredAt: normalized.occurredAt,
        code: toErrorCode(error),
        message: toErrorMessage(error),
      });
      throw error;
    }
  }

  private async emitAudit(event: CertificateRenewalAuditEvent): Promise<void> {
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
      certificateAuthorityId: "certificateAuthorityId" in event ? event.certificateAuthorityId : undefined,
      serialNumber: event.event === "certificate-renewal-succeeded"
        ? event.replacementSerialNumber
        : event.serialNumber,
      details: toAuditDetails(event),
    });
  }
}

function normalizeInput(input: RenewIssuedCertificateUseCaseInput): {
  readonly operationKey: string;
  readonly serialNumber: string;
  readonly actorUserIdentityId: string;
  readonly validityDays?: number;
  readonly publicKeyPem: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly signatureAlgorithm?: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly certificateMaterialSecretRef?: string;
  readonly certificateMaterialKeyScope?: string;
  readonly certificateChainMaterialSecretRef?: string;
  readonly certificateChainMaterialKeyScope?: string;
  readonly previousCertificateDisposition: CertificateRenewalDispositionKind;
  readonly gracePeriodDays: number;
  readonly occurredAt: string;
  readonly reason?: string;
  readonly correlationId?: string;
} {
  const validityDays = input.validityDays;
  if (validityDays !== undefined && (!Number.isInteger(validityDays) || validityDays < 1)) {
    throw new RenewIssuedCertificateInvalidRequestError("validityDays must be an integer >= 1 when provided.");
  }

  const previousCertificateDisposition = input.previousCertificateDisposition
    ?? CertificateRenewalDispositionKinds.supersede;
  if (!Object.values(CertificateRenewalDispositionKinds).includes(previousCertificateDisposition)) {
    throw new RenewIssuedCertificateInvalidRequestError(
      `previousCertificateDisposition '${String(input.previousCertificateDisposition)}' is invalid.`,
    );
  }

  const gracePeriodDays = input.gracePeriodDays ?? 0;
  if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
    throw new RenewIssuedCertificateInvalidRequestError("gracePeriodDays must be an integer >= 0 when provided.");
  }

  if (gracePeriodDays > 0 && previousCertificateDisposition === CertificateRenewalDispositionKinds.supersede) {
    throw new RenewIssuedCertificateInvalidRequestError(
      "gracePeriodDays > 0 requires previousCertificateDisposition='preserve' for overlap operation.",
    );
  }

  return Object.freeze({
    operationKey: normalizeCertificateAuthorityMutationOperationKey(input.operationKey),
    serialNumber: normalizeSerial(input.serialNumber),
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId"),
    validityDays,
    publicKeyPem: normalizeRequired(input.publicKeyPem, "publicKeyPem"),
    publicKeyAlgorithm: normalizeRequired(input.publicKeyAlgorithm, "publicKeyAlgorithm"),
    publicKeyFingerprintSha256: normalizeOptional(input.publicKeyFingerprintSha256),
    signatureAlgorithm: normalizeOptional(input.signatureAlgorithm),
    certificateMaterialRef: normalizeRequired(input.certificateMaterialRef, "certificateMaterialRef"),
    certificateChainMaterialRef: normalizeOptional(input.certificateChainMaterialRef),
    trustMaterialRef: normalizeOptional(input.trustMaterialRef),
    certificateMaterialSecretRef: normalizeOptional(input.certificateMaterialSecretRef),
    certificateMaterialKeyScope: normalizeOptional(input.certificateMaterialKeyScope),
    certificateChainMaterialSecretRef: normalizeOptional(input.certificateChainMaterialSecretRef),
    certificateChainMaterialKeyScope: normalizeOptional(input.certificateChainMaterialKeyScope),
    previousCertificateDisposition,
    gracePeriodDays,
    occurredAt: normalizeTimestamp(input.occurredAt),
    reason: normalizeOptional(input.reason),
    correlationId: normalizeOptional(input.correlationId),
  });
}

function assertRenewalEligible(certificate: IssuedCertificatePersistenceRecord): void {
  if (certificate.status === CertificateStatuses.revoked || certificate.status === CertificateStatuses.superseded) {
    throw new IssuedCertificateRenewalNotAllowedError(certificate.serialNumber, certificate.status);
  }

  if (certificate.status !== CertificateStatuses.issued && certificate.status !== CertificateStatuses.expired) {
    throw new IssuedCertificateRenewalNotAllowedError(certificate.serialNumber, certificate.status);
  }
}

function resolveProfileKind(certificate: IssuedCertificatePersistenceRecord): CertificateSubjectProfileKind {
  const reference = certificate.subjectReference;
  if (reference.kind === "node") {
    return CertificateSubjectProfileKinds.approvedNode;
  }

  if (reference.kind === "service") {
    if (reference.referenceId.startsWith("server:")) {
      return CertificateSubjectProfileKinds.authoritativeServer;
    }
    if (reference.referenceId.startsWith("service:")) {
      return CertificateSubjectProfileKinds.internalService;
    }
  }

  throw new RenewIssuedCertificateInvalidRequestError(
    `Issued certificate '${certificate.serialNumber}' subject reference '${reference.kind}:${reference.referenceId}' does not map to a renewable profile.`,
  );
}

function resolveDefaultValidityDays(certificate: IssuedCertificatePersistenceRecord): number {
  const notBeforeEpoch = Date.parse(certificate.validity.notBefore);
  const notAfterEpoch = Date.parse(certificate.validity.notAfter);
  if (Number.isNaN(notBeforeEpoch) || Number.isNaN(notAfterEpoch) || notAfterEpoch <= notBeforeEpoch) {
    throw new RenewIssuedCertificateInvalidRequestError(
      `Issued certificate '${certificate.serialNumber}' has an invalid validity window.`,
    );
  }

  return Math.max(1, Math.ceil((notAfterEpoch - notBeforeEpoch) / MillisecondsPerDay));
}

function normalizeSerial(serialNumber: string): string {
  const normalized = normalizeRequired(serialNumber, "serialNumber").toUpperCase();
  if (!/^[0-9A-F]{2,64}$/.test(normalized)) {
    throw new RenewIssuedCertificateInvalidRequestError("serialNumber must be a hexadecimal string (2-64 chars).");
  }
  return normalized;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new RenewIssuedCertificateInvalidRequestError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RenewIssuedCertificateInvalidRequestError("occurredAt must be a valid timestamp when provided.");
  }

  return parsed.toISOString();
}

function toErrorCode(error: unknown): string {
  if (error instanceof CertificateIssuancePolicyViolationError) {
    return "certificate-renewal-policy-violation";
  }
  if (error instanceof IssuedCertificateRenewalNotAllowedError) {
    return "certificate-renewal-not-allowed";
  }
  if (error instanceof RenewIssuedCertificateInvalidRequestError) {
    return "certificate-renewal-invalid-request";
  }
  return "certificate-renewal-failed";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "certificate renewal failed";
}

function toAuditDetails(event: CertificateRenewalAuditEvent): Readonly<Record<string, unknown>> {
  switch (event.event) {
    case "certificate-renewal-started":
      return Object.freeze({
        operationKey: event.operationKey,
        serialNumber: event.serialNumber,
      });
    case "certificate-renewal-succeeded":
      return Object.freeze({
        operationKey: event.operationKey,
        previousSerialNumber: event.previousSerialNumber,
        replacementSerialNumber: event.replacementSerialNumber,
        profileKind: event.profileKind,
        previousCertificateDisposition: event.previousCertificateDisposition,
        gracePeriodDays: event.gracePeriodDays,
      });
    case "certificate-renewal-failed":
      return Object.freeze({
        operationKey: event.operationKey,
        serialNumber: event.serialNumber,
        code: event.code,
        message: event.message,
      });
    default:
      return Object.freeze({});
  }
}
