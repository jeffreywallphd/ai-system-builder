import type {
  IdentitySessionStatus,
  UserIdentityStatus,
} from "@domain/identity/IdentityDomain";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

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

export interface IdentityUserIdentityListQuery {
  readonly providerId?: string;
  readonly includeStatuses?: ReadonlyArray<UserIdentityStatus>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface IdentitySessionListQuery {
  readonly userIdentityId?: string;
  readonly providerId?: string;
  readonly providerSubject?: string;
  readonly includeStatuses?: ReadonlyArray<IdentitySessionStatus>;
  readonly includeExpired?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
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

export interface IdentitySessionTokenMaterialLookupQuery {
  readonly sessionId?: string;
  readonly tokenHash?: string;
  readonly includeInvalidated?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface IdentityPersistenceMutationContext {
  readonly operationKey: string;
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}

export function normalizeIdentityPersistenceOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}

export interface IdentityPersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface IdentityPersistenceDeletionResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

