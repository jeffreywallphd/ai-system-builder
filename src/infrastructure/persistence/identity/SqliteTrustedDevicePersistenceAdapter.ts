import fs from "node:fs";
import path from "node:path";
import type {
  IdentityErrorCode,
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDeviceListQuery,
  TrustedDeviceLookupByFingerprintQuery,
  TrustedDevicePairingInvalidationRequest,
  TrustedDevicePairingSessionRecord,
  TrustedDevicePairingTokenRecord,
  TrustedDeviceRevocationRequest,
} from "@application/contracts/IdentityApplicationContracts";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
} from "@application/contracts/IdentityApplicationContracts";
import type { ITrustedDevicePairingRepository } from "@application/identity/ports/ITrustedDevicePairingRepository";
import type { ITrustedDeviceRepository } from "@application/identity/ports/ITrustedDeviceRepository";
import {
  DeviceTrustStatuses,
  revokeTrustedDevice,
  type TrustedDevice,
} from "@domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenStatuses,
} from "@domain/identity/TrustedDevicePairingDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  IDENTITY_PERSISTENCE_MIGRATIONS,
  IDENTITY_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteIdentityPersistenceMigrations";
import {
  hasTrustedDeviceStatuses,
  mapPairingSessionRowToRecord,
  mapPairingSessionToRowValues,
  mapPairingTokenRowToRecord,
  mapPairingTokenToRowValues,
  mapTrustedDeviceRowToDomain,
  mapTrustedDeviceToRowValues,
  normalizeLookup,
  type PairingSessionRow,
  type PairingTokenRow,
  type TrustedDeviceRow,
} from "./TrustedDevicePersistenceMapper";

export class SqliteTrustedDevicePersistenceAdapter implements ITrustedDeviceRepository, ITrustedDevicePairingRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.upsertTrustedDevice(device);
    return device;
  }

  public async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDevice | undefined> {
    const normalizedTrustedDeviceId = normalizeLookup(trustedDeviceId);
    if (!normalizedTrustedDeviceId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        trusted_device_id,
        user_identity_id,
        workspace_id,
        display_name,
        fingerprint_algorithm,
        fingerprint_value,
        fingerprint_captured_at,
        pairing_method,
        trust_status,
        trust_material_id,
        trust_material_kind,
        trust_material_version,
        trust_material_issued_at,
        trust_material_expires_at,
        registered_at,
        paired_at,
        last_seen_at,
        metadata_platform,
        metadata_os_version,
        metadata_app_version,
        metadata_device_model,
        metadata_locale,
        metadata_last_ip_address,
        revocation_reason,
        revoked_at,
        revoked_by_user_identity_id,
        revocation_note,
        updated_at
      FROM identity_trusted_devices
      WHERE trusted_device_id = ?
    `).get(normalizedTrustedDeviceId) as TrustedDeviceRow | undefined;

    return row ? mapTrustedDeviceRowToDomain(row) : undefined;
  }

  public async findTrustedDeviceByFingerprint(
    query: TrustedDeviceLookupByFingerprintQuery,
  ): Promise<TrustedDevice | undefined> {
    const userIdentityId = normalizeLookup(query.userIdentityId);
    const fingerprintValue = normalizeLookup(query.fingerprint.value);
    if (!userIdentityId || !fingerprintValue) {
      return undefined;
    }

    const normalizedWorkspaceId = normalizeLookup(query.workspaceId ?? "");
    const statement = this.getDatabase().prepare(`
      SELECT
        trusted_device_id,
        user_identity_id,
        workspace_id,
        display_name,
        fingerprint_algorithm,
        fingerprint_value,
        fingerprint_captured_at,
        pairing_method,
        trust_status,
        trust_material_id,
        trust_material_kind,
        trust_material_version,
        trust_material_issued_at,
        trust_material_expires_at,
        registered_at,
        paired_at,
        last_seen_at,
        metadata_platform,
        metadata_os_version,
        metadata_app_version,
        metadata_device_model,
        metadata_locale,
        metadata_last_ip_address,
        revocation_reason,
        revoked_at,
        revoked_by_user_identity_id,
        revocation_note,
        updated_at
      FROM identity_trusted_devices
      WHERE user_identity_id = ?
        AND ${normalizedWorkspaceId ? "workspace_id = ?" : "workspace_id IS NULL"}
        AND fingerprint_algorithm = ?
        AND fingerprint_value = ?
      LIMIT 1
    `);

    const row = normalizedWorkspaceId
      ? statement.get(
          userIdentityId,
          normalizedWorkspaceId,
          query.fingerprint.algorithm,
          fingerprintValue,
        ) as TrustedDeviceRow | undefined
      : statement.get(
          userIdentityId,
          query.fingerprint.algorithm,
          fingerprintValue,
        ) as TrustedDeviceRow | undefined;

    return row ? mapTrustedDeviceRowToDomain(row) : undefined;
  }

  public async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDevice>> {
    const userIdentityId = normalizeLookup(query.userIdentityId);
    if (!userIdentityId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["user_identity_id = ?"];
    const params: unknown[] = [userIdentityId];

    const workspaceId = normalizeLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(workspaceId);
    }

    if (hasTrustedDeviceStatuses(query)) {
      clauses.push(`trust_status IN (${query.includeStatuses!.map(() => "?").join(", ")})`);
      params.push(...query.includeStatuses!);
    }

    const hasLimit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0;
    const hasOffset = Number.isInteger(query.offset) && (query.offset ?? -1) >= 0;
    if (hasLimit && hasOffset) {
      params.push(query.limit, query.offset);
    } else if (hasLimit) {
      params.push(query.limit);
    }

    const rows = this.getDatabase().prepare(`
      SELECT
        trusted_device_id,
        user_identity_id,
        workspace_id,
        display_name,
        fingerprint_algorithm,
        fingerprint_value,
        fingerprint_captured_at,
        pairing_method,
        trust_status,
        trust_material_id,
        trust_material_kind,
        trust_material_version,
        trust_material_issued_at,
        trust_material_expires_at,
        registered_at,
        paired_at,
        last_seen_at,
        metadata_platform,
        metadata_os_version,
        metadata_app_version,
        metadata_device_model,
        metadata_locale,
        metadata_last_ip_address,
        revocation_reason,
        revoked_at,
        revoked_by_user_identity_id,
        revocation_note,
        updated_at
      FROM identity_trusted_devices
      WHERE ${clauses.join(" AND ")}
      ORDER BY updated_at DESC
      ${hasLimit && hasOffset ? "LIMIT ? OFFSET ?" : hasLimit ? "LIMIT ?" : ""}
    `).all(...params) as TrustedDeviceRow[];

    return Object.freeze(rows.map((row) => mapTrustedDeviceRowToDomain(row)));
  }

  public async updateTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.upsertTrustedDevice(device);
    return device;
  }

  public async revokeTrustedDevice(
    request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    const trustedDeviceId = normalizeLookup(request.trustedDeviceId);
    if (!trustedDeviceId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "Trusted device id is required.");
    }

    const trustedDevice = await this.getTrustedDeviceById(trustedDeviceId);
    if (!trustedDevice) {
      return this.failure(IdentityErrorCodes.notFound, "Trusted device was not found.");
    }

    if (trustedDevice.trustStatus === DeviceTrustStatuses.revoked) {
      return this.failure(IdentityErrorCodes.invalidState, "Trusted device is already revoked.");
    }

    const revoked = revokeTrustedDevice(trustedDevice, {
      reason: request.reason,
      revokedAt: request.revokedAt ?? new Date().toISOString(),
      revokedByUserIdentityId: request.revokedByUserIdentityId,
      note: request.note,
    });
    this.upsertTrustedDevice(revoked);
    return identitySuccess(Object.freeze({ changed: true }));
  }

  public async createPairingSession(
    session: TrustedDevicePairingSessionRecord,
  ): Promise<TrustedDevicePairingSessionRecord> {
    this.upsertPairingSession(session);
    return session;
  }

  public async createPairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord> {
    this.upsertPairingToken(token);
    return token;
  }

  public async getPairingSessionById(pairingSessionId: string): Promise<TrustedDevicePairingSessionRecord | undefined> {
    const normalizedPairingSessionId = normalizeLookup(pairingSessionId);
    if (!normalizedPairingSessionId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        pairing_session_id,
        trusted_device_id,
        user_identity_id,
        workspace_id,
        pairing_token_id,
        status,
        initiated_at,
        validated_at,
        completed_at,
        completed_by_user_identity_id,
        trust_material_registration_kind,
        trust_material_registration_pin_reference,
        trust_material_registration_public_key_fingerprint,
        rejected_at,
        rejection_reason,
        rejection_note,
        invalidated_at,
        expired_at,
        updated_at
      FROM identity_trusted_device_pairing_sessions
      WHERE pairing_session_id = ?
    `).get(normalizedPairingSessionId) as PairingSessionRow | undefined;

    return row ? mapPairingSessionRowToRecord(row) : undefined;
  }

  public async getPairingTokenById(pairingTokenId: string): Promise<TrustedDevicePairingTokenRecord | undefined> {
    const normalizedPairingTokenId = normalizeLookup(pairingTokenId);
    if (!normalizedPairingTokenId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        pairing_token_id,
        pairing_session_id,
        trusted_device_id,
        user_identity_id,
        workspace_id,
        artifact_type,
        token_hash,
        hash_algorithm,
        actor_scope,
        actor_user_identity_id,
        actor_session_id,
        issuance_issued_by_user_identity_id,
        issuance_ip_address,
        issuance_user_agent,
        issuance_channel_hint,
        status,
        issued_at,
        expires_at,
        failed_validation_attempts,
        max_validation_attempts,
        last_validation_attempt_at,
        consumed_at,
        consumed_by_user_identity_id,
        invalidation_reason,
        invalidated_at,
        invalidated_by_user_identity_id,
        invalidation_note,
        updated_at
      FROM identity_trusted_device_pairing_tokens
      WHERE pairing_token_id = ?
    `).get(normalizedPairingTokenId) as PairingTokenRow | undefined;

    return row ? mapPairingTokenRowToRecord(row) : undefined;
  }

  public async getPairingTokenBySessionId(
    pairingSessionId: string,
  ): Promise<TrustedDevicePairingTokenRecord | undefined> {
    const normalizedPairingSessionId = normalizeLookup(pairingSessionId);
    if (!normalizedPairingSessionId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        pairing_token_id,
        pairing_session_id,
        trusted_device_id,
        user_identity_id,
        workspace_id,
        artifact_type,
        token_hash,
        hash_algorithm,
        actor_scope,
        actor_user_identity_id,
        actor_session_id,
        issuance_issued_by_user_identity_id,
        issuance_ip_address,
        issuance_user_agent,
        issuance_channel_hint,
        status,
        issued_at,
        expires_at,
        failed_validation_attempts,
        max_validation_attempts,
        last_validation_attempt_at,
        consumed_at,
        consumed_by_user_identity_id,
        invalidation_reason,
        invalidated_at,
        invalidated_by_user_identity_id,
        invalidation_note,
        updated_at
      FROM identity_trusted_device_pairing_tokens
      WHERE pairing_session_id = ?
      LIMIT 1
    `).get(normalizedPairingSessionId) as PairingTokenRow | undefined;

    return row ? mapPairingTokenRowToRecord(row) : undefined;
  }

  public async updatePairingSession(
    session: TrustedDevicePairingSessionRecord,
  ): Promise<TrustedDevicePairingSessionRecord> {
    this.upsertPairingSession(session);
    return session;
  }

  public async updatePairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord> {
    this.upsertPairingToken(token);
    return token;
  }

  public async invalidatePairingArtifacts(
    request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    if (!request.pairingSessionId && !request.pairingTokenId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "Pairing session id or pairing token id is required.");
    }

    const invalidatedAt = request.invalidatedAt ?? new Date().toISOString();
    let changed = false;

    if (request.pairingTokenId) {
      const token = await this.getPairingTokenById(request.pairingTokenId);
      if (!token) {
        return this.failure(IdentityErrorCodes.notFound, "Pairing token was not found.");
      }

      if (token.status === PairingTokenStatuses.issued) {
        const result = this.getDatabase().prepare(`
          UPDATE identity_trusted_device_pairing_tokens
          SET status = ?,
              invalidation_reason = ?,
              invalidated_at = ?,
              invalidated_by_user_identity_id = ?,
              invalidation_note = ?,
              updated_at = ?
          WHERE pairing_token_id = ?
        `).run(
          PairingTokenStatuses.invalidated,
          request.reason,
          invalidatedAt,
          request.invalidatedByUserIdentityId ?? null,
          request.note ?? null,
          invalidatedAt,
          token.id,
        );
        changed = changed || result.changes > 0;
      }
    }

    if (request.pairingSessionId) {
      const session = await this.getPairingSessionById(request.pairingSessionId);
      if (!session) {
        return this.failure(IdentityErrorCodes.notFound, "Pairing session was not found.");
      }

      if (session.status === PairingSessionStatuses.completed) {
        return this.failure(IdentityErrorCodes.invalidState, "Completed pairing sessions cannot be invalidated.");
      }

      const result = this.getDatabase().prepare(`
        UPDATE identity_trusted_device_pairing_sessions
        SET status = ?,
            invalidated_at = ?,
            expired_at = NULL,
            updated_at = ?
        WHERE pairing_session_id = ?
      `).run(
        PairingSessionStatuses.invalidated,
        invalidatedAt,
        invalidatedAt,
        session.id,
      );
      changed = changed || result.changes > 0;
    }

    return identitySuccess(Object.freeze({ changed }));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private upsertTrustedDevice(device: TrustedDevice): void {
    this.getDatabase().prepare(`
      INSERT INTO identity_trusted_devices (
        trusted_device_id,
        user_identity_id,
        workspace_id,
        display_name,
        fingerprint_algorithm,
        fingerprint_value,
        fingerprint_captured_at,
        pairing_method,
        trust_status,
        trust_material_id,
        trust_material_kind,
        trust_material_version,
        trust_material_issued_at,
        trust_material_expires_at,
        registered_at,
        paired_at,
        last_seen_at,
        metadata_platform,
        metadata_os_version,
        metadata_app_version,
        metadata_device_model,
        metadata_locale,
        metadata_last_ip_address,
        revocation_reason,
        revoked_at,
        revoked_by_user_identity_id,
        revocation_note,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trusted_device_id) DO UPDATE SET
        user_identity_id = excluded.user_identity_id,
        workspace_id = excluded.workspace_id,
        display_name = excluded.display_name,
        fingerprint_algorithm = excluded.fingerprint_algorithm,
        fingerprint_value = excluded.fingerprint_value,
        fingerprint_captured_at = excluded.fingerprint_captured_at,
        pairing_method = excluded.pairing_method,
        trust_status = excluded.trust_status,
        trust_material_id = excluded.trust_material_id,
        trust_material_kind = excluded.trust_material_kind,
        trust_material_version = excluded.trust_material_version,
        trust_material_issued_at = excluded.trust_material_issued_at,
        trust_material_expires_at = excluded.trust_material_expires_at,
        registered_at = excluded.registered_at,
        paired_at = excluded.paired_at,
        last_seen_at = excluded.last_seen_at,
        metadata_platform = excluded.metadata_platform,
        metadata_os_version = excluded.metadata_os_version,
        metadata_app_version = excluded.metadata_app_version,
        metadata_device_model = excluded.metadata_device_model,
        metadata_locale = excluded.metadata_locale,
        metadata_last_ip_address = excluded.metadata_last_ip_address,
        revocation_reason = excluded.revocation_reason,
        revoked_at = excluded.revoked_at,
        revoked_by_user_identity_id = excluded.revoked_by_user_identity_id,
        revocation_note = excluded.revocation_note,
        updated_at = excluded.updated_at
    `).run(...mapTrustedDeviceToRowValues(device));
  }

  private upsertPairingSession(session: TrustedDevicePairingSessionRecord): void {
    this.getDatabase().prepare(`
      INSERT INTO identity_trusted_device_pairing_sessions (
        pairing_session_id,
        trusted_device_id,
        user_identity_id,
        workspace_id,
        pairing_token_id,
        status,
        initiated_at,
        validated_at,
        completed_at,
        completed_by_user_identity_id,
        trust_material_registration_kind,
        trust_material_registration_pin_reference,
        trust_material_registration_public_key_fingerprint,
        rejected_at,
        rejection_reason,
        rejection_note,
        invalidated_at,
        expired_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pairing_session_id) DO UPDATE SET
        trusted_device_id = excluded.trusted_device_id,
        user_identity_id = excluded.user_identity_id,
        workspace_id = excluded.workspace_id,
        pairing_token_id = excluded.pairing_token_id,
        status = excluded.status,
        initiated_at = excluded.initiated_at,
        validated_at = excluded.validated_at,
        completed_at = excluded.completed_at,
        completed_by_user_identity_id = excluded.completed_by_user_identity_id,
        trust_material_registration_kind = excluded.trust_material_registration_kind,
        trust_material_registration_pin_reference = excluded.trust_material_registration_pin_reference,
        trust_material_registration_public_key_fingerprint = excluded.trust_material_registration_public_key_fingerprint,
        rejected_at = excluded.rejected_at,
        rejection_reason = excluded.rejection_reason,
        rejection_note = excluded.rejection_note,
        invalidated_at = excluded.invalidated_at,
        expired_at = excluded.expired_at,
        updated_at = excluded.updated_at
    `).run(...mapPairingSessionToRowValues(session));
  }

  private upsertPairingToken(token: TrustedDevicePairingTokenRecord): void {
    this.getDatabase().prepare(`
      INSERT INTO identity_trusted_device_pairing_tokens (
        pairing_token_id,
        pairing_session_id,
        trusted_device_id,
        user_identity_id,
        workspace_id,
        artifact_type,
        token_hash,
        hash_algorithm,
        actor_scope,
        actor_user_identity_id,
        actor_session_id,
        issuance_issued_by_user_identity_id,
        issuance_ip_address,
        issuance_user_agent,
        issuance_channel_hint,
        status,
        issued_at,
        expires_at,
        failed_validation_attempts,
        max_validation_attempts,
        last_validation_attempt_at,
        consumed_at,
        consumed_by_user_identity_id,
        invalidation_reason,
        invalidated_at,
        invalidated_by_user_identity_id,
        invalidation_note,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pairing_token_id) DO UPDATE SET
        pairing_session_id = excluded.pairing_session_id,
        trusted_device_id = excluded.trusted_device_id,
        user_identity_id = excluded.user_identity_id,
        workspace_id = excluded.workspace_id,
        artifact_type = excluded.artifact_type,
        token_hash = excluded.token_hash,
        hash_algorithm = excluded.hash_algorithm,
        actor_scope = excluded.actor_scope,
        actor_user_identity_id = excluded.actor_user_identity_id,
        actor_session_id = excluded.actor_session_id,
        issuance_issued_by_user_identity_id = excluded.issuance_issued_by_user_identity_id,
        issuance_ip_address = excluded.issuance_ip_address,
        issuance_user_agent = excluded.issuance_user_agent,
        issuance_channel_hint = excluded.issuance_channel_hint,
        status = excluded.status,
        issued_at = excluded.issued_at,
        expires_at = excluded.expires_at,
        failed_validation_attempts = excluded.failed_validation_attempts,
        max_validation_attempts = excluded.max_validation_attempts,
        last_validation_attempt_at = excluded.last_validation_attempt_at,
        consumed_at = excluded.consumed_at,
        consumed_by_user_identity_id = excluded.consumed_by_user_identity_id,
        invalidation_reason = excluded.invalidation_reason,
        invalidated_at = excluded.invalidated_at,
        invalidated_by_user_identity_id = excluded.invalidated_by_user_identity_id,
        invalidation_note = excluded.invalidation_note,
        updated_at = excluded.updated_at
    `).run(...mapPairingTokenToRowValues(token));
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
}

