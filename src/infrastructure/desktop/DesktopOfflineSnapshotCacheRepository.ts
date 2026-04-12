import fs from "node:fs";
import path from "node:path";
import {
  type SqliteCompatDatabase,
  openSqliteCompatDatabase,
} from "../persistence/sqlite/SqliteCompat";
import {
  type IOfflineAuthoritativeSnapshotCacheRepository,
  type OfflineAuthoritativeSnapshotCacheKey,
  type OfflineAuthoritativeSnapshotEligibilityMarkers,
  type OfflineAuthoritativeSnapshotRecord,
  type OfflineAuthoritativeSnapshotCacheRepositoryCapabilities,
  OfflineAuthoritativeSnapshotCacheError,
  OfflineSnapshotCacheProtectionPostures,
  computeOfflineSnapshotDigest,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import {
  createElectronSafeStorageDesktopOfflineValueProtectionPort,
  type DesktopOfflineValueProtectionPort,
  DesktopOfflineValueProtectionPostures,
} from "./DesktopOfflineValueProtection";

interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
}

const MIGRATIONS: ReadonlyArray<MigrationDefinition> = Object.freeze([
  {
    version: 1,
    name: "create-offline-authoritative-snapshot-cache",
    statements: Object.freeze([
      `
      CREATE TABLE IF NOT EXISTS offline_snapshot_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS offline_authoritative_snapshot_cache (
        workspace_id TEXT NOT NULL,
        resource_class TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        authoritative_revision TEXT NOT NULL,
        authoritative_snapshot_revision TEXT NOT NULL,
        authority_scope TEXT NOT NULL,
        storage_bucket TEXT NOT NULL,
        behavior_class TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        last_synchronized_at TEXT NOT NULL,
        expires_at TEXT,
        cached_by_actor_user_identity_id TEXT NOT NULL,
        cache_protection_posture TEXT NOT NULL,
        snapshot_digest TEXT NOT NULL,
        eligibility_markers_json TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        PRIMARY KEY (workspace_id, resource_class, resource_id)
      )
      `,
      `
      CREATE INDEX IF NOT EXISTS idx_offline_authoritative_snapshot_cache_workspace
      ON offline_authoritative_snapshot_cache(workspace_id, cached_at DESC)
      `,
    ]),
  },
  {
    version: 2,
    name: "add-offline-snapshot-value-protection-posture",
    statements: Object.freeze([
      `
      ALTER TABLE offline_authoritative_snapshot_cache
      ADD COLUMN value_protection_posture TEXT NOT NULL DEFAULT 'unprotected-at-rest'
      `,
    ]),
  },
]);

export interface DesktopOfflineSnapshotCacheRepositoryOptions {
  readonly databasePath: string;
  readonly maxEntries?: number;
  readonly supportsProtectedAtRestStorage?: boolean;
  readonly valueProtection?: DesktopOfflineValueProtectionPort;
}

interface SnapshotRow {
  readonly workspace_id: string;
  readonly resource_class: string;
  readonly resource_id: string;
  readonly authoritative_revision: string;
  readonly authoritative_snapshot_revision: string;
  readonly authority_scope: string;
  readonly storage_bucket: string;
  readonly behavior_class: string;
  readonly cached_at: string;
  readonly last_synchronized_at: string;
  readonly expires_at: string | null;
  readonly cached_by_actor_user_identity_id: string;
  readonly cache_protection_posture: string;
  readonly value_protection_posture: string;
  readonly snapshot_digest: string;
  readonly eligibility_markers_json: string;
  readonly snapshot_json: string;
}

const DEFAULT_MAX_ENTRIES = 1000;

export class DesktopOfflineSnapshotCacheRepository implements IOfflineAuthoritativeSnapshotCacheRepository {
  private readonly databasePath: string;
  private readonly capabilities: OfflineAuthoritativeSnapshotCacheRepositoryCapabilities;
  private readonly valueProtection: DesktopOfflineValueProtectionPort;
  private database?: SqliteCompatDatabase;

  constructor(options: DesktopOfflineSnapshotCacheRepositoryOptions) {
    this.databasePath = options.databasePath;
    this.valueProtection = options.valueProtection
      ?? createElectronSafeStorageDesktopOfflineValueProtectionPort();
    this.capabilities = Object.freeze({
      supportsProtectedAtRestStorage: options.supportsProtectedAtRestStorage === true
        || this.valueProtection.posture === DesktopOfflineValueProtectionPostures.protectedAtRest,
      maxEntries: Number.isInteger(options.maxEntries) && (options.maxEntries ?? 0) > 0
        ? options.maxEntries!
        : DEFAULT_MAX_ENTRIES,
    });
    this.initialize();
  }

  public getCapabilities(): OfflineAuthoritativeSnapshotCacheRepositoryCapabilities {
    return this.capabilities;
  }

  public async upsertSnapshot(record: OfflineAuthoritativeSnapshotRecord): Promise<void> {
    const row = this.toRow(record);
    this.getDatabase()
      .prepare(`
        INSERT INTO offline_authoritative_snapshot_cache (
          workspace_id,
          resource_class,
          resource_id,
          authoritative_revision,
          authoritative_snapshot_revision,
          authority_scope,
          storage_bucket,
          behavior_class,
          cached_at,
          last_synchronized_at,
          expires_at,
          cached_by_actor_user_identity_id,
          cache_protection_posture,
          value_protection_posture,
          snapshot_digest,
          eligibility_markers_json,
          snapshot_json
        ) VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
        ON CONFLICT(workspace_id, resource_class, resource_id) DO UPDATE SET
          authoritative_revision = excluded.authoritative_revision,
          authoritative_snapshot_revision = excluded.authoritative_snapshot_revision,
          authority_scope = excluded.authority_scope,
          storage_bucket = excluded.storage_bucket,
          behavior_class = excluded.behavior_class,
          cached_at = excluded.cached_at,
          last_synchronized_at = excluded.last_synchronized_at,
          expires_at = excluded.expires_at,
          cached_by_actor_user_identity_id = excluded.cached_by_actor_user_identity_id,
          cache_protection_posture = excluded.cache_protection_posture,
          value_protection_posture = excluded.value_protection_posture,
          snapshot_digest = excluded.snapshot_digest,
          eligibility_markers_json = excluded.eligibility_markers_json,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        row.workspace_id,
        row.resource_class,
        row.resource_id,
        row.authoritative_revision,
        row.authoritative_snapshot_revision,
        row.authority_scope,
        row.storage_bucket,
        row.behavior_class,
        row.cached_at,
        row.last_synchronized_at,
        row.expires_at,
        row.cached_by_actor_user_identity_id,
        row.cache_protection_posture,
        row.value_protection_posture,
        row.snapshot_digest,
        row.eligibility_markers_json,
        row.snapshot_json,
      );

    this.enforceRetentionBound();
  }

  public async findSnapshot(
    key: OfflineAuthoritativeSnapshotCacheKey,
  ): Promise<OfflineAuthoritativeSnapshotRecord | undefined> {
    const row = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          resource_class,
          resource_id,
          authoritative_revision,
          authoritative_snapshot_revision,
          authority_scope,
          storage_bucket,
          behavior_class,
          cached_at,
          last_synchronized_at,
          expires_at,
          cached_by_actor_user_identity_id,
          cache_protection_posture,
          value_protection_posture,
          snapshot_digest,
          eligibility_markers_json,
          snapshot_json
        FROM offline_authoritative_snapshot_cache
        WHERE workspace_id = ? AND resource_class = ? AND resource_id = ?
      `)
      .get(key.workspaceId, key.resourceClass, key.resourceId) as SnapshotRow | undefined;

    return row ? this.toRecord(row) : undefined;
  }

  public async listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>> {
    const rows = this.getDatabase()
      .prepare(`
        SELECT
          workspace_id,
          resource_class,
          resource_id,
          authoritative_revision,
          authoritative_snapshot_revision,
          authority_scope,
          storage_bucket,
          behavior_class,
          cached_at,
          last_synchronized_at,
          expires_at,
          cached_by_actor_user_identity_id,
          cache_protection_posture,
          value_protection_posture,
          snapshot_digest,
          eligibility_markers_json,
          snapshot_json
        FROM offline_authoritative_snapshot_cache
        WHERE workspace_id = ?
        ORDER BY cached_at DESC
      `)
      .all(workspaceId) as ReadonlyArray<SnapshotRow>;

    return Object.freeze(rows.map((row) => this.toRecord(row)));
  }

  public async deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean> {
    const result = this.getDatabase()
      .prepare(`
        DELETE FROM offline_authoritative_snapshot_cache
        WHERE workspace_id = ? AND resource_class = ? AND resource_id = ?
      `)
      .run(key.workspaceId, key.resourceClass, key.resourceId);
    return result.changes > 0;
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private initialize(): void {
    const db = this.getDatabase();
    this.ensureMigrationTable(db);
    const migrationRows: ReadonlyArray<{ version: number }> =
      db.prepare("SELECT version FROM offline_snapshot_schema_migrations ORDER BY version ASC").all();
    const appliedVersions = new Set(migrationRows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      const transaction = db.transaction(() => {
        for (const statement of migration.statements) {
          db.exec(statement);
        }
        db.prepare(`
          INSERT INTO offline_snapshot_schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.name, new Date().toISOString());
      });
      transaction();
    }
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }
    return this.database;
  }

  private ensureMigrationTable(db: SqliteCompatDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_snapshot_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }

  private enforceRetentionBound(): void {
    this.getDatabase()
      .prepare(`
        DELETE FROM offline_authoritative_snapshot_cache
        WHERE rowid IN (
          SELECT rowid
          FROM offline_authoritative_snapshot_cache
          ORDER BY cached_at DESC
          LIMIT -1 OFFSET ?
        )
      `)
      .run(this.capabilities.maxEntries);
  }

  private toRecord(row: SnapshotRow): OfflineAuthoritativeSnapshotRecord {
    if (row.authority_scope !== "authoritative-server") {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Invalid authority_scope '${row.authority_scope}' in offline snapshot cache record.`,
      );
    }
    if (
      row.cache_protection_posture !== OfflineSnapshotCacheProtectionPostures.protectedAtRest
      && row.cache_protection_posture !== OfflineSnapshotCacheProtectionPostures.unprotectedAtRest
    ) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Invalid cache_protection_posture '${row.cache_protection_posture}' in offline snapshot cache record.`,
      );
    }

    if (
      row.value_protection_posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
      && row.value_protection_posture !== DesktopOfflineValueProtectionPostures.unprotectedAtRest
    ) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Invalid value_protection_posture '${row.value_protection_posture}' in offline snapshot cache record.`,
      );
    }
    if (
      row.value_protection_posture === DesktopOfflineValueProtectionPostures.protectedAtRest
      && this.valueProtection.posture !== DesktopOfflineValueProtectionPostures.protectedAtRest
    ) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        "Offline snapshot cache row requires protected-at-rest decoding, but protected storage is unavailable.",
      );
    }

    const eligibilityMarkersJson = this.valueProtection.unprotect(
      row.eligibility_markers_json,
      {
        store: "offline-snapshot-cache",
        field: "eligibility_markers_json",
      },
    );
    const snapshotJson = this.valueProtection.unprotect(
      row.snapshot_json,
      {
        store: "offline-snapshot-cache",
        field: "snapshot_json",
      },
    );
    const snapshot = JSON.parse(snapshotJson) as Readonly<Record<string, unknown>>;
    const computedDigest = computeOfflineSnapshotDigest(snapshot);
    if (computedDigest !== row.snapshot_digest) {
      throw new OfflineAuthoritativeSnapshotCacheError(
        `Cached offline snapshot digest mismatch for '${row.workspace_id}/${row.resource_class}/${row.resource_id}'.`,
      );
    }

    return Object.freeze({
      workspaceId: row.workspace_id,
      resourceClass: row.resource_class as OfflineAuthoritativeSnapshotRecord["resourceClass"],
      resourceId: row.resource_id,
      authoritativeRevision: row.authoritative_revision,
      authoritativeSnapshotRevision: row.authoritative_snapshot_revision,
      authorityScope: "authoritative-server",
      storageBucket: row.storage_bucket,
      behaviorClass: row.behavior_class,
      cachedAt: row.cached_at,
      lastSynchronizedAt: row.last_synchronized_at,
      expiresAt: row.expires_at ?? undefined,
      cachedByActorUserIdentityId: row.cached_by_actor_user_identity_id,
      cacheProtectionPosture: row.cache_protection_posture as OfflineAuthoritativeSnapshotRecord["cacheProtectionPosture"],
      snapshotDigest: row.snapshot_digest,
      eligibilityMarkers: Object.freeze(
        JSON.parse(eligibilityMarkersJson) as OfflineAuthoritativeSnapshotEligibilityMarkers,
      ),
      snapshot: Object.freeze(snapshot),
    });
  }

  private toRow(record: OfflineAuthoritativeSnapshotRecord): SnapshotRow {
    const valueProtectionPosture = this.valueProtection.posture;
    const eligibilityMarkersJson = JSON.stringify(record.eligibilityMarkers);
    const snapshotJson = JSON.stringify(record.snapshot);
    return {
      workspace_id: record.workspaceId,
      resource_class: record.resourceClass,
      resource_id: record.resourceId,
      authoritative_revision: record.authoritativeRevision,
      authoritative_snapshot_revision: record.authoritativeSnapshotRevision,
      authority_scope: record.authorityScope,
      storage_bucket: record.storageBucket,
      behavior_class: record.behaviorClass,
      cached_at: record.cachedAt,
      last_synchronized_at: record.lastSynchronizedAt,
      expires_at: record.expiresAt ?? null,
      cached_by_actor_user_identity_id: record.cachedByActorUserIdentityId,
      cache_protection_posture: record.cacheProtectionPosture,
      value_protection_posture: valueProtectionPosture,
      snapshot_digest: record.snapshotDigest,
      eligibility_markers_json: this.valueProtection.protect(eligibilityMarkersJson, {
        store: "offline-snapshot-cache",
        field: "eligibility_markers_json",
      }),
      snapshot_json: this.valueProtection.protect(snapshotJson, {
        store: "offline-snapshot-cache",
        field: "snapshot_json",
      }),
    };
  }
}
