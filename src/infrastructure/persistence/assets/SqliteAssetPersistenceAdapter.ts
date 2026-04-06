import fs from "node:fs";
import path from "node:path";
import type {
  AssetListQuery,
  AssetSaveResult,
  IAssetRepository,
} from "../../../application/assets/ports/IAssetRepository";
import type { Asset } from "../../../domain/assets/AssetDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapAssetRecordToRowValues,
  mapAssetRowsToDomain,
  mapAssetVersionToRowValues,
  normalizeAssetLookup,
  normalizeLineageRelation,
  type AssetLineageLinkRow,
  type AssetRecordRow,
  type AssetVersionRow,
} from "./AssetPersistenceMapper";
import {
  ASSET_PERSISTENCE_MIGRATIONS,
  ASSET_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteAssetPersistenceMigrations";

export class SqliteAssetPersistenceAdapter implements IAssetRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  public constructor(private readonly databasePath: string) {}

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    const normalizedAssetId = normalizeAssetLookup(assetId);
    if (!normalizedAssetId) {
      return undefined;
    }

    return this.getPersistedAsset(normalizedAssetId);
  }

  public async listAssets(query: AssetListQuery): Promise<ReadonlyArray<Asset>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const workspaceId = normalizeAssetLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("a.workspace_id = ?");
      params.push(workspaceId);
    }

    const ownerUserId = normalizeAssetLookup(query.ownerUserId ?? "");
    if (ownerUserId) {
      clauses.push("a.owner_user_id = ?");
      params.push(ownerUserId);
    }

    const createdByUserId = normalizeAssetLookup(query.createdByUserId ?? "");
    if (createdByUserId) {
      clauses.push("a.created_by = ?");
      params.push(createdByUserId);
    }

    const storageInstanceId = normalizeAssetLookup(query.storageInstanceId ?? "");
    if (storageInstanceId) {
      clauses.push("a.storage_instance_id = ?");
      params.push(storageInstanceId);
    }

    if (query.assetKinds && query.assetKinds.length > 0) {
      clauses.push(`a.kind IN (${query.assetKinds.map(() => "?").join(", ")})`);
      params.push(...query.assetKinds);
    }

    if (query.visibilities && query.visibilities.length > 0) {
      clauses.push(`a.visibility IN (${query.visibilities.map(() => "?").join(", ")})`);
      params.push(...query.visibilities);
    }

    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      clauses.push(`a.lifecycle_state IN (${query.lifecycleStates.map(() => "?").join(", ")})`);
      params.push(...query.lifecycleStates);
    }

    const sourceAssetId = normalizeAssetLookup(query.sourceAssetId ?? "");
    const sourceAssetVersionId = normalizeAssetLookup(query.sourceAssetVersionId ?? "");
    if (sourceAssetId) {
      clauses.push(`EXISTS (
        SELECT 1
        FROM asset_lineage_links l
        WHERE l.asset_id = a.asset_id
          AND l.source_asset_id = ?
          ${sourceAssetVersionId ? "AND l.source_asset_version_id = ?" : ""}
      )`);
      params.push(sourceAssetId);

      if (sourceAssetVersionId) {
        params.push(sourceAssetVersionId);
      }
    }

    const paging = this.toPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(`
      SELECT a.*
      FROM asset_records a
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY a.created_at DESC, a.asset_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as AssetRecordRow[];

    const assets = rows
      .map((row) => this.getPersistedAsset(row.asset_id))
      .filter((asset): asset is Asset => Boolean(asset));

    return Object.freeze(assets);
  }

  public async createAsset(asset: Asset): Promise<AssetSaveResult> {
    const existing = await this.findAssetById(asset.id);
    if (existing) {
      throw new Error(`Asset '${asset.id}' already exists.`);
    }

    this.persistAsset(asset);

    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async saveAsset(asset: Asset): Promise<AssetSaveResult> {
    const existing = await this.findAssetById(asset.id);
    if (
      existing
      && existing.ownership.lastModifiedAt > asset.ownership.lastModifiedAt
    ) {
      throw new Error(
        `Asset persistence conflict while saving asset '${asset.id}': a newer record already exists.`,
      );
    }

    this.persistAsset(asset);

    return Object.freeze({
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(asset),
      asset,
    });
  }

  public async replaceAssetLineage(
    assetId: string,
    lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void> {
    const normalizedAssetId = normalizeAssetLookup(assetId);
    if (!normalizedAssetId) {
      throw new Error("Asset lineage replacement requires asset id.");
    }

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare("DELETE FROM asset_lineage_links WHERE asset_id = ?")
        .run(normalizedAssetId);

      const statement = this.getDatabase().prepare(`
        INSERT INTO asset_lineage_links (
          asset_id,
          source_asset_id,
          source_asset_version_id,
          relation,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const entry of lineage) {
        const normalizedSourceAssetId = normalizeAssetLookup(entry.sourceAssetId);
        if (!normalizedSourceAssetId) {
          throw new Error("Asset lineage sourceAssetId is required.");
        }

        const normalizedSourceVersionId = normalizeAssetLookup(entry.sourceAssetVersionId ?? "");
        statement.run(
          normalizedAssetId,
          normalizedSourceAssetId,
          normalizedSourceVersionId ?? null,
          normalizeLineageRelation(entry.relation),
          new Date().toISOString(),
        );
      }
    })();
  }

  public async listAssetLineage(assetId: string): Promise<ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation: string;
  }>> {
    const normalizedAssetId = normalizeAssetLookup(assetId);
    if (!normalizedAssetId) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM asset_lineage_links
      WHERE asset_id = ?
      ORDER BY created_at ASC
    `).all(normalizedAssetId) as AssetLineageLinkRow[];

    return Object.freeze(rows.map((row) => Object.freeze({
      sourceAssetId: row.source_asset_id,
      sourceAssetVersionId: row.source_asset_version_id ?? undefined,
      relation: row.relation,
    })));
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistAsset(asset: Asset): void {
    const normalizedAssetId = normalizeAssetLookup(asset.id);
    if (!normalizedAssetId) {
      throw new Error("Asset persistence requires asset id.");
    }

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO asset_records (
          asset_id,
          workspace_id,
          owner_user_id,
          storage_instance_id,
          storage_uri,
          kind,
          visibility,
          sharing_policy_id,
          sharing_policy_version,
          lifecycle_state,
          archived_at,
          archived_by,
          deleted_at,
          deleted_by,
          display_name,
          current_version_id,
          created_by,
          created_at,
          last_modified_by,
          last_modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          owner_user_id = excluded.owner_user_id,
          storage_instance_id = excluded.storage_instance_id,
          storage_uri = excluded.storage_uri,
          kind = excluded.kind,
          visibility = excluded.visibility,
          sharing_policy_id = excluded.sharing_policy_id,
          sharing_policy_version = excluded.sharing_policy_version,
          lifecycle_state = excluded.lifecycle_state,
          archived_at = excluded.archived_at,
          archived_by = excluded.archived_by,
          deleted_at = excluded.deleted_at,
          deleted_by = excluded.deleted_by,
          display_name = excluded.display_name,
          current_version_id = excluded.current_version_id,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          last_modified_by = excluded.last_modified_by,
          last_modified_at = excluded.last_modified_at
        WHERE excluded.last_modified_at >= asset_records.last_modified_at
      `).run(...mapAssetRecordToRowValues(asset));

      this.getDatabase().prepare("DELETE FROM asset_versions WHERE asset_id = ?")
        .run(normalizedAssetId);

      const insertVersion = this.getDatabase().prepare(`
        INSERT INTO asset_versions (
          asset_id,
          version_id,
          revision,
          storage_instance_id,
          storage_uri,
          object_key,
          object_version_id,
          storage_area,
          mime_type,
          size_bytes,
          checksum_algorithm,
          checksum_digest,
          original_file_name,
          content_encryption_descriptor,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

      for (const rowValues of mapAssetVersionToRowValues(asset)) {
        insertVersion.run(...rowValues);
      }
    })();
  }

  private getPersistedAsset(assetId: string): Asset | undefined {
    const assetRow = this.getDatabase().prepare("SELECT * FROM asset_records WHERE asset_id = ? LIMIT 1")
      .get(assetId) as AssetRecordRow | undefined;

    if (!assetRow) {
      return undefined;
    }

    const versionRows = this.getDatabase().prepare(`
      SELECT *
      FROM asset_versions
      WHERE asset_id = ?
      ORDER BY revision ASC
    `).all(assetId) as AssetVersionRow[];

    return mapAssetRowsToDomain(assetRow, versionRows);
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
    if (currentVersion > ASSET_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Asset schema version ${currentVersion} is newer than supported version ${ASSET_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of ASSET_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO asset_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS asset_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM asset_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private toPagingClause(limit?: number, offset?: number): { readonly sql: string; readonly params: ReadonlyArray<number> } {
    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
    const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : undefined;

    if (normalizedLimit !== undefined && normalizedOffset !== undefined) {
      return {
        sql: "LIMIT ? OFFSET ?",
        params: Object.freeze([normalizedLimit, normalizedOffset]),
      };
    }

    if (normalizedLimit !== undefined) {
      return {
        sql: "LIMIT ?",
        params: Object.freeze([normalizedLimit]),
      };
    }

    if (normalizedOffset !== undefined) {
      return {
        sql: "LIMIT -1 OFFSET ?",
        params: Object.freeze([normalizedOffset]),
      };
    }

    return {
      sql: "",
      params: Object.freeze([]),
    };
  }
}
