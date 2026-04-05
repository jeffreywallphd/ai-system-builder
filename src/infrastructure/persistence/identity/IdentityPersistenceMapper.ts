import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  CredentialStatuses,
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  UserIdentityStatuses,
  createCredentialPolicy,
  createSession,
  type IdentitySessionAccessChannel,
  type AuthProvider,
  type CredentialPolicy,
  type CredentialState,
  type Session,
  type UserIdentity,
  type UserIdentityProviderLink,
} from "../../../domain/identity/IdentityDomain";
import type { IdentityCredentialMaterialRecord } from "../../../../application/contracts/IdentityApplicationContracts";
import type { IdentitySessionTokenMaterialRecord } from "../../../../application/contracts/IdentityApplicationContracts";

export interface UserIdentityRow {
  readonly user_identity_id: string;
  readonly username: string;
  readonly email: string | null;
  readonly display_name: string | null;
  readonly status: UserIdentity["status"];
  readonly created_at: string;
  readonly updated_at: string;
  readonly activated_at: string | null;
  readonly suspended_at: string | null;
  readonly locked_at: string | null;
  readonly deactivated_at: string | null;
}

export interface UserProviderLinkRow {
  readonly user_identity_id: string;
  readonly provider_id: string;
  readonly provider_subject: string;
  readonly is_primary: number;
  readonly linked_at: string;
  readonly unlinked_at: string | null;
  readonly credential_status: CredentialState["status"] | null;
  readonly credential_policy_id: string | null;
  readonly credential_failed_attempts: number | null;
  readonly credential_lockout_until: string | null;
  readonly credential_password_changed_at: string | null;
  readonly credential_reset_required_at: string | null;
  readonly credential_compromised_at: string | null;
  readonly credential_disabled_at: string | null;
  readonly last_authenticated_at: string | null;
}

export interface AuthProviderRow {
  readonly provider_id: string;
  readonly kind: AuthProvider["kind"];
  readonly category: AuthProvider["category"];
  readonly display_name: string;
  readonly is_first_party: number;
  readonly status: AuthProvider["status"];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CredentialPolicyRow {
  readonly policy_id: string;
  readonly min_length: number;
  readonly max_length: number;
  readonly require_lowercase: number;
  readonly require_uppercase: number;
  readonly require_number: number;
  readonly require_symbol: number;
  readonly min_unique_characters: number;
  readonly max_repeated_characters: number;
  readonly blocked_substrings_json: string;
  readonly min_password_age_days: number;
  readonly max_password_age_days: number;
  readonly password_history_count: number;
  readonly max_failed_attempts: number;
  readonly lockout_duration_minutes: number;
}

export interface CredentialMaterialRow {
  readonly credential_material_id: string;
  readonly user_identity_id: string;
  readonly provider_id: string;
  readonly provider_subject: string;
  readonly hash_algorithm: string;
  readonly hash_value: string;
  readonly salt: string | null;
  readonly pepper_version: string | null;
  readonly status: IdentityCredentialMaterialRecord["status"];
  readonly created_at: string;
  readonly updated_at: string;
  readonly superseded_at: string | null;
  readonly expires_at: string | null;
}

export interface SessionRow {
  readonly session_id: string;
  readonly user_identity_id: string;
  readonly provider_id: string;
  readonly provider_subject: string;
  readonly status: Session["status"];
  readonly issued_at: string;
  readonly expires_at: string;
  readonly rotated_at: string | null;
  readonly replaced_by_session_id: string | null;
  readonly revocation_reason: "logout" | "security" | "rotation" | "admin" | null;
  readonly revoked_at: string | null;
  readonly client_access_channel: IdentitySessionAccessChannel | null;
  readonly client_user_agent: string | null;
  readonly client_ip_address: string | null;
  readonly client_device_id: string | null;
  readonly client_trusted_device_id: string | null;
  readonly client_issued_on_trusted_device: number | null;
  readonly client_session_assurance_level: "authenticated-untrusted" | "authenticated-trusted" | "authenticated-restricted" | null;
  readonly client_device_trust_state: "unknown" | "untrusted" | "trusted" | "pending-pairing" | "revoked" | "expired" | null;
  readonly client_device_trust_evaluated_at: string | null;
  readonly client_device_trust_invalidation_reasons_json: string | null;
  readonly client_trusted_device_binding_id: string | null;
  readonly client_trust_marker: string | null;
}

export interface SessionTokenMaterialRow {
  readonly session_id: string;
  readonly token_hash: string;
  readonly hash_algorithm: "sha256";
  readonly token_type: "opaque-bearer";
  readonly created_at: string;
  readonly updated_at: string;
  readonly expires_at: string;
  readonly invalidated_at: string | null;
}

export function mapUserIdentityRowToDomain(
  row: UserIdentityRow,
  linkRows: ReadonlyArray<UserProviderLinkRow>,
): UserIdentity {
  return Object.freeze({
    id: row.user_identity_id,
    username: row.username,
    email: row.email ?? undefined,
    displayName: row.display_name ?? undefined,
    status: assertUserIdentityStatus(row.status),
    linkedProviders: Object.freeze(linkRows.map((linkRow) => mapProviderLinkRowToDomain(linkRow))),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at ?? undefined,
    suspendedAt: row.suspended_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    deactivatedAt: row.deactivated_at ?? undefined,
  });
}

export function mapProviderLinkRowToDomain(row: UserProviderLinkRow): UserIdentityProviderLink {
  return Object.freeze({
    providerId: row.provider_id,
    providerSubject: row.provider_subject,
    isPrimary: row.is_primary === 1,
    linkedAt: row.linked_at,
    unlinkedAt: row.unlinked_at ?? undefined,
    credentialState: mapCredentialStateFromProviderLinkRow(row),
    lastAuthenticatedAt: row.last_authenticated_at ?? undefined,
  });
}

function mapCredentialStateFromProviderLinkRow(row: UserProviderLinkRow): CredentialState | undefined {
  if (!row.credential_status || !row.credential_policy_id) {
    return undefined;
  }

  return Object.freeze({
    status: assertCredentialStatus(row.credential_status),
    policyId: row.credential_policy_id,
    failedAttempts: row.credential_failed_attempts ?? 0,
    lockoutUntil: row.credential_lockout_until ?? undefined,
    passwordChangedAt: row.credential_password_changed_at ?? undefined,
    resetRequiredAt: row.credential_reset_required_at ?? undefined,
    compromisedAt: row.credential_compromised_at ?? undefined,
    disabledAt: row.credential_disabled_at ?? undefined,
  });
}

export function mapAuthProviderRowToDomain(row: AuthProviderRow): AuthProvider {
  return Object.freeze({
    id: row.provider_id,
    kind: assertAuthProviderKind(row.kind),
    category: assertAuthProviderCategory(row.category),
    displayName: row.display_name,
    isFirstParty: row.is_first_party === 1,
    status: assertAuthProviderStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapCredentialPolicyRowToDomain(row: CredentialPolicyRow): CredentialPolicy {
  return createCredentialPolicy({
    id: row.policy_id,
    minLength: row.min_length,
    maxLength: row.max_length,
    requireLowercase: row.require_lowercase === 1,
    requireUppercase: row.require_uppercase === 1,
    requireNumber: row.require_number === 1,
    requireSymbol: row.require_symbol === 1,
    minUniqueCharacters: row.min_unique_characters,
    maxRepeatedCharacters: row.max_repeated_characters,
    blockedSubstrings: parseBlockedSubstrings(row.blocked_substrings_json),
    minPasswordAgeDays: row.min_password_age_days,
    maxPasswordAgeDays: row.max_password_age_days,
    passwordHistoryCount: row.password_history_count,
    maxFailedAttempts: row.max_failed_attempts,
    lockoutDurationMinutes: row.lockout_duration_minutes,
  });
}

export function mapCredentialMaterialRowToRecord(row: CredentialMaterialRow): IdentityCredentialMaterialRecord {
  return Object.freeze({
    id: row.credential_material_id,
    userIdentityId: row.user_identity_id,
    providerId: row.provider_id,
    providerSubject: row.provider_subject,
    hashAlgorithm: row.hash_algorithm,
    hashValue: row.hash_value,
    salt: row.salt ?? undefined,
    pepperVersion: row.pepper_version ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supersededAt: row.superseded_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  });
}

export function mapSessionRowToDomain(row: SessionRow): Session {
  const base = createSession({
    id: row.session_id,
    userIdentityId: row.user_identity_id,
    providerId: row.provider_id,
    providerSubject: row.provider_subject,
    issuedAt: new Date(row.issued_at),
    expiresAt: new Date(row.expires_at),
    client: {
      accessChannel: row.client_access_channel ? assertSessionAccessChannel(row.client_access_channel) : undefined,
      userAgent: row.client_user_agent ?? undefined,
      ipAddress: row.client_ip_address ?? undefined,
      deviceId: row.client_device_id ?? undefined,
      deviceTrust: row.client_trusted_device_id
        || row.client_issued_on_trusted_device !== null
        || row.client_session_assurance_level
        || row.client_device_trust_state
        || row.client_device_trust_evaluated_at
        || row.client_device_trust_invalidation_reasons_json
        ? Object.freeze({
            trustedDeviceId: row.client_trusted_device_id ?? undefined,
            issuedOnTrustedDevice: row.client_issued_on_trusted_device === 1,
            sessionAssuranceLevel: row.client_session_assurance_level ?? "authenticated-untrusted",
            snapshot: Object.freeze({
              state: row.client_device_trust_state ?? "unknown",
              evaluatedAt: row.client_device_trust_evaluated_at ?? row.issued_at,
            }),
            invalidationReasons: parseSessionTrustInvalidationReasons(
              row.client_device_trust_invalidation_reasons_json,
            ),
            trustedDeviceBindingId: row.client_trusted_device_binding_id ?? row.client_trusted_device_id ?? undefined,
            trustMarker: row.client_trust_marker ?? undefined,
          })
        : undefined,
      trustedDeviceBindingId: row.client_trusted_device_binding_id ?? undefined,
      trustMarker: row.client_trust_marker ?? undefined,
    },
  });

  const revocation = row.revocation_reason && row.revoked_at
    ? Object.freeze({ reason: row.revocation_reason, revokedAt: row.revoked_at })
    : undefined;

  return Object.freeze({
    ...base,
    status: assertSessionStatus(row.status),
    rotatedAt: row.rotated_at ?? undefined,
    replacedBySessionId: row.replaced_by_session_id ?? undefined,
    revocation,
  });
}

export function mapSessionTokenMaterialRowToRecord(
  row: SessionTokenMaterialRow,
): IdentitySessionTokenMaterialRecord {
  return Object.freeze({
    sessionId: row.session_id,
    tokenHash: row.token_hash,
    hashAlgorithm: row.hash_algorithm,
    tokenType: row.token_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    invalidatedAt: row.invalidated_at ?? undefined,
  });
}

export function mapCredentialPolicyToRowValues(policy: CredentialPolicy): ReadonlyArray<unknown> {
  return Object.freeze([
    policy.id,
    policy.minLength,
    policy.maxLength,
    toBooleanInteger(policy.requireLowercase),
    toBooleanInteger(policy.requireUppercase),
    toBooleanInteger(policy.requireNumber),
    toBooleanInteger(policy.requireSymbol),
    policy.minUniqueCharacters,
    policy.maxRepeatedCharacters,
    JSON.stringify(policy.blockedSubstrings),
    policy.minPasswordAgeDays,
    policy.maxPasswordAgeDays,
    policy.passwordHistoryCount,
    policy.maxFailedAttempts,
    policy.lockoutDurationMinutes,
  ]);
}

export function mapAuthProviderToRowValues(provider: AuthProvider): ReadonlyArray<unknown> {
  return Object.freeze([
    provider.id,
    provider.kind,
    provider.category,
    provider.displayName,
    toBooleanInteger(provider.isFirstParty),
    provider.status,
    provider.createdAt,
    provider.updatedAt,
  ]);
}

export function mapUserIdentityToRowValues(identity: UserIdentity): ReadonlyArray<unknown> {
  return Object.freeze([
    identity.id,
    identity.username,
    identity.email ?? null,
    identity.displayName ?? null,
    identity.status,
    identity.createdAt,
    identity.updatedAt,
    identity.activatedAt ?? null,
    identity.suspendedAt ?? null,
    identity.lockedAt ?? null,
    identity.deactivatedAt ?? null,
  ]);
}

export function mapProviderLinkToRowValues(
  userIdentityId: string,
  link: UserIdentityProviderLink,
): ReadonlyArray<unknown> {
  return Object.freeze([
    userIdentityId,
    link.providerId,
    link.providerSubject,
    toBooleanInteger(link.isPrimary),
    link.linkedAt,
    link.unlinkedAt ?? null,
    link.credentialState?.status ?? null,
    link.credentialState?.policyId ?? null,
    link.credentialState?.failedAttempts ?? null,
    link.credentialState?.lockoutUntil ?? null,
    link.credentialState?.passwordChangedAt ?? null,
    link.credentialState?.resetRequiredAt ?? null,
    link.credentialState?.compromisedAt ?? null,
    link.credentialState?.disabledAt ?? null,
    link.lastAuthenticatedAt ?? null,
  ]);
}

export function mapCredentialMaterialToRowValues(record: IdentityCredentialMaterialRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    record.id,
    record.userIdentityId,
    record.providerId,
    record.providerSubject,
    record.hashAlgorithm,
    record.hashValue,
    record.salt ?? null,
    record.pepperVersion ?? null,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.supersededAt ?? null,
    record.expiresAt ?? null,
  ]);
}

export function mapSessionToRowValues(session: Session): ReadonlyArray<unknown> {
  return Object.freeze([
    session.id,
    session.userIdentityId,
    session.providerId,
    session.providerSubject,
    session.status,
    session.issuedAt,
    session.expiresAt,
    session.rotatedAt ?? null,
    session.replacedBySessionId ?? null,
    session.revocation?.reason ?? null,
    session.revocation?.revokedAt ?? null,
    session.client?.accessChannel ?? null,
    session.client?.userAgent ?? null,
    session.client?.ipAddress ?? null,
    session.client?.deviceId ?? null,
    session.client?.deviceTrust?.trustedDeviceId ?? null,
    typeof session.client?.deviceTrust?.issuedOnTrustedDevice === "boolean"
      ? toBooleanInteger(session.client.deviceTrust.issuedOnTrustedDevice)
      : null,
    session.client?.deviceTrust?.sessionAssuranceLevel ?? null,
    session.client?.deviceTrust?.snapshot?.state ?? null,
    session.client?.deviceTrust?.snapshot?.evaluatedAt ?? null,
    session.client?.deviceTrust
      ? JSON.stringify(session.client.deviceTrust.invalidationReasons)
      : null,
    session.client?.trustedDeviceBindingId ?? null,
    session.client?.trustMarker ?? null,
  ]);
}

export function mapSessionTokenMaterialToRowValues(
  record: IdentitySessionTokenMaterialRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.sessionId,
    record.tokenHash,
    record.hashAlgorithm,
    record.tokenType,
    record.createdAt,
    record.updatedAt,
    record.expiresAt,
    record.invalidatedAt ?? null,
  ]);
}

export function normalizeLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseBlockedSubstrings(json: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    return Object.freeze(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return Object.freeze([]);
  }
}

function toBooleanInteger(value: boolean): number {
  return value ? 1 : 0;
}

function parseSessionTrustInvalidationReasons(
  value: string | null,
): ReadonlyArray<"trusted-device-revoked" | "trusted-device-trust-lost" | "trusted-device-expired" | "trusted-device-mismatch"> {
  if (!value) {
    return Object.freeze([]);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    return Object.freeze(
      parsed.filter((entry): entry is "trusted-device-revoked" | "trusted-device-trust-lost" | "trusted-device-expired" | "trusted-device-mismatch" => (
        entry === "trusted-device-revoked"
        || entry === "trusted-device-trust-lost"
        || entry === "trusted-device-expired"
        || entry === "trusted-device-mismatch"
      )),
    );
  } catch {
    return Object.freeze([]);
  }
}

function assertAuthProviderKind(value: string): AuthProvider["kind"] {
  if (Object.values(AuthProviderKinds).includes(value as AuthProvider["kind"])) {
    return value as AuthProvider["kind"];
  }
  throw new Error(`Persisted auth provider kind '${value}' is invalid.`);
}

function assertAuthProviderCategory(value: string): AuthProvider["category"] {
  if (Object.values(AuthProviderCategories).includes(value as AuthProvider["category"])) {
    return value as AuthProvider["category"];
  }
  throw new Error(`Persisted auth provider category '${value}' is invalid.`);
}

function assertAuthProviderStatus(value: string): AuthProvider["status"] {
  if (Object.values(AuthProviderStatuses).includes(value as AuthProvider["status"])) {
    return value as AuthProvider["status"];
  }
  throw new Error(`Persisted auth provider status '${value}' is invalid.`);
}

function assertUserIdentityStatus(value: string): UserIdentity["status"] {
  if (Object.values(UserIdentityStatuses).includes(value as UserIdentity["status"])) {
    return value as UserIdentity["status"];
  }
  throw new Error(`Persisted user identity status '${value}' is invalid.`);
}

function assertCredentialStatus(value: string): CredentialState["status"] {
  if (Object.values(CredentialStatuses).includes(value as CredentialState["status"])) {
    return value as CredentialState["status"];
  }
  throw new Error(`Persisted credential status '${value}' is invalid.`);
}

function assertSessionStatus(value: string): Session["status"] {
  if (Object.values(IdentitySessionStatuses).includes(value as Session["status"])) {
    return value as Session["status"];
  }
  throw new Error(`Persisted identity session status '${value}' is invalid.`);
}

function assertSessionAccessChannel(value: string): IdentitySessionAccessChannel {
  if (Object.values(IdentitySessionAccessChannels).includes(value as IdentitySessionAccessChannel)) {
    return value as IdentitySessionAccessChannel;
  }
  throw new Error(`Persisted identity session access channel '${value}' is invalid.`);
}
