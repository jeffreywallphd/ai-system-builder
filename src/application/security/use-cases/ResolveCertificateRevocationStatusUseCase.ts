import { CertificateStatuses } from "../../../domain/security/CertificateAuthorityDomain";
import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  CertificateRevocationRegistryStatuses,
  type ICertificateRevocationStatusRegistry,
  type ResolveCertificateRevocationStatusInput,
  type ResolveCertificateRevocationStatusResult,
} from "../ports/ICertificateRevocationStatusRegistry";

export interface ResolveCertificateRevocationStatusUseCaseDependencies {
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly certificateLifecycleEventRepository: ICertificateLifecycleEventPersistenceRepository;
}

export class ResolveCertificateRevocationStatusUseCase implements ICertificateRevocationStatusRegistry {
  public constructor(private readonly dependencies: ResolveCertificateRevocationStatusUseCaseDependencies) {}

  public async resolveCertificateRevocationStatus(
    input: ResolveCertificateRevocationStatusInput,
  ): Promise<ResolveCertificateRevocationStatusResult> {
    const serialNumber = normalizeSerial(input.serialNumber);
    const checkedAt = normalizeTimestamp(input.asOf);

    const certificate = await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(serialNumber);
    if (!certificate) {
      return Object.freeze({
        serialNumber,
        status: CertificateRevocationRegistryStatuses.notFound,
        revoked: false,
        active: false,
        expired: false,
        checkedAt,
      });
    }

    if (certificate.status === CertificateStatuses.revoked) {
      const revocation = certificate.revocation
        ?? await this.resolveLatestRevocation(serialNumber);
      return Object.freeze({
        serialNumber,
        certificateAuthorityId: certificate.certificateAuthorityId,
        status: CertificateRevocationRegistryStatuses.revoked,
        certificateStatus: certificate.status,
        revoked: true,
        active: false,
        expired: false,
        checkedAt,
        revocation,
      });
    }

    if (certificate.status === CertificateStatuses.superseded) {
      return Object.freeze({
        serialNumber,
        certificateAuthorityId: certificate.certificateAuthorityId,
        status: CertificateRevocationRegistryStatuses.superseded,
        certificateStatus: certificate.status,
        revoked: false,
        active: false,
        expired: false,
        checkedAt,
      });
    }

    const notBefore = Date.parse(certificate.validity.notBefore);
    const notAfter = Date.parse(certificate.validity.notAfter);
    const asOfMs = Date.parse(checkedAt);

    if (certificate.status === CertificateStatuses.expired || asOfMs >= notAfter) {
      return Object.freeze({
        serialNumber,
        certificateAuthorityId: certificate.certificateAuthorityId,
        status: CertificateRevocationRegistryStatuses.expired,
        certificateStatus: certificate.status,
        revoked: false,
        active: false,
        expired: true,
        checkedAt,
      });
    }

    if (asOfMs < notBefore) {
      return Object.freeze({
        serialNumber,
        certificateAuthorityId: certificate.certificateAuthorityId,
        status: CertificateRevocationRegistryStatuses.notYetValid,
        certificateStatus: certificate.status,
        revoked: false,
        active: false,
        expired: false,
        checkedAt,
      });
    }

    return Object.freeze({
      serialNumber,
      certificateAuthorityId: certificate.certificateAuthorityId,
      status: CertificateRevocationRegistryStatuses.active,
      certificateStatus: certificate.status,
      revoked: false,
      active: true,
      expired: false,
      checkedAt,
    });
  }

  private async resolveLatestRevocation(serialNumber: string) {
    const latest = await this.dependencies.certificateLifecycleEventRepository
      .findLatestCertificateRevocationBySerialNumber(serialNumber);

    if (!latest) {
      return undefined;
    }

    return Object.freeze({
      reason: latest.reason,
      revokedAt: latest.revokedAt,
      revokedByActorId: latest.revokedByActorId,
      note: latest.note,
    });
  }
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

function normalizeTimestamp(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("asOf must be a valid timestamp when provided.");
  }

  return parsed.toISOString();
}
