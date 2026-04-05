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
  readonly validationErrors?: ReadonlyArray<IdentityAuthApiValidationError>;
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
