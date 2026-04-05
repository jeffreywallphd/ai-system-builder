import fs from "node:fs";
import path from "node:path";
import type {
  IdentityErrorCode,
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityPrincipalLookup,
  IdentitySessionListQuery,
  IdentitySessionTokenMaterialRecord,
  IdentityProviderSubjectReference,
} from "../../../application/contracts/IdentityApplicationContracts";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
} from "../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityLookupRepository } from "../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../application/identity/ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../../../application/identity/ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../../../application/identity/ports/IIdentitySessionTokenMaterialRepository";
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
} from "../../../src/domain/identity/IdentityDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { IDENTITY_MIGRATIONS, IDENTITY_SCHEMA_VERSION } from "./SqliteIdentityMigrations";

interface UserRow {
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

interface ProviderLinkRow {
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

interface ProviderRow {
  readonly provider_id: string;
  readonly kind: AuthProvider["kind"];
  readonly category: AuthProvider["category"];
  readonly display_name: string;
  readonly is_first_party: number;
  readonly status: AuthProvider["status"];
  readonly created_at: string;
  readonly updated_at: string;
}

interface PolicyRow {
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

interface CredentialMaterialRow {
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

interface SessionRow {
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
}

interface SessionTokenMaterialRow {
  readonly session_id: string;
  readonly token_hash: string;
  readonly hash_algorithm: "sha256";
  readonly token_type: "opaque-bearer";
  readonly created_at: string;
  readonly updated_at: string;
  readonly expires_at: string;
  readonly invalidated_at: string | null;
}

export class SqliteIdentityRepository
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    IIdentitySessionTokenMaterialRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async saveUserIdentity(identity: UserIdentity): Promise<UserIdentity> {
    const db = this.getDatabase();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO identity_user_identities (
          user_identity_id,
          username,
          email,
          display_name,
          status,
          created_at,
          updated_at,
          activated_at,
          suspended_at,
          locked_at,
          deactivated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_identity_id) DO UPDATE SET
          username = excluded.username,
          email = excluded.email,
          display_name = excluded.display_name,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          activated_at = excluded.activated_at,
          suspended_at = excluded.suspended_at,
          locked_at = excluded.locked_at,
          deactivated_at = excluded.deactivated_at
      `).run(
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
      );

      db.prepare("DELETE FROM identity_user_provider_links WHERE user_identity_id = ?")
        .run(identity.id);

      const insertLink = db.prepare(`
        INSERT INTO identity_user_provider_links (
          user_identity_id,
          provider_id,
          provider_subject,
          is_primary,
          linked_at,
          unlinked_at,
          credential_status,
          credential_policy_id,
          credential_failed_attempts,
          credential_lockout_until,
          credential_password_changed_at,
          credential_reset_required_at,
          credential_compromised_at,
          credential_disabled_at,
          last_authenticated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const link of identity.linkedProviders) {
        insertLink.run(
          identity.id,
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
        );
      }
    })();

    return identity;
  }

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_auth_providers (
          provider_id,
          kind,
          category,
          display_name,
          is_first_party,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider_id) DO UPDATE SET
          kind = excluded.kind,
          category = excluded.category,
          display_name = excluded.display_name,
          is_first_party = excluded.is_first_party,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `)
      .run(
        provider.id,
        provider.kind,
        provider.category,
        provider.displayName,
        toBooleanInteger(provider.isFirstParty),
        provider.status,
        provider.createdAt,
        provider.updatedAt,
      );

    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_credential_policies (
          policy_id,
          min_length,
          max_length,
          require_lowercase,
          require_uppercase,
          require_number,
          require_symbol,
          min_unique_characters,
          max_repeated_characters,
          blocked_substrings_json,
          min_password_age_days,
          max_password_age_days,
          password_history_count,
          max_failed_attempts,
          lockout_duration_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(policy_id) DO UPDATE SET
          min_length = excluded.min_length,
          max_length = excluded.max_length,
          require_lowercase = excluded.require_lowercase,
          require_uppercase = excluded.require_uppercase,
          require_number = excluded.require_number,
          require_symbol = excluded.require_symbol,
          min_unique_characters = excluded.min_unique_characters,
          max_repeated_characters = excluded.max_repeated_characters,
          blocked_substrings_json = excluded.blocked_substrings_json,
          min_password_age_days = excluded.min_password_age_days,
          max_password_age_days = excluded.max_password_age_days,
          password_history_count = excluded.password_history_count,
          max_failed_attempts = excluded.max_failed_attempts,
          lockout_duration_minutes = excluded.lockout_duration_minutes
      `)
      .run(
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
      );

    return policy;
  }
  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    const normalizedId = normalizeLookup(userIdentityId);
    if (!normalizedId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          user_identity_id,
          username,
          email,
          display_name,
          status,
          created_at,
          updated_at,
          activated_at,
          suspended_at,
          locked_at,
          deactivated_at
        FROM identity_user_identities
        WHERE user_identity_id = ?
      `)
      .get(normalizedId) as UserRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async countUserIdentities(): Promise<number> {
    const row = this.getDatabase()
      .prepare("SELECT COUNT(*) AS total FROM identity_user_identities")
      .get() as { total?: number } | undefined;

    return typeof row?.total === "number" ? row.total : 0;
  }

  public async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    const normalizedValue = normalizeLookup(lookup.value)?.toLowerCase();
    if (!normalizedValue) {
      return undefined;
    }

    const column = lookup.kind === "username" ? "username" : "email";
    const row = this.getDatabase()
      .prepare(`
        SELECT
          user_identity_id,
          username,
          email,
          display_name,
          status,
          created_at,
          updated_at,
          activated_at,
          suspended_at,
          locked_at,
          deactivated_at
        FROM identity_user_identities
        WHERE ${column} = ?
      `)
      .get(normalizedValue) as UserRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference): Promise<UserIdentity | undefined> {
    const providerId = normalizeLookup(reference.providerId);
    const providerSubject = normalizeLookup(reference.providerSubject);
    if (!providerId || !providerSubject) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          u.user_identity_id,
          u.username,
          u.email,
          u.display_name,
          u.status,
          u.created_at,
          u.updated_at,
          u.activated_at,
          u.suspended_at,
          u.locked_at,
          u.deactivated_at
        FROM identity_user_identities u
        JOIN identity_user_provider_links l
          ON l.user_identity_id = u.user_identity_id
        WHERE l.provider_id = ? AND l.provider_subject = ?
        LIMIT 1
      `)
      .get(providerId, providerSubject) as UserRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async findAuthProviderById(providerId: string): Promise<AuthProvider | undefined> {
    const normalizedId = normalizeLookup(providerId);
    if (!normalizedId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          provider_id,
          kind,
          category,
          display_name,
          is_first_party,
          status,
          created_at,
          updated_at
        FROM identity_auth_providers
        WHERE provider_id = ?
      `)
      .get(normalizedId) as ProviderRow | undefined;

    return row ? hydrateProvider(row) : undefined;
  }

  public async findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined> {
    const normalizedId = normalizeLookup(policyId);
    if (!normalizedId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          policy_id,
          min_length,
          max_length,
          require_lowercase,
          require_uppercase,
          require_number,
          require_symbol,
          min_unique_characters,
          max_repeated_characters,
          blocked_substrings_json,
          min_password_age_days,
          max_password_age_days,
          password_history_count,
          max_failed_attempts,
          lockout_duration_minutes
        FROM identity_credential_policies
        WHERE policy_id = ?
      `)
      .get(normalizedId) as PolicyRow | undefined;

    return row ? hydratePolicy(row) : undefined;
  }

  public async getActiveCredentialMaterial(reference: IdentityProviderSubjectReference): Promise<IdentityCredentialMaterialRecord | undefined> {
    const providerId = normalizeLookup(reference.providerId);
    const providerSubject = normalizeLookup(reference.providerSubject);
    if (!providerId || !providerSubject) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          credential_material_id,
          user_identity_id,
          provider_id,
          provider_subject,
          hash_algorithm,
          hash_value,
          salt,
          pepper_version,
          status,
          created_at,
          updated_at,
          superseded_at,
          expires_at
        FROM identity_credential_material_records
        WHERE provider_id = ?
          AND provider_subject = ?
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(providerId, providerSubject) as CredentialMaterialRow | undefined;

    return row ? hydrateCredentialMaterial(row) : undefined;
  }

  public async listCredentialMaterialHistory(query: IdentityCredentialHistoryQuery): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>> {
    const providerId = normalizeLookup(query.reference.providerId);
    const providerSubject = normalizeLookup(query.reference.providerSubject);
    if (!providerId || !providerSubject) {
      return Object.freeze([]);
    }

    const where: string[] = ["provider_id = ?", "provider_subject = ?"];
    const params: unknown[] = [providerId, providerSubject];

    if (!(query.includeInactive ?? false)) {
      where.push("status = 'active'");
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          credential_material_id,
          user_identity_id,
          provider_id,
          provider_subject,
          hash_algorithm,
          hash_value,
          salt,
          pepper_version,
          status,
          created_at,
          updated_at,
          superseded_at,
          expires_at
        FROM identity_credential_material_records
        WHERE ${where.join(" AND ")}
        ORDER BY created_at ASC
        ${hasLimit ? "LIMIT ?" : ""}
      `)
      .all(...(hasLimit ? [...params, query.limit] : params)) as CredentialMaterialRow[];

    return Object.freeze(rows.map((row) => hydrateCredentialMaterial(row)));
  }

  public async saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord> {
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_credential_material_records (
          credential_material_id,
          user_identity_id,
          provider_id,
          provider_subject,
          hash_algorithm,
          hash_value,
          salt,
          pepper_version,
          status,
          created_at,
          updated_at,
          superseded_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(credential_material_id) DO UPDATE SET
          user_identity_id = excluded.user_identity_id,
          provider_id = excluded.provider_id,
          provider_subject = excluded.provider_subject,
          hash_algorithm = excluded.hash_algorithm,
          hash_value = excluded.hash_value,
          salt = excluded.salt,
          pepper_version = excluded.pepper_version,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          superseded_at = excluded.superseded_at,
          expires_at = excluded.expires_at
      `)
      .run(
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
      );

    return record;
  }

  public async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidRequest>> {
    const normalizedId = normalizeLookup(recordId);
    const normalizedSupersededAt = normalizeLookup(supersededAt);
    if (!normalizedId || !normalizedSupersededAt) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        "Credential material supersede request requires non-empty record id and supersededAt timestamp.",
      );
    }

    const result = this.getDatabase()
      .prepare(`
        UPDATE identity_credential_material_records
        SET status = 'superseded', superseded_at = ?, updated_at = ?
        WHERE credential_material_id = ?
      `)
      .run(normalizedSupersededAt, normalizedSupersededAt, normalizedId);

    return identitySuccess(Object.freeze({
      changed: result.changes > 0,
    }));
  }
  public async saveSession(session: Session): Promise<Session> {
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_sessions (
          session_id,
          user_identity_id,
          provider_id,
          provider_subject,
          status,
          issued_at,
          expires_at,
          rotated_at,
          replaced_by_session_id,
          revocation_reason,
          revoked_at,
          client_access_channel,
          client_user_agent,
          client_ip_address,
          client_device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          user_identity_id = excluded.user_identity_id,
          provider_id = excluded.provider_id,
          provider_subject = excluded.provider_subject,
          status = excluded.status,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at,
          rotated_at = excluded.rotated_at,
          replaced_by_session_id = excluded.replaced_by_session_id,
          revocation_reason = excluded.revocation_reason,
          revoked_at = excluded.revoked_at,
          client_access_channel = excluded.client_access_channel,
          client_user_agent = excluded.client_user_agent,
          client_ip_address = excluded.client_ip_address,
          client_device_id = excluded.client_device_id
      `)
      .run(
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
      );

    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    const normalizedId = normalizeLookup(sessionId);
    if (!normalizedId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          session_id,
          user_identity_id,
          provider_id,
          provider_subject,
          status,
          issued_at,
          expires_at,
          rotated_at,
          replaced_by_session_id,
          revocation_reason,
          revoked_at,
          client_access_channel,
          client_user_agent,
          client_ip_address,
          client_device_id
        FROM identity_sessions
        WHERE session_id = ?
      `)
      .get(normalizedId) as SessionRow | undefined;

    return row ? hydrateSession(row) : undefined;
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    const userIdentityId = normalizeLookup(query.userIdentityId);
    if (!userIdentityId) {
      return Object.freeze([]);
    }

    const where: string[] = ["user_identity_id = ?"];
    const params: unknown[] = [userIdentityId];

    if (query.includeStatuses && query.includeStatuses.length > 0) {
      where.push(`status IN (${query.includeStatuses.map(() => "?").join(", ")})`);
      params.push(...query.includeStatuses);
    }

    if (query.expiresBefore) {
      where.push("expires_at < ?");
      params.push(query.expiresBefore);
    }

    if (query.expiresAfter) {
      where.push("expires_at > ?");
      params.push(query.expiresAfter);
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          session_id,
          user_identity_id,
          provider_id,
          provider_subject,
          status,
          issued_at,
          expires_at,
          rotated_at,
          replaced_by_session_id,
          revocation_reason,
          revoked_at,
          client_access_channel,
          client_user_agent,
          client_ip_address,
          client_device_id
        FROM identity_sessions
        WHERE ${where.join(" AND ")}
        ORDER BY issued_at DESC
        ${hasLimit ? "LIMIT ?" : ""}
      `)
      .all(...(hasLimit ? [...params, query.limit] : params)) as SessionRow[];

    return Object.freeze(rows.map((row) => hydrateSession(row)));
  }

  public async removeSession(
    sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    const normalizedId = normalizeLookup(sessionId);
    if (!normalizedId) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        "Session removal requires a non-empty session id.",
      );
    }

    const result = this.getDatabase()
      .prepare("DELETE FROM identity_sessions WHERE session_id = ?")
      .run(normalizedId);

    return identitySuccess(Object.freeze({
      changed: result.changes > 0,
    }));
  }

  public async saveSessionTokenMaterial(
    record: IdentitySessionTokenMaterialRecord,
  ): Promise<IdentitySessionTokenMaterialRecord> {
    this.getDatabase()
      .prepare(`
        INSERT INTO identity_session_token_material (
          session_id,
          token_hash,
          hash_algorithm,
          token_type,
          created_at,
          updated_at,
          expires_at,
          invalidated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          token_hash = excluded.token_hash,
          hash_algorithm = excluded.hash_algorithm,
          token_type = excluded.token_type,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at,
          invalidated_at = excluded.invalidated_at
      `)
      .run(
        record.sessionId,
        record.tokenHash,
        record.hashAlgorithm,
        record.tokenType,
        record.createdAt,
        record.updatedAt,
        record.expiresAt,
        record.invalidatedAt ?? null,
      );

    return record;
  }

  public async getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedSessionId = normalizeLookup(sessionId);
    if (!normalizedSessionId) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          session_id,
          token_hash,
          hash_algorithm,
          token_type,
          created_at,
          updated_at,
          expires_at,
          invalidated_at
        FROM identity_session_token_material
        WHERE session_id = ?
      `)
      .get(normalizedSessionId) as SessionTokenMaterialRow | undefined;

    return row ? hydrateSessionTokenMaterial(row) : undefined;
  }

  public async getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedTokenHash = normalizeLookup(tokenHash);
    if (!normalizedTokenHash) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare(`
        SELECT
          session_id,
          token_hash,
          hash_algorithm,
          token_type,
          created_at,
          updated_at,
          expires_at,
          invalidated_at
        FROM identity_session_token_material
        WHERE token_hash = ?
      `)
      .get(normalizedTokenHash) as SessionTokenMaterialRow | undefined;

    return row ? hydrateSessionTokenMaterial(row) : undefined;
  }

  public async invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedSessionId = normalizeLookup(sessionId);
    const normalizedInvalidatedAt = normalizeLookup(invalidatedAt);
    if (!normalizedSessionId || !normalizedInvalidatedAt) {
      return undefined;
    }

    this.getDatabase()
      .prepare(`
        UPDATE identity_session_token_material
        SET invalidated_at = ?, updated_at = ?
        WHERE session_id = ?
      `)
      .run(normalizedInvalidatedAt, normalizedInvalidatedAt, normalizedSessionId);

    return this.getSessionTokenMaterialBySessionId(normalizedSessionId);
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private initialize(db: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(db);
    if (currentVersion > IDENTITY_SCHEMA_VERSION) {
      throw new Error(
        `Identity repository schema version ${currentVersion} is newer than supported schema version ${IDENTITY_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migrationSql] of IDENTITY_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO identity_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS identity_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = db.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private failure<TCode extends IdentityErrorCode>(
    code: TCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): IdentityOperationResult<IdentityMutationOutcome, TCode> {
    return identityFailure({
      code,
      message,
      boundary: IdentityErrorBoundaries.infrastructure,
      retryable: false,
      details,
    });
  }

  private hydrateUserIdentity(row: UserRow): UserIdentity {
    const links = this.getDatabase()
      .prepare(`
        SELECT
          user_identity_id,
          provider_id,
          provider_subject,
          is_primary,
          linked_at,
          unlinked_at,
          credential_status,
          credential_policy_id,
          credential_failed_attempts,
          credential_lockout_until,
          credential_password_changed_at,
          credential_reset_required_at,
          credential_compromised_at,
          credential_disabled_at,
          last_authenticated_at
        FROM identity_user_provider_links
        WHERE user_identity_id = ?
        ORDER BY linked_at ASC
      `)
      .all(row.user_identity_id) as ProviderLinkRow[];

    return Object.freeze({
      id: row.user_identity_id,
      username: row.username,
      email: row.email ?? undefined,
      displayName: row.display_name ?? undefined,
      status: assertUserIdentityStatus(row.status),
      linkedProviders: links.map((link) => hydrateProviderLink(link)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activatedAt: row.activated_at ?? undefined,
      suspendedAt: row.suspended_at ?? undefined,
      lockedAt: row.locked_at ?? undefined,
      deactivatedAt: row.deactivated_at ?? undefined,
    });
  }
}

function hydrateProviderLink(row: ProviderLinkRow): UserIdentityProviderLink {
  return Object.freeze({
    providerId: row.provider_id,
    providerSubject: row.provider_subject,
    isPrimary: row.is_primary === 1,
    linkedAt: row.linked_at,
    unlinkedAt: row.unlinked_at ?? undefined,
    credentialState: hydrateCredentialState(row),
    lastAuthenticatedAt: row.last_authenticated_at ?? undefined,
  });
}

function hydrateCredentialState(row: ProviderLinkRow): CredentialState | undefined {
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

function hydrateProvider(row: ProviderRow): AuthProvider {
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

function hydratePolicy(row: PolicyRow): CredentialPolicy {
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

function parseBlockedSubstrings(value: string): ReadonlyArray<string> {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    return Object.freeze([]);
  }

  return Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string"));
}

function hydrateCredentialMaterial(row: CredentialMaterialRow): IdentityCredentialMaterialRecord {
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

function hydrateSession(row: SessionRow): Session {
  const session = createSession({
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
    },
  });

  const revocation = row.revocation_reason && row.revoked_at
    ? Object.freeze({ reason: row.revocation_reason, revokedAt: row.revoked_at })
    : undefined;

  return Object.freeze({
    ...session,
    status: assertSessionStatus(row.status),
    rotatedAt: row.rotated_at ?? undefined,
    replacedBySessionId: row.replaced_by_session_id ?? undefined,
    revocation,
  });
}

function hydrateSessionTokenMaterial(row: SessionTokenMaterialRow): IdentitySessionTokenMaterialRecord {
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
  throw new Error(`Persisted session status '${value}' is invalid.`);
}

function assertSessionAccessChannel(value: string): IdentitySessionAccessChannel {
  if (Object.values(IdentitySessionAccessChannels).includes(value as IdentitySessionAccessChannel)) {
    return value as IdentitySessionAccessChannel;
  }
  throw new Error(`Persisted identity session access channel '${value}' is invalid.`);
}

function toBooleanInteger(value: boolean): number {
  return value ? 1 : 0;
}

function normalizeLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}
