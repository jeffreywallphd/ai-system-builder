import type { CertificateStatus } from "../../../domain/security/CertificateAuthorityDomain";
import type { CertificateRevocationPersistenceRecord } from "../../../shared/dto/security/CertificateAuthorityDtos";

export const CertificateRevocationRegistryStatuses = Object.freeze({
  active: "active",
  revoked: "revoked",
  expired: "expired",
  superseded: "superseded",
  notYetValid: "not-yet-valid",
  notFound: "not-found",
});

export type CertificateRevocationRegistryStatus =
  typeof CertificateRevocationRegistryStatuses[keyof typeof CertificateRevocationRegistryStatuses];

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
  readonly checkedAt: string;
  readonly revocation?: CertificateRevocationPersistenceRecord;
}

export interface ICertificateRevocationStatusRegistry {
  resolveCertificateRevocationStatus(
    input: ResolveCertificateRevocationStatusInput,
  ): Promise<ResolveCertificateRevocationStatusResult>;
}
