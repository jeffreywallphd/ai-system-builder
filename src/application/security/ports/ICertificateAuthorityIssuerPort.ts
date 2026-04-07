import type {
  CertificateRevocationReason,
  CertificateSubjectDescriptor,
  CertificateSubjectReference,
  CertificateUsageKind,
} from "@domain/security/CertificateAuthorityDomain";

export interface InitializeInternalCertificateAuthorityInput {
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly subject: CertificateSubjectDescriptor;
  readonly signatureAlgorithm: string;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
}

export interface InitializeInternalCertificateAuthorityResult {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly rootCertificatePem: string;
  readonly encryptedRootPrivateKeyPem: string;
  readonly rootCertificateFingerprintSha256: string;
}

export interface IssueCertificateMaterialInput {
  readonly certificateAuthorityId: string;
  readonly subject: CertificateSubjectDescriptor;
  readonly subjectReference: CertificateSubjectReference;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validityDays: number;
  readonly actorUserIdentityId: string;
  readonly publicKeyPem: string;
  readonly signatureAlgorithm?: string;
}

export interface IssueCertificateMaterialResult {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly certificatePem: string;
  readonly certificateChainPem: string;
  readonly certificateFingerprintSha256: string;
}

export interface RevokeCertificateMaterialInput {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly reason: CertificateRevocationReason;
  readonly actorUserIdentityId: string;
  readonly revokedAt?: string;
}

export interface RevokeCertificateMaterialResult {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly revokedAt: string;
  readonly crlPem?: string;
}

export interface ICertificateAuthorityIssuerPort {
  initializeInternalCertificateAuthority(
    input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult>;
  issueCertificateMaterial(input: IssueCertificateMaterialInput): Promise<IssueCertificateMaterialResult>;
  revokeCertificateMaterial(input: RevokeCertificateMaterialInput): Promise<RevokeCertificateMaterialResult>;
}

