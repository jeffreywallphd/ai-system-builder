import { CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import type {
  CertificateLinkedSubjectTrustState,
  CertificateTrustEvaluationStatus,
  CertificateTrustEvaluationViewDto,
  IssuedCertificatePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import { CertificateTrustEvaluationStatuses } from "../../../shared/dto/security/CertificateAuthorityDtos";

export interface CertificateTrustEvaluationClock {
  now(): Date;
}

export interface EvaluateIssuedCertificateTrustInput {
  readonly serialNumber: string;
  readonly certificate?: IssuedCertificatePersistenceRecord;
  readonly asOf?: string;
  readonly linkedSubjectState?: CertificateLinkedSubjectTrustState;
}

export class CertificateTrustEvaluationService {
  private readonly clock: CertificateTrustEvaluationClock;

  public constructor(dependencies?: { readonly clock?: CertificateTrustEvaluationClock }) {
    this.clock = dependencies?.clock ?? {
      now: () => new Date(),
    };
  }

  public evaluateIssuedCertificateTrust(
    input: EvaluateIssuedCertificateTrustInput,
  ): CertificateTrustEvaluationViewDto {
    const serialNumber = normalizeSerial(input.serialNumber);
    const checkedAt = normalizeTimestamp(input.asOf, this.clock.now().toISOString());
    const certificate = input.certificate;
    if (!certificate) {
      return toResult({
        serialNumber,
        status: CertificateTrustEvaluationStatuses.notFound,
        checkedAt,
      });
    }

    const status = resolveCertificateTrustStatus(certificate, checkedAt, input.linkedSubjectState);
    return toResult({
      serialNumber,
      certificateAuthorityId: certificate.certificateAuthorityId,
      certificateStatus: certificate.status,
      status,
      checkedAt,
      linkedSubjectState: input.linkedSubjectState,
    });
  }
}

function resolveCertificateTrustStatus(
  certificate: IssuedCertificatePersistenceRecord,
  checkedAt: string,
  linkedSubjectState?: CertificateLinkedSubjectTrustState,
): CertificateTrustEvaluationStatus {
  if (certificate.status === CertificateStatuses.revoked) {
    return CertificateTrustEvaluationStatuses.revoked;
  }

  if (certificate.status === CertificateStatuses.superseded) {
    return CertificateTrustEvaluationStatuses.superseded;
  }

  const notBefore = Date.parse(certificate.validity.notBefore);
  const notAfter = Date.parse(certificate.validity.notAfter);
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(notBefore) || Number.isNaN(notAfter) || notAfter <= notBefore) {
    return CertificateTrustEvaluationStatuses.invalid;
  }

  if (certificate.status === CertificateStatuses.expired || checkedAtMs >= notAfter) {
    return CertificateTrustEvaluationStatuses.expired;
  }

  if (checkedAtMs < notBefore) {
    return CertificateTrustEvaluationStatuses.notYetValid;
  }

  if (certificate.status !== CertificateStatuses.issued) {
    return CertificateTrustEvaluationStatuses.invalid;
  }

  if (linkedSubjectState && linkedSubjectState !== "active") {
    return CertificateTrustEvaluationStatuses.subjectInactive;
  }

  return CertificateTrustEvaluationStatuses.active;
}

function toResult(input: {
  readonly serialNumber: string;
  readonly certificateAuthorityId?: string;
  readonly certificateStatus?: IssuedCertificatePersistenceRecord["status"];
  readonly status: CertificateTrustEvaluationStatus;
  readonly checkedAt: string;
  readonly linkedSubjectState?: CertificateLinkedSubjectTrustState;
}): CertificateTrustEvaluationViewDto {
  const revoked = input.status === CertificateTrustEvaluationStatuses.revoked;
  const expired = input.status === CertificateTrustEvaluationStatuses.expired;
  const active = input.status === CertificateTrustEvaluationStatuses.active;
  const usable = active;
  const diagnosticCode = input.status === CertificateTrustEvaluationStatuses.invalid
    ? "certificate-metadata-invalid"
    : undefined;

  return Object.freeze({
    serialNumber: input.serialNumber,
    certificateAuthorityId: input.certificateAuthorityId,
    status: input.status,
    certificateStatus: input.certificateStatus,
    revoked,
    active,
    expired,
    usable,
    checkedAt: input.checkedAt,
    linkedSubject: input.linkedSubjectState
      ? Object.freeze({
        state: input.linkedSubjectState,
      })
      : undefined,
    diagnosticCode,
  });
}

function normalizeSerial(serialNumber: string): string {
  const normalized = serialNumber.trim().toUpperCase();
  if (!normalized) {
    throw new Error("serialNumber is required.");
  }
  if (!/^[0-9A-F]{2,64}$/.test(normalized)) {
    throw new Error("serialNumber must be a hexadecimal string (2-64 chars).");
  }
  return normalized;
}

function normalizeTimestamp(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("asOf must be a valid timestamp when provided.");
  }
  return parsed.toISOString();
}
