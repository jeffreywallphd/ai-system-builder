export const IdentityAuthApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  conflict: "conflict",
  authenticationFailed: "authentication-failed",
  accountInactive: "account-inactive",
  unsupportedProvider: "unsupported-provider",
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
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
  };
  readonly credential: {
    readonly candidate: string;
  };
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
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
  };
}
