import type { IdentitySessionStatus } from "../../src/domain/identity/IdentityDomain";
import type { UserIdentityStatus } from "../../src/domain/identity/IdentityDomain";

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

export const IdentityIdNamespaces = Object.freeze({
  userIdentity: "user-identity",
  identitySession: "identity-session",
  provider: "provider",
  credentialPolicy: "credential-policy",
  credentialMaterial: "credential-material",
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
