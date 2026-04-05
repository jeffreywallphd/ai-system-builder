import type {
  CertificateAuthorityStatus,
  CertificateRevocationReason,
  CertificateStatus,
  CertificateSubjectReferenceKind,
  CertificateUsageKind,
  TrustMaterialKind,
} from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateAuthorityStatuses,
  CertificateStatuses,
} from "../../../domain/security/CertificateAuthorityDomain";

export interface CertificateAuthorityPersistenceAuditStamp {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface CertificateAuthorityPersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CertificateAuthorityPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: CertificateAuthorityPersistenceWriteContext;
}

export interface CertificateAuthorityPersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface RotationPolicyMetadataPersistenceRecord {
  readonly profileId: string;
  readonly autoRotateEnabled: boolean;
  readonly rotateBeforeExpiryDays: number;
  readonly overlapDays: number;
  readonly maxLifetimeDays: number;
  readonly lastRotatedAt?: string;
  readonly nextRotationDueAt?: string;
}

export interface CertificateValidityWindowPersistenceRecord {
  readonly notBefore: string;
  readonly notAfter: string;
}

export interface CertificateSubjectPersistenceRecord {
  readonly commonName: string;
  readonly organization?: string;
  readonly organizationalUnit?: string;
  readonly country?: string;
  readonly stateOrProvince?: string;
  readonly locality?: string;
  readonly dnsNames: ReadonlyArray<string>;
  readonly ipAddresses: ReadonlyArray<string>;
  readonly uriSanEntries: ReadonlyArray<string>;
}

export interface CertificateSubjectReferencePersistenceRecord {
  readonly kind: CertificateSubjectReferenceKind;
  readonly referenceId: string;
  readonly workspaceId?: string;
}

export interface CertificateRevocationPersistenceRecord {
  readonly reason: CertificateRevocationReason;
  readonly revokedAt: string;
  readonly revokedByActorId?: string;
  readonly note?: string;
}

export interface TrustMaterialReferencePersistenceRecord extends CertificateAuthorityPersistenceAuditStamp {
  readonly materialRef: string;
  readonly kind: TrustMaterialKind;
  readonly storageLocator: string;
  readonly fingerprintSha256?: string;
  readonly revision: number;
}

export interface CertificateAuthorityRootPersistenceRecord extends CertificateAuthorityPersistenceAuditStamp {
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly status: CertificateAuthorityStatus;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly serialNumber: string;
  readonly validity: CertificateValidityWindowPersistenceRecord;
  readonly signatureAlgorithm: string;
  readonly rootCertificateMaterialRef: string;
  readonly rootPrivateKeyMaterialRef: string;
  readonly rotationPolicy: RotationPolicyMetadataPersistenceRecord;
  readonly rotatedFromCertificateAuthorityId?: string;
  readonly retiredAt?: string;
  readonly compromisedAt?: string;
  readonly revision: number;
}

export interface IssuedCertificatePersistenceRecord extends CertificateAuthorityPersistenceAuditStamp {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly status: CertificateStatus;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly subjectReference: CertificateSubjectReferencePersistenceRecord;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validity: CertificateValidityWindowPersistenceRecord;
  readonly issuedAt: string;
  readonly certificateMaterialRef: string;
  readonly certificateChainMaterialRef?: string;
  readonly trustMaterialRef?: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly revocation?: CertificateRevocationPersistenceRecord;
  readonly supersededBySerialNumber?: string;
  readonly revision: number;
}

export interface CertificateAuthorityRootLookupQuery {
  readonly statuses?: ReadonlyArray<CertificateAuthorityStatus>;
  readonly includeRetired?: boolean;
  readonly includeCompromised?: boolean;
  readonly activeAt?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface IssuedCertificateLookupQuery {
  readonly certificateAuthorityId?: string;
  readonly statuses?: ReadonlyArray<CertificateStatus>;
  readonly subjectReferenceKinds?: ReadonlyArray<CertificateSubjectReferenceKind>;
  readonly subjectReferenceId?: string;
  readonly usageAnyOf?: ReadonlyArray<CertificateUsageKind>;
  readonly validAt?: string;
  readonly issuedAfter?: string;
  readonly issuedBefore?: string;
  readonly includeRevoked?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface TrustMaterialReferenceLookupQuery {
  readonly kinds?: ReadonlyArray<TrustMaterialKind>;
  readonly materialRefPrefix?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SaveCertificateAuthorityRootPersistenceRecordInput {
  readonly record: CertificateAuthorityRootPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface UpdateCertificateAuthorityStatusPersistenceRecordInput {
  readonly certificateAuthorityId: string;
  readonly status: CertificateAuthorityStatus;
  readonly retiredAt?: string;
  readonly compromisedAt?: string;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface UpdateCertificateAuthorityRotationPolicyPersistenceRecordInput {
  readonly certificateAuthorityId: string;
  readonly rotationPolicy: RotationPolicyMetadataPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface SaveIssuedCertificatePersistenceRecordInput {
  readonly record: IssuedCertificatePersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface RevokeIssuedCertificatePersistenceRecordInput {
  readonly serialNumber: string;
  readonly revocation: CertificateRevocationPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface SupersedeIssuedCertificatePersistenceRecordInput {
  readonly serialNumber: string;
  readonly supersededBySerialNumber: string;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface SaveTrustMaterialReferencePersistenceRecordInput {
  readonly record: TrustMaterialReferencePersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export const CertificateAuthorityPersistenceQueryPresets = Object.freeze({
  activeStatuses: Object.freeze([CertificateAuthorityStatuses.active]),
  terminalStatuses: Object.freeze([
    CertificateAuthorityStatuses.retired,
    CertificateAuthorityStatuses.compromised,
  ]),
  activeCertificateStatuses: Object.freeze([CertificateStatuses.issued]),
  revokedCertificateStatuses: Object.freeze([CertificateStatuses.revoked]),
});

export function toCertificateStatusLookupKey(status: CertificateStatus): string {
  return `certificate-status:${status}`;
}

export function toCertificateAuthorityStatusLookupKey(status: CertificateAuthorityStatus): string {
  return `certificate-authority-status:${status}`;
}

export function toCertificateSubjectLookupKey(reference: CertificateSubjectReferencePersistenceRecord): string {
  const workspace = reference.workspaceId ? `:${reference.workspaceId}` : "";
  return `certificate-subject:${reference.kind}:${reference.referenceId}${workspace}`;
}

export function normalizeCertificateAuthorityMutationOperationKey(operationKey: string): string {
  const normalized = operationKey.trim();
  if (!normalized) {
    throw new Error("Certificate authority persistence mutation operationKey is required.");
  }
  return normalized;
}
