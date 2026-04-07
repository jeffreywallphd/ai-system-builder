/* MIGRATION NOTE: prefer importing shared transport contracts from src/shared/contracts/* for new work. This SDK contract remains for compatibility during convergence. */
export const IdentityAuthApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  conflict: "conflict",
  authenticationFailed: "authentication-failed",
  accountInactive: "account-inactive",
  unsupportedProvider: "unsupported-provider",
  notFound: "not-found",
  forbidden: "forbidden",
  internal: "internal",
} as const);

export type IdentityAuthApiErrorCode =
  typeof IdentityAuthApiErrorCodes[keyof typeof IdentityAuthApiErrorCodes];

export interface IdentityAuthApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface IdentityAuthApiError {
  readonly code: IdentityAuthApiErrorCode;
  readonly message: string;
  readonly sharedCode?: string;
  readonly domainCode?: string;
  readonly retryable?: boolean;
  readonly validationErrors?: ReadonlyArray<IdentityAuthApiValidationError>;
  readonly trustFailure?: {
    readonly reason?: string;
    readonly invalidationReasons?: ReadonlyArray<
      "trusted-device-revoked"
      | "trusted-device-trust-lost"
      | "trusted-device-expired"
      | "trusted-device-mismatch"
    >;
  };
}

export interface IdentityAuthApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: IdentityAuthApiError;
}

export interface RegisterLocalIdentityApiRequest {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerId?: string;
  readonly providerSubject?: string;
  readonly credentialPolicyId?: string;
  readonly credential: {
    readonly candidate: string;
  };
}

export interface RegisterLocalIdentityApiResponse {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly registeredAt: string;
}

export interface LoginLocalIdentityApiRequest {
  readonly providerId?: string;
  readonly providerSubject: string;
  readonly accessChannel?: "desktop" | "thin-client";
  readonly sessionTrustRequirement?: "allow-untrusted" | "allow-pairing" | "require-trusted";
  readonly client?: {
    readonly userAgent?: string;
    readonly ipAddress?: string;
    readonly deviceId?: string;
    readonly deviceTrustContext?: IdentitySessionDeviceTrustContext;
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
  };
  readonly credential: {
    readonly candidate: string;
  };
}

export interface DevelopmentLoginIdentityApiRequest {
  readonly accessChannel?: "desktop" | "thin-client";
  readonly sessionTrustRequirement?: "allow-untrusted" | "allow-pairing" | "require-trusted";
  readonly client?: LoginLocalIdentityApiRequest["client"];
}

export type IdentitySessionAssuranceLevel =
  | "authenticated-untrusted"
  | "authenticated-trusted"
  | "authenticated-restricted";

export type IdentitySessionDeviceTrustState =
  | "unknown"
  | "untrusted"
  | "trusted"
  | "pending-pairing"
  | "revoked"
  | "expired";

export type IdentitySessionTrustInvalidationReason =
  | "trusted-device-revoked"
  | "trusted-device-trust-lost"
  | "trusted-device-expired"
  | "trusted-device-mismatch";

export interface IdentitySessionDeviceTrustSnapshot {
  readonly state: IdentitySessionDeviceTrustState;
  readonly evaluatedAt: string;
}

export interface IdentitySessionDeviceTrustContext {
  readonly trustedDeviceId?: string;
  readonly issuedOnTrustedDevice?: boolean;
  readonly sessionAssuranceLevel?: IdentitySessionAssuranceLevel;
  readonly trustStateSnapshot?: IdentitySessionDeviceTrustSnapshot;
  readonly invalidationReasons?: ReadonlyArray<IdentitySessionTrustInvalidationReason>;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export interface LoginLocalIdentityApiResponse {
  readonly userIdentityId: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly authPath: string;
  readonly authenticatedAt: string;
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly sessionTokenType: "Bearer";
  readonly sessionIssuedAt: string;
  readonly sessionExpiresAt: string;
  readonly sessionAccessChannel?: "desktop" | "thin-client";
  readonly sessionDeviceId?: string;
  readonly sessionDeviceTrustContext?: IdentitySessionDeviceTrustContext;
  readonly sessionTrustedDeviceBindingId?: string;
  readonly sessionTrustMarker?: string;
}

export type IdentitySessionRevocationReason = "logout" | "security" | "rotation" | "admin";

export interface ResolveAuthenticatedSessionApiRequest {
  readonly sessionToken: string;
}

export interface LogoutAuthenticatedSessionApiRequest {
  readonly sessionToken: string;
}

export interface LogoutAuthenticatedSessionApiResponse {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly revokedAt: string;
  readonly revocationReason: IdentitySessionRevocationReason;
}

export interface RevokeIdentitySessionApiRequest {
  readonly sessionId: string;
  readonly actorUserIdentityId?: string;
  readonly reason?: IdentitySessionRevocationReason;
}

export interface RevokeIdentitySessionApiResponse {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly revokedAt: string;
  readonly revocationReason: IdentitySessionRevocationReason;
}

export interface IdentitySessionSummaryApiResponse {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly status: "active" | "rotated" | "expired" | "revoked";
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly accessChannel?: "desktop" | "thin-client";
  readonly deviceId?: string;
  readonly trust?: {
    readonly trustedDeviceId?: string;
    readonly sessionAssuranceLevel?: IdentitySessionAssuranceLevel;
    readonly trustState?: IdentitySessionDeviceTrustState;
    readonly trustEvaluatedAt?: string;
    readonly issuedOnTrustedDevice?: boolean;
    readonly invalidationReasons?: ReadonlyArray<IdentitySessionTrustInvalidationReason>;
  };
  readonly revocation?: {
    readonly reason: IdentitySessionRevocationReason;
    readonly revokedAt: string;
  };
}

export interface ListIdentitySessionsApiRequest {
  readonly includeStatuses?: ReadonlyArray<IdentitySessionSummaryApiResponse["status"]>;
  readonly includeAccessChannels?: ReadonlyArray<"desktop" | "thin-client">;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListIdentitySessionsApiResponse {
  readonly sessions: ReadonlyArray<IdentitySessionSummaryApiResponse>;
}

export interface ListIdentityAdminSessionsApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly userIdentityId: string;
  readonly includeStatuses?: ReadonlyArray<IdentitySessionSummaryApiResponse["status"]>;
  readonly includeAccessChannels?: ReadonlyArray<"desktop" | "thin-client">;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListIdentityAdminSessionsApiResponse {
  readonly sessions: ReadonlyArray<IdentitySessionSummaryApiResponse>;
}

export interface RevokeIdentityAdminSessionApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly sessionId: string;
  readonly reason?: IdentitySessionRevocationReason;
}

export interface RevokeIdentityAdminSessionApiResponse {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly revokedAt: string;
  readonly revocationReason: IdentitySessionRevocationReason;
}

export const ChangeLocalPasswordCredentialVerificationModes = Object.freeze({
  currentCredential: "current-credential",
  resetAssertion: "reset-assertion",
} as const);

export type ChangeLocalPasswordCredentialVerificationMode =
  typeof ChangeLocalPasswordCredentialVerificationModes[keyof typeof ChangeLocalPasswordCredentialVerificationModes];

export interface ChangeLocalPasswordCredentialCurrentCredentialVerificationApiRequest {
  readonly mode?: typeof ChangeLocalPasswordCredentialVerificationModes.currentCredential;
  readonly currentCredential: string;
}

export interface ChangeLocalPasswordCredentialResetAssertionVerificationApiRequest {
  readonly mode: typeof ChangeLocalPasswordCredentialVerificationModes.resetAssertion;
  readonly resetAssertion: string;
}

export type ChangeLocalPasswordCredentialVerificationApiRequest =
  | ChangeLocalPasswordCredentialCurrentCredentialVerificationApiRequest
  | ChangeLocalPasswordCredentialResetAssertionVerificationApiRequest;

export interface ChangeLocalPasswordCredentialApiRequest {
  readonly providerId?: string;
  readonly providerSubject?: string;
  readonly credentialPolicyId?: string;
  readonly newCredential: {
    readonly candidate: string;
  };
  readonly verification: ChangeLocalPasswordCredentialVerificationApiRequest;
}

export interface ChangeLocalPasswordCredentialApiResponse {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialPolicyId: string;
  readonly supersededCredentialMaterialId: string;
  readonly credentialMaterialId: string;
  readonly changedAt: string;
  readonly verificationMode: ChangeLocalPasswordCredentialVerificationMode;
}

export interface AuthenticatedIdentityPrincipalApiResponse {
  readonly userIdentityId: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface ResolveAuthenticatedSessionApiResponse {
  readonly principal: AuthenticatedIdentityPrincipalApiResponse;
  readonly session: {
    readonly sessionId: string;
    readonly providerId: string;
    readonly providerSubject: string;
    readonly accessChannel?: "desktop" | "thin-client";
    readonly deviceId?: string;
    readonly deviceTrustContext?: IdentitySessionDeviceTrustContext;
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
  };
}

export interface IdentityAdminActionContextApiRequest {
  readonly actorUserIdentityId: string;
  readonly authorization?: {
    readonly assertions?: ReadonlyArray<string>;
    readonly scope?: string;
  };
  readonly audit?: {
    readonly reason?: string;
    readonly correlationId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
}

export type IdentityAdminAccountStatus = "pending-activation" | "active" | "suspended" | "locked" | "deactivated";
export type IdentityAdminCredentialStatus = "active" | "reset-required" | "locked" | "compromised" | "disabled";

export interface IdentityAdminAccountSummaryApiResponse {
  readonly userIdentityId: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly accountStatus: IdentityAdminAccountStatus;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialStatus?: IdentityAdminCredentialStatus;
  readonly credentialDisabledAt?: string;
  readonly linkedAt: string;
  readonly lastAuthenticatedAt?: string;
  readonly activeSessionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListIdentityAdminAccountsApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly providerId?: string;
  readonly includeStatuses?: ReadonlyArray<IdentityAdminAccountStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListIdentityAdminAccountsApiResponse {
  readonly accounts: ReadonlyArray<IdentityAdminAccountSummaryApiResponse>;
}

export interface GetIdentityAdminAccountStatusApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly userIdentityId: string;
  readonly providerId?: string;
}

export interface GetIdentityAdminAccountStatusApiResponse {
  readonly account: IdentityAdminAccountSummaryApiResponse;
}

export interface SetIdentityAdminAccountStatusApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly userIdentityId: string;
  readonly action: "enable" | "disable";
  readonly providerId?: string;
}

export interface SetIdentityAdminAccountStatusApiResponse {
  readonly userIdentityId: string;
  readonly status: IdentityAdminAccountStatus;
  readonly changed: boolean;
  readonly affectedSessionIds: ReadonlyArray<string>;
  readonly updatedAt: string;
}

export type TrustedDeviceTrustStatus = "pending-pairing" | "trusted" | "revoked" | "expired";
export type TrustedDevicePairingMethod =
  | "one-time-code"
  | "qr-code"
  | "passkey"
  | "admin-provisioned"
  | "recovery-flow";
export type TrustedDeviceRevocationReason =
  | "user-request"
  | "admin-action"
  | "lost-device"
  | "suspected-compromise"
  | "workspace-access-removed"
  | "policy-violation";
export type TrustedDevicePairingArtifactType = "one-time-code" | "qr-payload";
export type TrustedDevicePairingTokenStatus = "issued" | "consumed" | "expired" | "invalidated";
export type TrustedDevicePairingSessionStatus =
  | "initiated"
  | "validated"
  | "completed"
  | "expired"
  | "invalidated"
  | "rejected";
export type TrustedDevicePairingActorScope = "same-user" | "workspace-admin" | "bootstrap-admin" | "session-bound";

export interface TrustedDeviceMetadataApiResponse {
  readonly platform?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  readonly locale?: string;
}

export interface TrustedDeviceSummaryApiResponse {
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly displayName: string;
  readonly pairingMethod: TrustedDevicePairingMethod;
  readonly trustStatus: TrustedDeviceTrustStatus;
  readonly registeredAt: string;
  readonly pairedAt?: string;
  readonly lastSeenAt?: string;
  readonly metadata: TrustedDeviceMetadataApiResponse;
  readonly revocation?: {
    readonly reason: TrustedDeviceRevocationReason;
    readonly revokedAt: string;
    readonly revokedByUserIdentityId?: string;
    readonly note?: string;
  };
  readonly updatedAt: string;
}

export interface ListTrustedDevicesApiRequest {
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly includeStatuses?: ReadonlyArray<TrustedDeviceTrustStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListTrustedDevicesApiResponse {
  readonly devices: ReadonlyArray<TrustedDeviceSummaryApiResponse>;
}

export interface ListIdentityAdminTrustedDevicesApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly includeStatuses?: ReadonlyArray<TrustedDeviceTrustStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListIdentityAdminTrustedDevicesApiResponse {
  readonly devices: ReadonlyArray<TrustedDeviceSummaryApiResponse>;
}

export interface GetTrustedDeviceApiRequest {
  readonly trustedDeviceId: string;
}

export interface GetTrustedDeviceApiResponse {
  readonly trustedDevice: TrustedDeviceSummaryApiResponse;
}

export interface RevokeTrustedDeviceApiRequest {
  readonly trustedDeviceId: string;
  readonly reason: TrustedDeviceRevocationReason;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
  readonly revokedAt?: string;
}

export interface RevokeTrustedDeviceApiResponse {
  readonly trustedDeviceId: string;
  readonly revoked: boolean;
}

export interface RevokeIdentityAdminTrustedDeviceApiRequest {
  readonly context: IdentityAdminActionContextApiRequest;
  readonly trustedDeviceId: string;
  readonly reason: TrustedDeviceRevocationReason;
  readonly note?: string;
  readonly revokedAt?: string;
}

export interface RevokeIdentityAdminTrustedDeviceApiResponse {
  readonly trustedDeviceId: string;
  readonly revoked: boolean;
}

export interface UpdateTrustedDeviceDisplayNameApiRequest {
  readonly trustedDeviceId: string;
  readonly displayName: string;
  readonly updatedAt?: string;
}

export interface UpdateTrustedDeviceDisplayNameApiResponse {
  readonly trustedDevice: TrustedDeviceSummaryApiResponse;
}

export interface InitiateTrustedDevicePairingApiRequest {
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly artifactType: TrustedDevicePairingArtifactType;
  readonly actorBinding: {
    readonly scope: TrustedDevicePairingActorScope;
    readonly userIdentityId?: string;
    readonly sessionId?: string;
  };
  readonly issuance?: {
    readonly issuedByUserIdentityId?: string;
    readonly issuedFromIpAddress?: string;
    readonly issuedFromUserAgent?: string;
    readonly channelHint?: string;
  };
  readonly maxValidationAttempts?: number;
  readonly expiresAt: string;
}

export interface TrustedDevicePairingSessionApiResponse {
  readonly pairingSessionId: string;
  readonly trustedDeviceId: string;
  readonly status: TrustedDevicePairingSessionStatus;
  readonly initiatedAt: string;
  readonly validatedAt?: string;
  readonly completedAt?: string;
  readonly completedByUserIdentityId?: string;
  readonly rejectedAt?: string;
  readonly rejectionReason?: "invalid-token" | "token-reused" | "token-expired" | "actor-scope-violation";
  readonly rejectionNote?: string;
  readonly invalidatedAt?: string;
  readonly expiredAt?: string;
  readonly updatedAt: string;
}

export interface TrustedDevicePairingTokenApiResponse {
  readonly pairingTokenId: string;
  readonly pairingSessionId: string;
  readonly trustedDeviceId: string;
  readonly status: TrustedDevicePairingTokenStatus;
  readonly artifactType: TrustedDevicePairingArtifactType;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly failedValidationAttempts: number;
  readonly maxValidationAttempts: number;
  readonly lastValidationAttemptAt?: string;
  readonly consumedAt?: string;
  readonly consumedByUserIdentityId?: string;
  readonly invalidationReason?:
    | "manual-cancel"
    | "invalid-token-presented"
    | "token-reused"
    | "attempt-limit-reached"
    | "trusted-device-revoked";
  readonly invalidatedAt?: string;
  readonly invalidatedByUserIdentityId?: string;
  readonly invalidationNote?: string;
  readonly updatedAt: string;
}

export interface InitiateTrustedDevicePairingApiResponse {
  readonly pairingSession: TrustedDevicePairingSessionApiResponse;
  readonly pairingToken: TrustedDevicePairingTokenApiResponse;
  readonly artifact: {
    readonly type: TrustedDevicePairingArtifactType;
    readonly value: string;
    readonly redactedHint?: string;
  };
}

export interface ValidateTrustedDevicePairingApiRequest {
  readonly pairingSessionId: string;
  readonly pairingTokenId?: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly presentedToken: string;
  readonly attemptedAt?: string;
}

export interface ValidateTrustedDevicePairingApiResponse {
  readonly outcome:
    | "valid"
    | "invalid"
    | "expired"
    | "reused"
    | "invalidated"
    | "attempts-exhausted"
    | "actor-scope-violation";
  readonly attemptsRemaining: number;
  readonly pairingSession: TrustedDevicePairingSessionApiResponse;
  readonly pairingToken: TrustedDevicePairingTokenApiResponse;
}

export interface CompleteTrustedDevicePairingApiRequest {
  readonly pairingSessionId: string;
  readonly pairingTokenId: string;
  readonly trustedDeviceId: string;
  readonly userIdentityId: string;
  readonly workspaceId?: string;
  readonly trustedDeviceRegistration?: {
    readonly displayName: string;
    readonly fingerprint: {
      readonly algorithm: "sha256" | "sha512" | "opaque";
      readonly value: string;
      readonly capturedAt: string;
    };
    readonly pairingMethod: TrustedDevicePairingMethod;
    readonly metadata?: TrustedDeviceMetadataApiResponse & {
      readonly lastIpAddress?: string;
    };
    readonly registeredAt?: string;
  };
  readonly presentedToken: string;
  readonly completedAt?: string;
  readonly completedByUserIdentityId?: string;
  readonly trustMaterialRef?: {
    readonly materialId: string;
    readonly kind: "session-signing-key" | "attestation-key" | "opaque-marker";
    readonly version?: string;
    readonly issuedAt: string;
    readonly expiresAt?: string;
  };
  readonly trustMaterialRegistration?: {
    readonly materialKind: "session-signing-key" | "attestation-key" | "opaque-marker";
    readonly pinReference: string;
    readonly publicKeyFingerprint?: string;
  };
}

export interface CompleteTrustedDevicePairingApiResponse {
  readonly pairingSession: TrustedDevicePairingSessionApiResponse;
  readonly pairingToken: TrustedDevicePairingTokenApiResponse;
  readonly trustedDevice: TrustedDeviceSummaryApiResponse;
}
