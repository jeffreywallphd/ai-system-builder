import type {
  CertificateTrustEvaluationStatus,
  IssuedCertificateLookupQuery,
} from "@shared/dto/security/CertificateAuthorityDtos";

export interface CertificateMetadataListAuthorizationQuery extends IssuedCertificateLookupQuery {
  readonly linkedNodeId?: string;
  readonly subjectCommonNameContains?: string;
  readonly trustStatuses?: ReadonlyArray<CertificateTrustEvaluationStatus>;
  readonly asOf?: string;
}

export interface CertificateQueryAuthorizationHook {
  assertCanListIssuedCertificateMetadata(input: {
    readonly actorUserIdentityId: string;
    readonly query: CertificateMetadataListAuthorizationQuery;
  }): Promise<void>;
  assertCanGetIssuedCertificateMetadata(input: {
    readonly actorUserIdentityId: string;
    readonly serialNumber: string;
    readonly asOf?: string;
  }): Promise<void>;
}

