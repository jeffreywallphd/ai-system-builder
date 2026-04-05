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

export const CertificateTrustEvaluationStatuses = Object.freeze({
  active: "active",
  revoked: "revoked",
  expired: "expired",
  superseded: "superseded",
  notYetValid: "not-yet-valid",
  notFound: "not-found",
  subjectInactive: "subject-inactive",
  invalid: "invalid",
});

export type CertificateTrustEvaluationStatus =
  typeof CertificateTrustEvaluationStatuses[keyof typeof CertificateTrustEvaluationStatuses];

export const CertificateLinkedSubjectTrustStates = Object.freeze({
  active: "active",
  inactive: "inactive",
  suspended: "suspended",
  revoked: "revoked",
});

export type CertificateLinkedSubjectTrustState =
  typeof CertificateLinkedSubjectTrustStates[keyof typeof CertificateLinkedSubjectTrustStates];

export interface CertificateTrustEvaluationSubjectSnapshotDto {
  readonly state: CertificateLinkedSubjectTrustState;
  readonly referenceId?: string;
  readonly reason?: string;
}

export interface CertificateTrustEvaluationViewDto {
  readonly serialNumber: string;
  readonly certificateAuthorityId?: string;
  readonly status: CertificateTrustEvaluationStatus;
  readonly certificateStatus?: CertificateStatus;
  readonly revoked: boolean;
  readonly active: boolean;
  readonly expired: boolean;
  readonly usable: boolean;
  readonly checkedAt: string;
  readonly linkedSubject?: CertificateTrustEvaluationSubjectSnapshotDto;
  readonly diagnosticCode?: string;
  readonly revocation?: CertificateRevocationPersistenceRecord;
}

export const CertificateDistributionTargetKinds = Object.freeze({
  node: "node",
  server: "server",
  device: "device",
  service: "service",
});

export type CertificateDistributionTargetKind =
  typeof CertificateDistributionTargetKinds[keyof typeof CertificateDistributionTargetKinds];

export const CertificateDistributionEventStatuses = Object.freeze({
  queued: "queued",
  published: "published",
  failed: "failed",
  acknowledged: "acknowledged",
});

export type CertificateDistributionEventStatus =
  typeof CertificateDistributionEventStatuses[keyof typeof CertificateDistributionEventStatuses];

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

export interface CertificateStatusHistoryPersistenceRecord {
  readonly statusEventId: string;
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly previousStatus?: CertificateStatus;
  readonly currentStatus: CertificateStatus;
  readonly occurredAt: string;
  readonly occurredBy: string;
  readonly reason?: string;
  readonly note?: string;
}

export interface CertificateRevocationHistoryPersistenceRecord extends CertificateAuthorityPersistenceAuditStamp {
  readonly revocationId: string;
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly reason: CertificateRevocationReason;
  readonly revokedAt: string;
  readonly revokedByActorId?: string;
  readonly note?: string;
  readonly revision: number;
}

export interface CertificateDistributionEventPersistenceRecord extends CertificateAuthorityPersistenceAuditStamp {
  readonly distributionEventId: string;
  readonly materialRef: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly targetKind: CertificateDistributionTargetKind;
  readonly targetReferenceId: string;
  readonly workspaceId?: string;
  readonly transport: string;
  readonly deliveryLocatorRef?: string;
  readonly status: CertificateDistributionEventStatus;
  readonly occurredAt: string;
  readonly occurredBy: string;
  readonly failureReason?: string;
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

export interface CertificateStatusHistoryLookupQuery {
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly statuses?: ReadonlyArray<CertificateStatus>;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CertificateRevocationHistoryLookupQuery {
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly reasons?: ReadonlyArray<CertificateRevocationReason>;
  readonly revokedAfter?: string;
  readonly revokedBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CertificateDistributionEventLookupQuery {
  readonly materialRef?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly targetKinds?: ReadonlyArray<CertificateDistributionTargetKind>;
  readonly targetReferenceId?: string;
  readonly workspaceId?: string;
  readonly statuses?: ReadonlyArray<CertificateDistributionEventStatus>;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
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

export interface AppendCertificateStatusHistoryPersistenceRecordInput {
  readonly record: CertificateStatusHistoryPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface SaveCertificateRevocationHistoryPersistenceRecordInput {
  readonly record: CertificateRevocationHistoryPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export interface SaveCertificateDistributionEventPersistenceRecordInput {
  readonly record: CertificateDistributionEventPersistenceRecord;
  readonly mutation: CertificateAuthorityPersistenceMutationEnvelope;
}

export const CertificateAuthorityIntrospectionStates = Object.freeze({
  healthy: "healthy",
  uninitialized: "uninitialized",
  degraded: "degraded",
  blocked: "blocked",
});

export type CertificateAuthorityIntrospectionState =
  typeof CertificateAuthorityIntrospectionStates[keyof typeof CertificateAuthorityIntrospectionStates];

export const CertificateAuthorityIntrospectionDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export type CertificateAuthorityIntrospectionDiagnosticSeverity =
  typeof CertificateAuthorityIntrospectionDiagnosticSeverities[keyof typeof CertificateAuthorityIntrospectionDiagnosticSeverities];

export interface CertificateAuthorityIntrospectionDiagnosticDto {
  readonly code: string;
  readonly severity: CertificateAuthorityIntrospectionDiagnosticSeverity;
  readonly message: string;
}

export interface CertificateAuthorityCertificateCountSummaryDto {
  readonly total: number;
  readonly issued: number;
  readonly revoked: number;
  readonly expired: number;
  readonly superseded: number;
  readonly activeAtAsOf: number;
}

export interface CertificateAuthorityRotationCheckpointDto {
  readonly recommendedRotationAt: string;
  readonly configuredNextRotationDueAt?: string;
  readonly daysUntilRecommendedRotation: number;
  readonly isDue: boolean;
  readonly isOverdue: boolean;
}

export interface CertificateAuthorityStatusHealthFlagsDto {
  readonly startupHealthy: boolean;
  readonly configurationBlocked: boolean;
  readonly authorityActive: boolean;
  readonly rotationDueSoon: boolean;
  readonly rotationOverdue: boolean;
  readonly hasRevokedCertificates: boolean;
  readonly hasExpiringCertificates: boolean;
  readonly hasDistributionFailures: boolean;
}

export interface CertificateAuthorityIntrospectionAuthorityDto {
  readonly certificateAuthorityId: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
  readonly status: CertificateAuthorityStatus;
  readonly validityNotBefore: string;
  readonly validityNotAfter: string;
  readonly certificateCounts: CertificateAuthorityCertificateCountSummaryDto;
  readonly lastIssuedAt?: string;
  readonly rotationCheckpoint: CertificateAuthorityRotationCheckpointDto;
}

export interface CertificateAuthorityStatusIntrospectionViewDto {
  readonly asOf: string;
  readonly initialized: boolean;
  readonly active: boolean;
  readonly blocked: boolean;
  readonly state: CertificateAuthorityIntrospectionState;
  readonly certificateAuthorityId?: string;
  readonly authority?: CertificateAuthorityIntrospectionAuthorityDto;
  readonly diagnostics: ReadonlyArray<CertificateAuthorityIntrospectionDiagnosticDto>;
  readonly healthFlags: CertificateAuthorityStatusHealthFlagsDto;
}

export interface IssuedCertificateOperationalTrustViewDto {
  readonly status: CertificateTrustEvaluationStatus;
  readonly active: boolean;
  readonly revoked: boolean;
  readonly expired: boolean;
  readonly usable: boolean;
  readonly checkedAt: string;
}

export interface IssuedCertificateMetadataViewDto {
  readonly certificateAuthorityId: string;
  readonly serialNumber: string;
  readonly status: CertificateStatus;
  readonly trust: IssuedCertificateOperationalTrustViewDto;
  readonly subject: CertificateSubjectPersistenceRecord;
  readonly subjectReference: CertificateSubjectReferencePersistenceRecord;
  readonly usages: ReadonlyArray<CertificateUsageKind>;
  readonly validity: CertificateValidityWindowPersistenceRecord;
  readonly issuedAt: string;
  readonly publicKeyAlgorithm: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly revocation?: CertificateRevocationPersistenceRecord;
  readonly supersededBySerialNumber?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface CertificateMetadataListPaginationDto {
  readonly limit: number;
  readonly offset: number;
  readonly returned: number;
  readonly hasMore: boolean;
}

export interface CertificateMetadataListViewDto {
  readonly asOf: string;
  readonly items: ReadonlyArray<IssuedCertificateMetadataViewDto>;
  readonly pagination: CertificateMetadataListPaginationDto;
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

export function toCertificateDistributionTargetLookupKey(input: {
  readonly kind: CertificateDistributionTargetKind;
  readonly referenceId: string;
  readonly workspaceId?: string;
}): string {
  const workspace = input.workspaceId ? `:${input.workspaceId}` : "";
  return `certificate-distribution-target:${input.kind}:${input.referenceId}${workspace}`;
}

export function normalizeCertificateAuthorityMutationOperationKey(operationKey: string): string {
  const normalized = operationKey.trim();
  if (!normalized) {
    throw new Error("Certificate authority persistence mutation operationKey is required.");
  }
  return normalized;
}
