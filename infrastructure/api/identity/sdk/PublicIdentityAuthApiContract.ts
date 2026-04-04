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
}
