import type { IdentitySessionStatus } from "../../src/domain/identity/IdentityDomain";
import type { UserIdentityStatus } from "../../src/domain/identity/IdentityDomain";
import type {
  DeviceDisplayName,
  DeviceFingerprint,
  DevicePairingMethod,
  DeviceRevocationReason,
  DeviceTrustMaterialRef,
  DeviceTrustStatus,
} from "../../src/domain/identity/TrustedDeviceDomain";
import type {
  PairingPinnedTrustMaterialRegistration,
  PairingSessionRejectionReason,
  PairingSessionStatus,
  PairingTokenActorBinding,
  PairingTokenArtifactType,
  PairingTokenInvalidationReason,
  PairingTokenIssuanceMetadata,
  PairingTokenStatus,
} from "../../src/domain/identity/TrustedDevicePairingDomain";

export const IdentityPrincipalLookupKinds = Object.freeze({
  username: "username",
  email: "email",
});

export type IdentityPrincipalLookupKind =
  typeof IdentityPrincipalLookupKinds[keyof typeof IdentityPrincipalLookupKinds];

export interface IdentityPrincipalLookup {
  readonly kind: IdentityPrincipalLookupKind;
  readonly value: string;
}

export interface IdentityProviderSubjectReference {
  readonly providerId: string;
  readonly providerSubject: string;
}

export const IdentityCredentialMaterialStatuses = Object.freeze({
  active: "active",
  superseded: "superseded",
  revoked: "revoked",
  expired: "expired",
});

export type IdentityCredentialMaterialStatus =
  typeof IdentityCredentialMaterialStatuses[keyof typeof IdentityCredentialMaterialStatuses];

export interface IdentityCredentialMaterialRecord {
  readonly id: string;
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly hashAlgorithm: string;
  readonly hashValue: string;
  readonly salt?: string;
  readonly pepperVersion?: string;
  readonly status: IdentityCredentialMaterialStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly supersededAt?: string;
  readonly expiresAt?: string;
}

export interface IdentityCredentialHistoryQuery {
  readonly reference: IdentityProviderSubjectReference;
  readonly includeInactive?: boolean;
  readonly limit?: number;
}

export interface IdentitySessionListQuery {
  readonly userIdentityId: string;
  readonly includeStatuses?: ReadonlyArray<IdentitySessionStatus>;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly limit?: number;
}

export interface IdentityUserIdentityListQuery {
  readonly providerId?: string;
  readonly includeStatuses?: ReadonlyArray<UserIdentityStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface IdentitySessionTokenMaterialRecord {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly hashAlgorithm: "sha256";
  readonly tokenType: "opaque-bearer";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly invalidatedAt?: string;
}

export interface TrustedDeviceRecord {
  readonly id: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly displayName: DeviceDisplayName;
  readonly fingerprint: DeviceFingerprint;
  readonly pairingMethod: DevicePairingMethod;
  readonly trustStatus: DeviceTrustStatus;
  readonly trustMaterialRef?: DeviceTrustMaterialRef;
  readonly registeredAt: string;
  readonly pairedAt?: string;
  readonly lastSeenAt?: string;
  readonly metadata: Readonly<{
    platform?: string;
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
    locale?: string;
    lastIpAddress?: string;
  }>;
  readonly revocation?: Readonly<{
    reason: DeviceRevocationReason;
    revokedAt: string;
    revokedByUserIdentityId?: string;
    note?: string;
  }>;
  readonly updatedAt: string;
}

export interface TrustedDeviceListQuery {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly includeStatuses?: ReadonlyArray<DeviceTrustStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface TrustedDeviceLookupByFingerprintQuery {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly fingerprint: DeviceFingerprint;
}

export interface TrustedDeviceRegistrationRequest {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly displayName: string;
  readonly fingerprint: DeviceFingerprint;
  readonly pairingMethod: DevicePairingMethod;
  readonly metadata?: Readonly<{
    platform?: string;
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
    locale?: string;
    lastIpAddress?: string;
  }>;
  readonly registeredAt?: string;
}

export interface TrustedDevicePairingRequest {
  readonly trustedDeviceId: string;
  readonly trustMaterialRef: DeviceTrustMaterialRef;
  readonly pairedAt?: string;
}

export interface TrustedDeviceDisplayNameUpdate {
  readonly trustedDeviceId: string;
  readonly displayName: string;
  readonly updatedAt?: string;
}

export interface TrustedDeviceRevocationRequest {
  readonly trustedDeviceId: string;
  readonly reason: DeviceRevocationReason;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
  readonly revokedAt?: string;
}

export interface TrustedDeviceLastSeenUpdate {
  readonly trustedDeviceId: string;
  readonly seenAt: string;
  readonly metadataPatch?: Readonly<{
    platform?: string;
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
    locale?: string;
    lastIpAddress?: string;
  }>;
}

export interface TrustedDevicePairingSessionRecord {
  readonly id: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly pairingTokenId: string;
  readonly status: PairingSessionStatus;
  readonly initiatedAt: string;
  readonly validatedAt?: string;
  readonly completedAt?: string;
  readonly completedByUserIdentityId?: string;
  readonly trustMaterialRegistration?: PairingPinnedTrustMaterialRegistration;
  readonly rejectedAt?: string;
  readonly rejectionReason?: PairingSessionRejectionReason;
  readonly rejectionNote?: string;
  readonly invalidatedAt?: string;
  readonly expiredAt?: string;
  readonly updatedAt: string;
}

export interface TrustedDevicePairingTokenRecord {
  readonly id: string;
  readonly pairingSessionId: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly artifactType: PairingTokenArtifactType;
  readonly tokenHash: string;
  readonly hashAlgorithm: "sha256";
  readonly actorBinding: PairingTokenActorBinding;
  readonly issuance: PairingTokenIssuanceMetadata;
  readonly status: PairingTokenStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly failedValidationAttempts: number;
  readonly maxValidationAttempts: number;
  readonly lastValidationAttemptAt?: string;
  readonly consumedAt?: string;
  readonly consumedByUserIdentityId?: string;
  readonly invalidationReason?: PairingTokenInvalidationReason;
  readonly invalidatedAt?: string;
  readonly invalidatedByUserIdentityId?: string;
  readonly invalidationNote?: string;
  readonly updatedAt: string;
}

export interface TrustedDevicePairingInitiationRequest {
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly artifactType: PairingTokenArtifactType;
  readonly actorBinding: PairingTokenActorBinding;
  readonly issuance?: PairingTokenIssuanceMetadata;
  readonly maxValidationAttempts?: number;
  readonly expiresAt: string;
}

export interface TrustedDevicePairingArtifact {
  readonly type: PairingTokenArtifactType;
  readonly value: string;
  readonly redactedHint?: string;
}

export interface TrustedDevicePairingInitiationResponse {
  readonly pairingSession: TrustedDevicePairingSessionRecord;
  readonly pairingToken: TrustedDevicePairingTokenRecord;
  readonly artifact: TrustedDevicePairingArtifact;
}

export interface TrustedDevicePairingValidationRequest {
  readonly pairingSessionId: string;
  readonly pairingTokenId?: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly presentedToken: string;
  readonly attemptedAt?: string;
}

export const PairingTokenValidationOutcomes = Object.freeze({
  valid: "valid",
  invalid: "invalid",
  expired: "expired",
  reused: "reused",
  invalidated: "invalidated",
  attemptsExhausted: "attempts-exhausted",
  actorScopeViolation: "actor-scope-violation",
});

export type PairingTokenValidationOutcome =
  typeof PairingTokenValidationOutcomes[keyof typeof PairingTokenValidationOutcomes];

export interface TrustedDevicePairingValidationResponse {
  readonly outcome: PairingTokenValidationOutcome;
  readonly pairingSession: TrustedDevicePairingSessionRecord;
  readonly pairingToken: TrustedDevicePairingTokenRecord;
  readonly attemptsRemaining: number;
}

export interface TrustedDevicePairingCompletionRequest {
  readonly pairingSessionId: string;
  readonly pairingTokenId: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly trustedDeviceRegistration?: Readonly<{
    readonly displayName: string;
    readonly fingerprint: DeviceFingerprint;
    readonly pairingMethod: DevicePairingMethod;
    readonly metadata?: Readonly<{
      platform?: string;
      osVersion?: string;
      appVersion?: string;
      deviceModel?: string;
      locale?: string;
      lastIpAddress?: string;
    }>;
    readonly registeredAt?: string;
  }>;
  readonly presentedToken: string;
  readonly completedAt?: string;
  readonly completedByUserIdentityId?: string;
  readonly trustMaterialRef?: DeviceTrustMaterialRef;
  readonly trustMaterialRegistration?: PairingPinnedTrustMaterialRegistration;
}

export interface TrustedDevicePairingCompletionResponse {
  readonly pairingSession: TrustedDevicePairingSessionRecord;
  readonly pairingToken: TrustedDevicePairingTokenRecord;
  readonly trustedDevice: TrustedDeviceRecord;
}

export interface TrustedDevicePairingExpirationRequest {
  readonly pairingSessionId?: string;
  readonly pairingTokenId?: string;
  readonly expiresBefore: string;
  readonly includeAlreadyExpired?: boolean;
}

export interface TrustedDevicePairingExpirationResult {
  readonly expiredSessions: number;
  readonly expiredTokens: number;
}

export interface TrustedDevicePairingInvalidationRequest {
  readonly pairingSessionId?: string;
  readonly pairingTokenId?: string;
  readonly reason: PairingTokenInvalidationReason;
  readonly invalidatedByUserIdentityId?: string;
  readonly note?: string;
  readonly invalidatedAt?: string;
}

export const IdentityIdNamespaces = Object.freeze({
  userIdentity: "user-identity",
  identitySession: "identity-session",
  provider: "provider",
  credentialPolicy: "credential-policy",
  credentialMaterial: "credential-material",
  trustedDevice: "trusted-device",
  trustedDevicePairingSession: "trusted-device-pairing-session",
  trustedDevicePairingToken: "trusted-device-pairing-token",
});

export type IdentityIdNamespace =
  typeof IdentityIdNamespaces[keyof typeof IdentityIdNamespaces];

export const IdentityErrorCodes = Object.freeze({
  duplicateIdentity: "identity-duplicate",
  invalidCredentials: "identity-invalid-credentials",
  inactiveAccount: "identity-inactive-account",
  policyViolation: "identity-policy-violation",
  unsupportedProvider: "identity-unsupported-provider",
  invalidSessionState: "identity-invalid-session-state",
  invalidRequest: "identity-invalid-request",
  invalidState: "identity-invalid-state",
  notFound: "identity-not-found",
});

export type IdentityErrorCode = typeof IdentityErrorCodes[keyof typeof IdentityErrorCodes];

export const IdentityErrorBoundaries = Object.freeze({
  domain: "domain",
  application: "application",
  infrastructure: "infrastructure",
});

export type IdentityErrorBoundary =
  typeof IdentityErrorBoundaries[keyof typeof IdentityErrorBoundaries];

export interface IdentityOperationError<TCode extends IdentityErrorCode = IdentityErrorCode> {
  readonly code: TCode;
  readonly message: string;
  readonly boundary: IdentityErrorBoundary;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IdentityOperationSuccess<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

export interface IdentityOperationFailure<TCode extends IdentityErrorCode = IdentityErrorCode> {
  readonly ok: false;
  readonly error: IdentityOperationError<TCode>;
}

export type IdentityOperationResult<TValue, TCode extends IdentityErrorCode = IdentityErrorCode> =
  | IdentityOperationSuccess<TValue>
  | IdentityOperationFailure<TCode>;

export interface IdentityMutationOutcome {
  readonly changed: boolean;
}

export function identitySuccess<TValue>(value: TValue): IdentityOperationSuccess<TValue> {
  return Object.freeze({
    ok: true,
    value,
  });
}

export function identityFailure<TCode extends IdentityErrorCode>(
  error: IdentityOperationError<TCode>,
): IdentityOperationFailure<TCode> {
  return Object.freeze({
    ok: false,
    error,
  });
}
