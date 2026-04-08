import fs from "node:fs";
import path from "node:path";
import type {
  IImageAssetRepository,
  ImageAssetRepositoryListQuery,
  ImageAssetRepositoryMutationContext,
  ImageAssetRepositoryMutationResult,
} from "@application/image-assets/ports/IImageAssetRepository";
import type { ImageAsset } from "@domain/image-assets/ImageAssetDomain";
import {
  ImageAssetStatuses,
  transitionImageAssetStatus,
} from "@domain/image-assets/ImageAssetDomain";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
} from "@shared/persistence/PersistenceVersioning";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  IMAGE_ASSET_PERSISTENCE_MIGRATIONS,
  IMAGE_ASSET_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteImageAssetPersistenceMigrations";
import {
  mapImageAssetRowToDomain,
  mapImageAssetToRecordRowValues,
  normalizeImageAssetLookup,
  normalizeImageAssetOperationKey,
  parseImageAssetMutationReplayRow,
  type ImageAssetLineageUpstreamRow,
  type ImageAssetMutationReplayRow,
  type ImageAssetRecordRow,
} from "./ImageAssetPersistenceMapper";

type ImageAssetMutationKind =
  | "create-image-asset"
  | "save-image-asset"
  | "archive-image-asset"
  | "soft-delete-image-asset";

interface PersistMutationOptions {
  readonly mutationKind: ImageAssetMutationKind;
  readonly imageAsset: ImageAsset;
  readonly mutation: ImageAssetRepositoryMutationContext;
  readonly requireExisting: boolean;
  readonly requireAbsent: boolean;
}

export class SqliteImageAssetPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements IImageAssetRepository {
  private database?: SqliteCompatDatabase;

  private initialized = false;

  public constructor(private readonly databasePath: string) {
    super("ImageAsset");
  }

  public async findImageAssetById(
    assetId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<ImageAsset | undefined> {
    const normalizedAssetId = normalizeImageAssetLookup(assetId);
    if (!normalizedAssetId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_asset_records
      WHERE asset_id = ?
      ${options?.includeDeleted ? "" : "AND lifecycle_status <> 'deleted'"}
      LIMIT 1
    `).get(normalizedAssetId) as ImageAssetRecordRow | undefined;

    if (!row) {
      return undefined;
    }

    return this.hydrateImageAsset(row);
  }

  public async listImageAssets(query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    const workspaceId = normalizeImageAssetLookup(query.workspaceId);
    if (!workspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [workspaceId];

    if (!query.includeDeleted) {
      clauses.push("lifecycle_status <> 'deleted'");
    }

    const ownerUserIds = this.normalizeLookupList(query.ownerUserIds);
    if (ownerUserIds.length > 0) {
      clauses.push(`owner_user_id IN (${ownerUserIds.map(() => "?").join(", ")})`);
      params.push(...ownerUserIds);
    }

    if (query.originKinds && query.originKinds.length > 0) {
      clauses.push(`origin_kind IN (${query.originKinds.map(() => "?").join(", ")})`);
      params.push(...query.originKinds);
    }

    if (query.lifecycleStatuses && query.lifecycleStatuses.length > 0) {
      clauses.push(`lifecycle_status IN (${query.lifecycleStatuses.map(() => "?").join(", ")})`);
      params.push(...query.lifecycleStatuses);
    }

    if (query.visibilities && query.visibilities.length > 0) {
      clauses.push(`visibility IN (${query.visibilities.map(() => "?").join(", ")})`);
      params.push(...query.visibilities);
    }

    if (query.mediaTypes && query.mediaTypes.length > 0) {
      clauses.push(`media_type IN (${query.mediaTypes.map(() => "?").join(", ")})`);
      params.push(...query.mediaTypes);
    }

    const storageInstanceIds = this.normalizeLookupList(query.storageInstanceIds);
    if (storageInstanceIds.length > 0) {
      clauses.push(`storage_instance_id IN (${storageInstanceIds.map(() => "?").join(", ")})`);
      params.push(...storageInstanceIds);
    }

    const sourceRunIds = this.normalizeLookupList(query.sourceRunIds);
    if (sourceRunIds.length > 0) {
      clauses.push(`source_run_id IN (${sourceRunIds.map(() => "?").join(", ")})`);
      params.push(...sourceRunIds);
    }

    const generationOperationIds = this.normalizeLookupList(query.generationOperationIds);
    if (generationOperationIds.length > 0) {
      clauses.push(`generation_operation_id IN (${generationOperationIds.map(() => "?").join(", ")})`);
      params.push(...generationOperationIds);
    }

    if (query.createdAfter) {
      clauses.push("created_at >= ?");
      params.push(query.createdAfter);
    }
    if (query.createdBefore) {
      clauses.push("created_at <= ?");
      params.push(query.createdBefore);
    }
    if (query.updatedAfter) {
      clauses.push("updated_at >= ?");
      params.push(query.updatedAfter);
    }
    if (query.updatedBefore) {
      clauses.push("updated_at <= ?");
      params.push(query.updatedBefore);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);
    const rows = this.getDatabase().prepare(`
      SELECT *
      FROM image_asset_records
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC, asset_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as ImageAssetRecordRow[];

    return Object.freeze(rows.map((row) => this.hydrateImageAsset(row)));
  }

  public async createImageAsset(
    imageAsset: ImageAsset,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult> {
    return this.persistMutation({
      mutationKind: "create-image-asset",
      imageAsset,
      mutation,
      requireExisting: false,
      requireAbsent: true,
    });
  }

  public async saveImageAsset(
    imageAsset: ImageAsset,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult> {
    return this.persistMutation({
      mutationKind: "save-image-asset",
      imageAsset,
      mutation,
      requireExisting: false,
      requireAbsent: false,
    });
  }

  public async archiveImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    const current = await this.findImageAssetById(assetId, { includeDeleted: true });
    if (!current) {
      return undefined;
    }

    const archived = transitionImageAssetStatus(current, {
      nextStatus: ImageAssetStatuses.archived,
      actorUserId: mutation.actorUserId,
      occurredAt: mutation.occurredAt,
    });

    return this.persistMutation({
      mutationKind: "archive-image-asset",
      imageAsset: archived,
      mutation,
      requireExisting: true,
      requireAbsent: false,
    });
  }

  public async softDeleteImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    const current = await this.findImageAssetById(assetId, { includeDeleted: true });
    if (!current) {
      return undefined;
    }

    const deleted = transitionImageAssetStatus(current, {
      nextStatus: ImageAssetStatuses.deleted,
      actorUserId: mutation.actorUserId,
      occurredAt: mutation.occurredAt,
    });

    return this.persistMutation({
      mutationKind: "soft-delete-image-asset",
      imageAsset: deleted,
      mutation,
      requireExisting: true,
      requireAbsent: false,
    });
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private persistMutation(options: PersistMutationOptions): ImageAssetRepositoryMutationResult {
    const operationKey = this.normalizeOperationKey(options.mutation.operationKey);
    const replay = this.getMutationReplayRecord(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        imageAsset: replay,
      });
    }

    const normalizedAssetId = normalizeImageAssetLookup(options.imageAsset.assetId);
    if (!normalizedAssetId) {
      throw new Error("Image asset persistence requires a non-empty asset id.");
    }

    const existingRow = this.getAssetRowById(normalizedAssetId);
    const existingAsset = existingRow ? this.hydrateImageAsset(existingRow) : undefined;

    if (options.requireAbsent && existingRow) {
      throw new Error(`Image asset '${normalizedAssetId}' already exists.`);
    }

    if (options.requireExisting && !existingRow) {
      throw new Error(`Image asset '${normalizedAssetId}' was not found.`);
    }

    assertExpectedPersistenceRevision(
      options.mutation.expectedRevision,
      existingRow?.revision,
      "ImageAsset",
    );

    if (existingAsset && existingAsset.updatedAt > options.imageAsset.updatedAt) {
      throw new Error(
        `Image asset persistence conflict while saving asset '${options.imageAsset.assetId}': a newer record already exists.`,
      );
    }

    const changed = !existingAsset || JSON.stringify(existingAsset) !== JSON.stringify(options.imageAsset);
    const revision = changed
      ? nextPersistenceRevision(existingRow?.revision)
      : (existingRow?.revision ?? 1);

    this.getDatabase().transaction(() => {
      this.getDatabase().prepare(`
        INSERT INTO image_asset_records (
          asset_id,
          workspace_id,
          owner_user_id,
          origin_kind,
          visibility,
          sharing_policy_mode,
          sharing_policy_id,
          sharing_policy_version,
          storage_instance_id,
          storage_binding_reference,
          media_type,
          original_filename,
          normalized_filename,
          size_bytes,
          fingerprint_algorithm,
          fingerprint_digest,
          lifecycle_status,
          lifecycle_ingested_at,
          lifecycle_failed_at,
          lifecycle_failed_by,
          lifecycle_failure_reason,
          lifecycle_archived_at,
          lifecycle_archived_by,
          lifecycle_deleted_at,
          lifecycle_deleted_by,
          latest_object_key,
          latest_object_version_id,
          preview_asset_id,
          preview_media_type,
          source_run_id,
          generation_operation_id,
          created_by,
          last_modified_by,
          created_at,
          updated_at,
          revision,
          schema_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          owner_user_id = excluded.owner_user_id,
          origin_kind = excluded.origin_kind,
          visibility = excluded.visibility,
          sharing_policy_mode = excluded.sharing_policy_mode,
          sharing_policy_id = excluded.sharing_policy_id,
          sharing_policy_version = excluded.sharing_policy_version,
          storage_instance_id = excluded.storage_instance_id,
          storage_binding_reference = excluded.storage_binding_reference,
          media_type = excluded.media_type,
          original_filename = excluded.original_filename,
          normalized_filename = excluded.normalized_filename,
          size_bytes = excluded.size_bytes,
          fingerprint_algorithm = excluded.fingerprint_algorithm,
          fingerprint_digest = excluded.fingerprint_digest,
          lifecycle_status = excluded.lifecycle_status,
          lifecycle_ingested_at = excluded.lifecycle_ingested_at,
          lifecycle_failed_at = excluded.lifecycle_failed_at,
          lifecycle_failed_by = excluded.lifecycle_failed_by,
          lifecycle_failure_reason = excluded.lifecycle_failure_reason,
          lifecycle_archived_at = excluded.lifecycle_archived_at,
          lifecycle_archived_by = excluded.lifecycle_archived_by,
          lifecycle_deleted_at = excluded.lifecycle_deleted_at,
          lifecycle_deleted_by = excluded.lifecycle_deleted_by,
          latest_object_key = excluded.latest_object_key,
          latest_object_version_id = excluded.latest_object_version_id,
          preview_asset_id = excluded.preview_asset_id,
          preview_media_type = excluded.preview_media_type,
          source_run_id = excluded.source_run_id,
          generation_operation_id = excluded.generation_operation_id,
          created_by = excluded.created_by,
          last_modified_by = excluded.last_modified_by,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          revision = excluded.revision,
          schema_version = excluded.schema_version
        WHERE excluded.updated_at >= image_asset_records.updated_at
      `).run(...mapImageAssetToRecordRowValues({
        imageAsset: options.imageAsset,
        revision,
        schemaVersion: IMAGE_ASSET_PERSISTENCE_SCHEMA_VERSION,
      }));

      this.getDatabase().prepare("DELETE FROM image_asset_lineage_upstreams WHERE asset_id = ?")
        .run(options.imageAsset.assetId);

      const insertUpstream = this.getDatabase().prepare(`
        INSERT INTO image_asset_lineage_upstreams (
          asset_id,
          upstream_asset_id,
          ordinal
        ) VALUES (?, ?, ?)
      `);

      for (const [index, upstreamAssetId] of (options.imageAsset.lineage?.upstreamAssetIds ?? []).entries()) {
        insertUpstream.run(options.imageAsset.assetId, upstreamAssetId, index);
      }

      this.persistMutationReplayRecord(operationKey, options.mutationKind, options.imageAsset, options.mutation);
    })();

    return Object.freeze({
      changed,
      wasReplay: false,
      imageAsset: options.imageAsset,
    });
  }

  private hydrateImageAsset(row: ImageAssetRecordRow): ImageAsset {
    const lineageRows = this.getDatabase().prepare(`
      SELECT asset_id, upstream_asset_id, ordinal
      FROM image_asset_lineage_upstreams
      WHERE asset_id = ?
      ORDER BY ordinal ASC
    `).all(row.asset_id) as ImageAssetLineageUpstreamRow[];

    return mapImageAssetRowToDomain(
      row,
      lineageRows.map((entry) => entry.upstream_asset_id),
    );
  }

  private getAssetRowById(assetId: string): ImageAssetRecordRow | undefined {
    return this.getDatabase().prepare(`
      SELECT *
      FROM image_asset_records
      WHERE asset_id = ?
      LIMIT 1
    `).get(assetId) as ImageAssetRecordRow | undefined;
  }

  private getMutationReplayRecord(operationKey: string): ImageAsset | undefined {
    const row = this.getDatabase().prepare(`
      SELECT *
      FROM image_asset_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as ImageAssetMutationReplayRow | undefined;

    return row ? parseImageAssetMutationReplayRow(row) : undefined;
  }

  private persistMutationReplayRecord(
    operationKey: string,
    mutationKind: ImageAssetMutationKind,
    imageAsset: ImageAsset,
    mutation: ImageAssetRepositoryMutationContext,
  ): void {
    this.getDatabase().prepare(`
      INSERT INTO image_asset_mutation_replays (
        operation_key,
        mutation_kind,
        asset_id,
        mutation_snapshot_json,
        actor_user_id,
        correlation_id,
        reason,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      operationKey,
      mutationKind,
      imageAsset.assetId,
      JSON.stringify(imageAsset),
      mutation.actorUserId,
      mutation.correlationId ?? null,
      mutation.reason ?? null,
      this.resolveMutationTimestamp(mutation.occurredAt),
      new Date().toISOString(),
    );
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
    if (currentVersion > IMAGE_ASSET_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Image asset schema version ${currentVersion} is newer than supported version ${IMAGE_ASSET_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of IMAGE_ASSET_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO image_asset_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS image_asset_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM image_asset_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private normalizeLookupList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
    if (!values || values.length === 0) {
      return Object.freeze([]);
    }

    return Object.freeze(values
      .map((value) => normalizeImageAssetLookup(value))
      .filter((value): value is string => Boolean(value)));
  }

  private normalizeOperationKey(operationKey: string): string {
    return normalizeImageAssetOperationKey(operationKey);
  }
}
