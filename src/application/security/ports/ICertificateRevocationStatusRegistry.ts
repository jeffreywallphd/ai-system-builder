import type { CertificateStatus } from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateTrustEvaluationStatuses,
  type CertificateRevocationPersistenceRecord,
  type CertificateTrustEvaluationStatus,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

export const CertificateRevocationRegistryStatuses = CertificateTrustEvaluationStatuses;
export type CertificateRevocationRegistryStatus = CertificateTrustEvaluationStatus;

export interface ResolveCertificateRevocationStatusInput {
  readonly serialNumber: string;
  readonly asOf?: string;
}

export interface ResolveCertificateRevocationStatusResult {
  readonly serialNumber: string;
  readonly certificateAuthorityId?: string;
  readonly status: CertificateRevocationRegistryStatus;
  readonly certificateStatus?: CertificateStatus;
  readonly revoked: boolean;
  readonly active: boolean;
  readonly expired: boolean;
  readonly usable: boolean;
  readonly checkedAt: string;
  readonly revocation?: CertificateRevocationPersistenceRecord;
}

export interface ICertificateRevocationStatusRegistry {
  resolveCertificateRevocationStatus(
    input: ResolveCertificateRevocationStatusInput,
  ): Promise<ResolveCertificateRevocationStatusResult>;
}
