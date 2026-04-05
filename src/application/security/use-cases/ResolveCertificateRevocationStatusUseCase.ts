import type { ICertificateLifecycleEventPersistenceRepository } from "../ports/ICertificateLifecycleEventPersistenceRepository";
import type { IIssuedCertificatePersistenceRepository } from "../ports/IIssuedCertificatePersistenceRepository";
import {
  type ICertificateRevocationStatusRegistry,
  type ResolveCertificateRevocationStatusInput,
  type ResolveCertificateRevocationStatusResult,
} from "../ports/ICertificateRevocationStatusRegistry";
import { CertificateTrustEvaluationService, type CertificateTrustEvaluationClock } from "./CertificateTrustEvaluationService";

export interface ResolveCertificateRevocationStatusUseCaseDependencies {
  readonly issuedCertificateRepository: IIssuedCertificatePersistenceRepository;
  readonly certificateLifecycleEventRepository: ICertificateLifecycleEventPersistenceRepository;
  readonly clock?: CertificateTrustEvaluationClock;
}

export class ResolveCertificateRevocationStatusUseCase implements ICertificateRevocationStatusRegistry {
  private readonly trustEvaluationService: CertificateTrustEvaluationService;

  public constructor(private readonly dependencies: ResolveCertificateRevocationStatusUseCaseDependencies) {
    this.trustEvaluationService = new CertificateTrustEvaluationService({
      clock: dependencies.clock,
    });
  }

  public async resolveCertificateRevocationStatus(
    input: ResolveCertificateRevocationStatusInput,
  ): Promise<ResolveCertificateRevocationStatusResult> {
    const serialNumber = normalizeSerial(input.serialNumber);

    const certificate = await this.dependencies.issuedCertificateRepository.findIssuedCertificateBySerialNumber(serialNumber);
    const trust = this.trustEvaluationService.evaluateIssuedCertificateTrust({
      serialNumber,
      certificate,
      asOf: input.asOf,
    });

    const revocation = trust.status === "revoked"
      ? certificate?.revocation ?? await this.resolveLatestRevocation(serialNumber)
      : undefined;

    return Object.freeze({
      serialNumber,
      certificateAuthorityId: trust.certificateAuthorityId,
      status: trust.status,
      certificateStatus: trust.certificateStatus,
      revoked: trust.revoked,
      active: trust.active,
      expired: trust.expired,
      usable: trust.usable,
      checkedAt: trust.checkedAt,
      revocation,
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

