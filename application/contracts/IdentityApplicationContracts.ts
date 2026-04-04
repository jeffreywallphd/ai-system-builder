import type { IdentitySessionStatus } from "../../src/domain/identity/IdentityDomain";

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

export const IdentityIdNamespaces = Object.freeze({
  userIdentity: "user-identity",
  identitySession: "identity-session",
  provider: "provider",
  credentialPolicy: "credential-policy",
  credentialMaterial: "credential-material",
});

export type IdentityIdNamespace =
  typeof IdentityIdNamespaces[keyof typeof IdentityIdNamespaces];
