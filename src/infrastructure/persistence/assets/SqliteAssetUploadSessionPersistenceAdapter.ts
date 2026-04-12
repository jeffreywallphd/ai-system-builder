import fs from "node:fs";
import path from "node:path";
import {
  AssetUploadSessionStatuses,
  type AssetUploadSessionRecord,
  type IAssetUploadSessionRepository,
} from "@application/assets/ports/IAssetUploadSessionRepository";
import type { AssetStorageArea } from "@domain/assets/AssetDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  ASSET_UPLOAD_SESSION_PERSISTENCE_MIGRATIONS,
  ASSET_UPLOAD_SESSION_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteAssetUploadSessionPersistenceMigrations";

interface AssetUploadSessionRow {
  readonly upload_session_id: string;
  readonly workspace_id: string;
  readonly asset_id: string;
  readonly actor_user_id: string;
  readonly storage_instance_id: string;
  readonly object_key: string;
  readonly storage_area: AssetStorageArea;
  readonly expected_file_name: string;
  readonly expected_mime_type: string;
  readonly expected_size_bytes: number;
  readonly status: "pending" | "completed" | "incomplete";
  readonly expires_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly finalized_version_id: string | null;
  readonly finalized_mime_type: string | null;
  readonly finalized_size_bytes: number | null;
  readonly finalized_checksum_algorithm: "sha256" | null;
  readonly finalized_checksum_digest: string | null;
  readonly finalized_original_file_name: string | null;
  readonly incomplete_reason_code: string | null;
  readonly incomplete_reason_message: string | null;
}

export class SqliteAssetUploadSessionPersistenceAdapter implements IAssetUploadSessionRepository {
  private database?: SqliteCompatDatabase;

  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async createUploadSession(session: AssetUploadSessionRecord): Promise<void> {
    const normalized = normalizeSession(session);
    this.getDatabase()
      .prepare(`
        INSERT INTO asset_upload_sessions (
          upload_session_id,
          workspace_id,
          asset_id,
          actor_user_id,
          storage_instance_id,
          object_key,
          storage_area,
          expected_file_name,
          expected_mime_type,
          expected_size_bytes,
          status,
          expires_at,
          created_at,
          updated_at,
          finalized_version_id,
          finalized_mime_type,
          finalized_size_bytes,
          finalized_checksum_algorithm,
          finalized_checksum_digest,
          finalized_original_file_name,
          incomplete_reason_code,
          incomplete_reason_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(...toRowValues(normalized));
  }

  public async findUploadSessionById(uploadSessionId: string): Promise<AssetUploadSessionRecord | undefined> {
    const normalized = normalizeRequired(uploadSessionId, "uploadSessionId");
    const row = this.getDatabase()
      .prepare("SELECT * FROM asset_upload_sessions WHERE upload_session_id = ? LIMIT 1")
      .get(normalized) as AssetUploadSessionRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  public async saveUploadSession(session: AssetUploadSessionRecord): Promise<void> {
    const normalized = normalizeSession(session);
    this.getDatabase()
      .prepare(`
        UPDATE asset_upload_sessions
        SET
          workspace_id = ?,
          asset_id = ?,
          actor_user_id = ?,
          storage_instance_id = ?,
          object_key = ?,
          storage_area = ?,
          expected_file_name = ?,
          expected_mime_type = ?,
          expected_size_bytes = ?,
          status = ?,
          expires_at = ?,
          created_at = ?,
          updated_at = ?,
          finalized_version_id = ?,
          finalized_mime_type = ?,
          finalized_size_bytes = ?,
          finalized_checksum_algorithm = ?,
          finalized_checksum_digest = ?,
          finalized_original_file_name = ?,
          incomplete_reason_code = ?,
          incomplete_reason_message = ?
        WHERE upload_session_id = ?
      `)
      .run(
        normalized.workspaceId,
        normalized.assetId,
        normalized.actorUserId,
        normalized.storageInstanceId,
        normalized.objectKey,
        normalized.area,
        normalized.expected.fileName,
        normalized.expected.mimeType,
        normalized.expected.sizeBytes,
        normalized.status,
        normalized.expiresAt,
        normalized.createdAt,
        normalized.updatedAt,
        normalized.finalizedVersionId ?? null,
        normalized.finalizedContent?.mimeType ?? null,
        normalized.finalizedContent?.sizeBytes ?? null,
        normalized.finalizedContent?.checksumAlgorithm ?? null,
        normalized.finalizedContent?.checksumDigest ?? null,
        normalized.finalizedContent?.originalFileName ?? null,
        normalized.incompleteReasonCode ?? null,
        normalized.incompleteReasonMessage ?? null,
        normalized.uploadSessionId,
      );
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
    if (currentVersion > ASSET_UPLOAD_SESSION_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Asset upload session schema version ${currentVersion} is newer than supported version ${ASSET_UPLOAD_SESSION_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of ASSET_UPLOAD_SESSION_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO asset_upload_session_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS asset_upload_session_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM asset_upload_session_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }
}

function toRowValues(session: AssetUploadSessionRecord): readonly unknown[] {
  return Object.freeze([
    session.uploadSessionId,
    session.workspaceId,
    session.assetId,
    session.actorUserId,
    session.storageInstanceId,
    session.objectKey,
    session.area,
    session.expected.fileName,
    session.expected.mimeType,
    session.expected.sizeBytes,
    session.status,
    session.expiresAt,
    session.createdAt,
    session.updatedAt,
    session.finalizedVersionId ?? null,
    session.finalizedContent?.mimeType ?? null,
    session.finalizedContent?.sizeBytes ?? null,
    session.finalizedContent?.checksumAlgorithm ?? null,
    session.finalizedContent?.checksumDigest ?? null,
    session.finalizedContent?.originalFileName ?? null,
    session.incompleteReasonCode ?? null,
    session.incompleteReasonMessage ?? null,
  ]);
}

function mapRow(row: AssetUploadSessionRow): AssetUploadSessionRecord {
  return Object.freeze({
    uploadSessionId: row.upload_session_id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    actorUserId: row.actor_user_id,
    storageInstanceId: row.storage_instance_id,
    objectKey: row.object_key,
    area: row.storage_area,
    expected: Object.freeze({
      fileName: row.expected_file_name,
      mimeType: row.expected_mime_type,
      sizeBytes: row.expected_size_bytes,
    }),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedVersionId: row.finalized_version_id ?? undefined,
    finalizedContent: row.finalized_checksum_digest
      ? Object.freeze({
        mimeType: row.finalized_mime_type ?? "application/octet-stream",
        sizeBytes: row.finalized_size_bytes ?? 0,
        checksumAlgorithm: row.finalized_checksum_algorithm ?? "sha256",
        checksumDigest: row.finalized_checksum_digest,
        originalFileName: row.finalized_original_file_name ?? undefined,
      })
      : undefined,
    incompleteReasonCode: row.incomplete_reason_code ?? undefined,
    incompleteReasonMessage: row.incomplete_reason_message ?? undefined,
  });
}

function normalizeSession(session: AssetUploadSessionRecord): AssetUploadSessionRecord {
  const normalizedStatus = session.status;
  if (!Object.values(AssetUploadSessionStatuses).includes(normalizedStatus)) {
    throw new Error(`Unsupported upload session status '${String(normalizedStatus)}'.`);
  }

  return Object.freeze({
    uploadSessionId: normalizeRequired(session.uploadSessionId, "uploadSessionId"),
    workspaceId: normalizeRequired(session.workspaceId, "workspaceId"),
    assetId: normalizeRequired(session.assetId, "assetId"),
    actorUserId: normalizeRequired(session.actorUserId, "actorUserId"),
    storageInstanceId: normalizeRequired(session.storageInstanceId, "storageInstanceId"),
    objectKey: normalizeRequired(session.objectKey, "objectKey"),
    area: session.area,
    expected: Object.freeze({
      fileName: normalizeRequired(session.expected.fileName, "expected.fileName"),
      mimeType: normalizeRequired(session.expected.mimeType, "expected.mimeType").toLowerCase(),
      sizeBytes: normalizeNonNegativeInteger(session.expected.sizeBytes, "expected.sizeBytes"),
    }),
    status: normalizedStatus,
    expiresAt: normalizeTimestamp(session.expiresAt, "expiresAt"),
    createdAt: normalizeTimestamp(session.createdAt, "createdAt"),
    updatedAt: normalizeTimestamp(session.updatedAt, "updatedAt"),
    finalizedVersionId: normalizeOptional(session.finalizedVersionId),
    finalizedContent: session.finalizedContent
      ? Object.freeze({
        mimeType: normalizeRequired(session.finalizedContent.mimeType, "finalizedContent.mimeType").toLowerCase(),
        sizeBytes: normalizeNonNegativeInteger(session.finalizedContent.sizeBytes, "finalizedContent.sizeBytes"),
        checksumAlgorithm: session.finalizedContent.checksumAlgorithm,
        checksumDigest: normalizeRequired(session.finalizedContent.checksumDigest, "finalizedContent.checksumDigest").toLowerCase(),
        originalFileName: normalizeOptional(session.finalizedContent.originalFileName),
      })
      : undefined,
    incompleteReasonCode: normalizeOptional(session.incompleteReasonCode),
    incompleteReasonMessage: normalizeOptional(session.incompleteReasonMessage),
  });
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be an integer >= 0.`);
  }
  return value;
}

