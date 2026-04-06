import fs from "node:fs";
import path from "node:path";
import type {
  IdentityErrorCode,
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
  IdentitySessionTokenMaterialRecord,
  IdentitySessionListQuery,
  IdentityUserIdentityListQuery,
} from "../../../../application/contracts/IdentityApplicationContracts";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../../../../application/identity/ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../../../../application/identity/ports/IIdentitySessionTokenMaterialRepository";
import type { IPlatformTransactionManager } from "../../../application/common/ports/PlatformTransactionPorts";
import type {
  AuthProvider,
  CredentialPolicy,
  Session,
  UserIdentity,
} from "../../../domain/identity/IdentityDomain";
import {
  mapAuthProviderRowToDomain,
  mapAuthProviderToRowValues,
  mapCredentialMaterialRowToRecord,
  mapCredentialMaterialToRowValues,
  mapCredentialPolicyRowToDomain,
  mapCredentialPolicyToRowValues,
  mapProviderLinkToRowValues,
  mapSessionRowToDomain,
  mapSessionToRowValues,
  mapSessionTokenMaterialRowToRecord,
  mapSessionTokenMaterialToRowValues,
  mapUserIdentityRowToDomain,
  mapUserIdentityToRowValues,
  normalizeLookup,
  type AuthProviderRow,
  type CredentialMaterialRow,
  type CredentialPolicyRow,
  type SessionRow,
  type SessionTokenMaterialRow,
  type UserIdentityRow,
  type UserProviderLinkRow,
} from "./IdentityPersistenceMapper";
import {
  IDENTITY_PERSISTENCE_MIGRATIONS,
  IDENTITY_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteIdentityPersistenceMigrations";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SqliteTransactionCoordinator } from "../sqlite/SqliteTransactionCoordinator";

export class SqliteIdentityPersistenceAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    IIdentitySessionTokenMaterialRepository,
    IPlatformTransactionManager {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly transactionCoordinator: SqliteTransactionCoordinator;

  public constructor(private readonly databasePath: string) {
    this.transactionCoordinator = new SqliteTransactionCoordinator(() => this.getDatabase());
  }

  public async saveUserIdentity(identity: UserIdentity): Promise<UserIdentity> {
    const database = this.getDatabase();
    database.transaction(() => {
      database.prepare(`
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
      `).run(...mapUserIdentityToRowValues(identity));

      database.prepare("DELETE FROM identity_user_provider_links WHERE user_identity_id = ?")
        .run(identity.id);

      const insertLink = database.prepare(`
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

      for (const providerLink of identity.linkedProviders) {
        insertLink.run(...mapProviderLinkToRowValues(identity.id, providerLink));
      }
    })();

    return identity;
  }

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.getDatabase().prepare(`
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
    `).run(...mapAuthProviderToRowValues(provider));

    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.getDatabase().prepare(`
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
    `).run(...mapCredentialPolicyToRowValues(policy));

    return policy;
  }

  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    const normalizedUserIdentityId = normalizeLookup(userIdentityId);
    if (!normalizedUserIdentityId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(normalizedUserIdentityId) as UserIdentityRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async listUserIdentities(query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let joins = "";

    const normalizedProviderId = normalizeLookup(query.providerId ?? "");
    if (normalizedProviderId) {
      joins += `
        INNER JOIN identity_user_provider_links l
          ON l.user_identity_id = u.user_identity_id
      `;
      clauses.push("l.provider_id = ?");
      params.push(normalizedProviderId);
    }

    if (query.includeStatuses && query.includeStatuses.length > 0) {
      clauses.push(`u.status IN (${query.includeStatuses.map(() => "?").join(", ")})`);
      params.push(...query.includeStatuses);
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const hasOffset = Number.isInteger(query.offset) && (query.offset ?? -1) >= 0;
    if (hasLimit && hasOffset) {
      params.push(query.limit, query.offset);
    } else if (hasLimit) {
      params.push(query.limit);
    }

    const rows = this.getDatabase().prepare(`
      SELECT DISTINCT
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
      ${joins}
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY u.created_at DESC
      ${hasLimit && hasOffset ? "LIMIT ? OFFSET ?" : hasLimit ? "LIMIT ?" : ""}
    `).all(...params) as UserIdentityRow[];

    return Object.freeze(rows.map((row) => this.hydrateUserIdentity(row)));
  }

  public async countUserIdentities(): Promise<number> {
    const row = this.getDatabase().prepare(
      "SELECT COUNT(*) AS total FROM identity_user_identities",
    ).get() as { total?: number } | undefined;

    return typeof row?.total === "number" ? row.total : 0;
  }

  public async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    const normalizedValue = normalizeLookup(lookup.value)?.toLowerCase();
    if (!normalizedValue) {
      return undefined;
    }

    const lookupColumn = lookup.kind === "username" ? "username" : "email";
    const row = this.getDatabase().prepare(`
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
      WHERE ${lookupColumn} = ?
    `).get(normalizedValue) as UserIdentityRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async findUserIdentityByProviderSubject(
    reference: IdentityProviderSubjectReference,
  ): Promise<UserIdentity | undefined> {
    const providerId = normalizeLookup(reference.providerId);
    const providerSubject = normalizeLookup(reference.providerSubject);
    if (!providerId || !providerSubject) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
      INNER JOIN identity_user_provider_links l
        ON l.user_identity_id = u.user_identity_id
      WHERE l.provider_id = ?
        AND l.provider_subject = ?
      LIMIT 1
    `).get(providerId, providerSubject) as UserIdentityRow | undefined;

    return row ? this.hydrateUserIdentity(row) : undefined;
  }

  public async findAuthProviderById(providerId: string): Promise<AuthProvider | undefined> {
    const normalizedProviderId = normalizeLookup(providerId);
    if (!normalizedProviderId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(normalizedProviderId) as AuthProviderRow | undefined;

    return row ? mapAuthProviderRowToDomain(row) : undefined;
  }

  public async findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined> {
    const normalizedPolicyId = normalizeLookup(policyId);
    if (!normalizedPolicyId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(normalizedPolicyId) as CredentialPolicyRow | undefined;

    return row ? mapCredentialPolicyRowToDomain(row) : undefined;
  }

  public async getActiveCredentialMaterial(
    reference: IdentityProviderSubjectReference,
  ): Promise<IdentityCredentialMaterialRecord | undefined> {
    const providerId = normalizeLookup(reference.providerId);
    const providerSubject = normalizeLookup(reference.providerSubject);
    if (!providerId || !providerSubject) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(providerId, providerSubject) as CredentialMaterialRow | undefined;

    return row ? mapCredentialMaterialRowToRecord(row) : undefined;
  }

  public async listCredentialMaterialHistory(
    query: IdentityCredentialHistoryQuery,
  ): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>> {
    const providerId = normalizeLookup(query.reference.providerId);
    const providerSubject = normalizeLookup(query.reference.providerSubject);
    if (!providerId || !providerSubject) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["provider_id = ?", "provider_subject = ?"];
    const params: unknown[] = [providerId, providerSubject];
    if (!(query.includeInactive ?? false)) {
      clauses.push("status = 'active'");
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const rows = this.getDatabase().prepare(`
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
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at ASC
      ${hasLimit ? "LIMIT ?" : ""}
    `).all(...(hasLimit ? [...params, query.limit] : params)) as CredentialMaterialRow[];

    return Object.freeze(rows.map((row) => mapCredentialMaterialRowToRecord(row)));
  }

  public async saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord> {
    this.getDatabase().prepare(`
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
    `).run(...mapCredentialMaterialToRowValues(record));

    return record;
  }

  public async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidRequest>> {
    const normalizedRecordId = normalizeLookup(recordId);
    const normalizedSupersededAt = normalizeLookup(supersededAt);
    if (!normalizedRecordId || !normalizedSupersededAt) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        "Credential material supersede request requires non-empty record id and supersededAt timestamp.",
      );
    }

    const result = this.getDatabase().prepare(`
      UPDATE identity_credential_material_records
      SET status = 'superseded',
          superseded_at = ?,
          updated_at = ?
      WHERE credential_material_id = ?
    `).run(normalizedSupersededAt, normalizedSupersededAt, normalizedRecordId);

    return identitySuccess(Object.freeze({
      changed: result.changes > 0,
    }));
  }

  public async saveSession(session: Session): Promise<Session> {
    this.getDatabase().prepare(`
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
        client_device_id,
        client_trusted_device_id,
        client_issued_on_trusted_device,
        client_session_assurance_level,
        client_device_trust_state,
        client_device_trust_evaluated_at,
        client_device_trust_invalidation_reasons_json,
        client_trusted_device_binding_id,
        client_trust_marker
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        client_device_id = excluded.client_device_id,
        client_trusted_device_id = excluded.client_trusted_device_id,
        client_issued_on_trusted_device = excluded.client_issued_on_trusted_device,
        client_session_assurance_level = excluded.client_session_assurance_level,
        client_device_trust_state = excluded.client_device_trust_state,
        client_device_trust_evaluated_at = excluded.client_device_trust_evaluated_at,
        client_device_trust_invalidation_reasons_json = excluded.client_device_trust_invalidation_reasons_json,
        client_trusted_device_binding_id = excluded.client_trusted_device_binding_id,
        client_trust_marker = excluded.client_trust_marker
    `).run(...mapSessionToRowValues(session));

    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    const normalizedSessionId = normalizeLookup(sessionId);
    if (!normalizedSessionId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
        client_device_id,
        client_trusted_device_id,
        client_issued_on_trusted_device,
        client_session_assurance_level,
        client_device_trust_state,
        client_device_trust_evaluated_at,
        client_device_trust_invalidation_reasons_json,
        client_trusted_device_binding_id,
        client_trust_marker
      FROM identity_sessions
      WHERE session_id = ?
    `).get(normalizedSessionId) as SessionRow | undefined;

    return row ? mapSessionRowToDomain(row) : undefined;
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    const normalizedUserIdentityId = normalizeLookup(query.userIdentityId);
    if (!normalizedUserIdentityId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["user_identity_id = ?"];
    const params: unknown[] = [normalizedUserIdentityId];

    if (query.includeStatuses && query.includeStatuses.length > 0) {
      clauses.push(`status IN (${query.includeStatuses.map(() => "?").join(", ")})`);
      params.push(...query.includeStatuses);
    }

    if (query.expiresBefore) {
      clauses.push("expires_at < ?");
      params.push(query.expiresBefore);
    }

    if (query.expiresAfter) {
      clauses.push("expires_at > ?");
      params.push(query.expiresAfter);
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const rows = this.getDatabase().prepare(`
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
        client_device_id,
        client_trusted_device_id,
        client_issued_on_trusted_device,
        client_session_assurance_level,
        client_device_trust_state,
        client_device_trust_evaluated_at,
        client_device_trust_invalidation_reasons_json,
        client_trusted_device_binding_id,
        client_trust_marker
      FROM identity_sessions
      WHERE ${clauses.join(" AND ")}
      ORDER BY issued_at DESC
      ${hasLimit ? "LIMIT ?" : ""}
    `).all(...(hasLimit ? [...params, query.limit] : params)) as SessionRow[];

    return Object.freeze(rows.map((row) => mapSessionRowToDomain(row)));
  }

  public async removeSession(
    sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    const normalizedSessionId = normalizeLookup(sessionId);
    if (!normalizedSessionId) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        "Session removal requires a non-empty session id.",
      );
    }

    const result = this.getDatabase().prepare(
      "DELETE FROM identity_sessions WHERE session_id = ?",
    ).run(normalizedSessionId);

    return identitySuccess(Object.freeze({
      changed: result.changes > 0,
    }));
  }

  public async saveSessionTokenMaterial(
    record: IdentitySessionTokenMaterialRecord,
  ): Promise<IdentitySessionTokenMaterialRecord> {
    this.getDatabase().prepare(`
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
    `).run(...mapSessionTokenMaterialToRowValues(record));

    return record;
  }

  public async getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedSessionId = normalizeLookup(sessionId);
    if (!normalizedSessionId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(normalizedSessionId) as SessionTokenMaterialRow | undefined;

    return row ? mapSessionTokenMaterialRowToRecord(row) : undefined;
  }

  public async getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedTokenHash = normalizeLookup(tokenHash);
    if (!normalizedTokenHash) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
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
    `).get(normalizedTokenHash) as SessionTokenMaterialRow | undefined;

    return row ? mapSessionTokenMaterialRowToRecord(row) : undefined;
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

    this.getDatabase().prepare(`
      UPDATE identity_session_token_material
      SET invalidated_at = ?,
          updated_at = ?
      WHERE session_id = ?
    `).run(normalizedInvalidatedAt, normalizedInvalidatedAt, normalizedSessionId);

    return this.getSessionTokenMaterialBySessionId(normalizedSessionId);
  }

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    return this.transactionCoordinator.runInTransaction(operation);
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

  private initialize(database: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(database);
    if (currentVersion > IDENTITY_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Identity schema version ${currentVersion} is newer than supported version ${IDENTITY_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of IDENTITY_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO identity_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS identity_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
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

  private hydrateUserIdentity(row: UserIdentityRow): UserIdentity {
    const links = this.getDatabase().prepare(`
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
    `).all(row.user_identity_id) as UserProviderLinkRow[];

    return mapUserIdentityRowToDomain(row, links);
  }
}
