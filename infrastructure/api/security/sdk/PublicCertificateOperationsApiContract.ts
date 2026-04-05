import type {
  CertificateAuthorityStatusIntrospectionViewDto,
  CertificateMetadataListViewDto,
  CertificateRevocationPersistenceRecord,
  CertificateTrustEvaluationStatus,
  IssuedCertificateMetadataViewDto,
  IssuedCertificatePersistenceRecord,
} from "../../../../src/shared/dto/security/CertificateAuthorityDtos";
import type {
  CertificateRevocationReason,
  CertificateSubjectReferenceKind,
  CertificateUsageKind,
} from "../../../../src/domain/security/CertificateAuthorityDomain";
import type { CertificateRenewalDispositionKind } from "../../../../src/application/security/use-cases/RenewIssuedCertificateUseCase";

export const CertificateOperationsApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type CertificateOperationsApiErrorCode =
  typeof CertificateOperationsApiErrorCodes[keyof typeof CertificateOperationsApiErrorCodes];

export interface CertificateOperationsApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface CertificateOperationsApiError {
  readonly code: CertificateOperationsApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<CertificateOperationsApiValidationError>;
}

export interface CertificateOperationsApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: CertificateOperationsApiError;
}

export interface GetCertificateAuthorityStatusApiRequest {
  readonly actorUserIdentityId: string;
  readonly asOf?: string;
  readonly rotationWarningWindowDays?: number;
  readonly certificateExpiryWarningWindowDays?: number;
}

export interface GetCertificateAuthorityStatusApiResponse {
  readonly status: CertificateAuthorityStatusIntrospectionViewDto;
}

export interface ListIssuedCertificatesApiRequest {
  readonly actorUserIdentityId: string;
  readonly certificateAuthorityId?: string;
  readonly statuses?: ReadonlyArray<IssuedCertificatePersistenceRecord["status"]>;
  readonly subjectReferenceKinds?: ReadonlyArray<CertificateSubjectReferenceKind>;
  readonly subjectReferenceId?: string;
  readonly linkedNodeId?: string;
  readonly subjectCommonNameContains?: string;
  readonly usageAnyOf?: ReadonlyArray<CertificateUsageKind>;
  readonly issuedAfter?: string;
  readonly issuedBefore?: string;
  readonly trustStatuses?: ReadonlyArray<CertificateTrustEvaluationStatus>;
  readonly includeRevoked?: boolean;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListIssuedCertificatesApiResponse {
  readonly certificates: CertificateMetadataListViewDto;
}

export interface GetIssuedCertificateApiRequest {
  readonly actorUserIdentityId: string;
  readonly serialNumber: string;
  readonly asOf?: string;
}

export interface GetIssuedCertificateApiResponse {
  readonly certificate: IssuedCertificateMetadataViewDto;
}

export interface RevokeIssuedCertificateApiRequest {
  readonly operationKey?: string;
  readonly actorUserIdentityId: string;
  readonly serialNumber: string;
  readonly revocationReason: CertificateRevocationReason;
  readonly revokedAt?: string;
  readonly note?: string;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface RevokeIssuedCertificateApiResponse {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly previousStatus: IssuedCertificatePersistenceRecord["status"];
  readonly currentStatus: IssuedCertificatePersistenceRecord["status"];
  readonly revokedAt: string;
  readonly revocation: CertificateRevocationPersistenceRecord;
}

export interface RenewIssuedCertificateApiRequest {
  readonly operationKey?: string;
  readonly actorUserIdentityId: string;
  readonly serialNumber: string;
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

export interface RenewIssuedCertificateApiResponse {
  readonly previousSerialNumber: string;
  readonly replacementSerialNumber: string;
  readonly certificateAuthorityId: string;
  readonly profileKind: string;
  readonly previousCertificateDisposition: CertificateRenewalDispositionKind;
  readonly gracePeriodDays: number;
  readonly replacedAt: string;
}
