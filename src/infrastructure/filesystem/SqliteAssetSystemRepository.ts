import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Asset } from "../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo, AssetTechnicalMetadata } from "../../domain/assets/AssetMetadata";
import { AssetLineageEdge } from "../../domain/assets/AssetLineageEdge";
import { AssetTransformation } from "../../domain/assets/AssetTransformation";
import { AssetVersion } from "../../domain/assets/AssetVersion";
import { createCompositionTaxonomyDescriptor, type CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { AssetLineageDirection, IAssetLineageRepository } from "../../application/ports/interfaces/IAssetLineageRepository";
import type { IAssetRecordRepository } from "../../application/ports/interfaces/IAssetRecordRepository";
import type { IAssetTransformationRepository } from "../../application/ports/interfaces/IAssetTransformationRepository";
import type { IAssetVersionRepository } from "../../application/ports/interfaces/IAssetVersionRepository";
import type { ICanonicalAssetIdentityRepository, CanonicalAssetIdentityRecord, CanonicalEntityType } from "../../application/ports/interfaces/ICanonicalAssetIdentityRepository";
import type { CanonicalAssetQueryCriteria, IAssetSystemQueryRepository } from "../../application/ports/interfaces/IAssetSystemQueryRepository";
import type { CanonicalDependencyStateSummary } from "../../application/assets-system/CanonicalDependencyStateUseCase";
import type { ICanonicalDependencyStateRepository } from "../../application/ports/interfaces/ICanonicalDependencyStateRepository";
import type {
  IRegistryGraphProjectionRepository,
  RegistryGraphProjectionSnapshot,
  RegistryGraphProjectionState,
} from "../../application/ports/interfaces/IRegistryGraphProjectionRepository";

interface AssetRow { readonly asset_json: string; }
interface AssetVersionRow {
  readonly version_json: string;
  readonly version_label?: string | null;
  readonly parent_version_id?: string | null;
}
interface LineageRow { readonly edge_json: string; }
interface TransformationRow { readonly transformation_json: string; }
interface IdentityRow {
  readonly entity_type: CanonicalEntityType;
  readonly entity_id: string;
  readonly asset_id: string;
  readonly latest_version_id?: string | null;
  readonly structural_kind?: string | null;
  readonly semantic_role?: string | null;
  readonly behavior_kind?: string | null;
  readonly updated_at: string;
}
interface DependencyStateRow {
  readonly version_id: string;
  readonly summary_json: string;
  readonly computed_at: string;
}
interface RegistryGraphProjectionRow {
  readonly node_json?: string;
  readonly edge_json?: string;
}
interface RegistryGraphProjectionStateRow {
  readonly is_dirty: number;
  readonly computed_at?: string | null;
  readonly source_version_count?: number | null;
  readonly source_lineage_edge_count?: number | null;
}

function parseIdentityTaxonomy(row: IdentityRow): CompositionTaxonomyDescriptor | undefined {
  if (!row.structural_kind || !row.semantic_role || !row.behavior_kind) {
    return undefined;
  }

  try {
    return createCompositionTaxonomyDescriptor({
      structuralKind: row.structural_kind as CompositionTaxonomyDescriptor["structuralKind"],
      semanticRole: row.semantic_role as CompositionTaxonomyDescriptor["semanticRole"],
      behaviorKind: row.behavior_kind as CompositionTaxonomyDescriptor["behaviorKind"],
    });
  } catch {
    return undefined;
  }
}

const SCHEMA_VERSION = 7;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE asset_system_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE assets (
      asset_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      source_type TEXT NOT NULL,
      updated_at TEXT,
      asset_json TEXT NOT NULL
    );
    CREATE TABLE asset_versions (
      version_id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      content_sha256 TEXT,
      version_json TEXT NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE
    );
    CREATE INDEX asset_versions_asset_idx ON asset_versions(asset_id, created_at DESC);
    CREATE TABLE asset_lineage_edges (
      edge_id TEXT PRIMARY KEY,
      from_version_id TEXT NOT NULL,
      to_version_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      transformation_id TEXT,
      created_at TEXT NOT NULL,
      edge_json TEXT NOT NULL,
      FOREIGN KEY(from_version_id) REFERENCES asset_versions(version_id) ON DELETE CASCADE,
      FOREIGN KEY(to_version_id) REFERENCES asset_versions(version_id) ON DELETE CASCADE
    );
    CREATE INDEX asset_lineage_from_idx ON asset_lineage_edges(from_version_id, created_at DESC);
    CREATE INDEX asset_lineage_to_idx ON asset_lineage_edges(to_version_id, created_at DESC);
    CREATE TABLE asset_transformations (
      transformation_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      transformation_json TEXT NOT NULL
    );
    CREATE TABLE asset_transformation_versions (
      transformation_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY(transformation_id, version_id, role),
      FOREIGN KEY(transformation_id) REFERENCES asset_transformations(transformation_id) ON DELETE CASCADE,
      FOREIGN KEY(version_id) REFERENCES asset_versions(version_id) ON DELETE CASCADE
    );
    CREATE INDEX asset_transform_versions_idx ON asset_transformation_versions(version_id, role);
  `],
  [2, `
    ALTER TABLE asset_versions ADD COLUMN version_label TEXT;
    ALTER TABLE asset_versions ADD COLUMN parent_version_id TEXT;
    CREATE INDEX asset_versions_parent_idx ON asset_versions(parent_version_id);
  `],

  [3, `
    CREATE TABLE IF NOT EXISTS canonical_asset_identities (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      latest_version_id TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(entity_type, entity_id),
      FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE,
      FOREIGN KEY(latest_version_id) REFERENCES asset_versions(version_id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS assets_kind_source_status_idx ON assets(kind, source_type, status);
    CREATE INDEX IF NOT EXISTS asset_transformations_kind_idx ON asset_transformations(kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS canonical_identity_asset_idx ON canonical_asset_identities(asset_id, updated_at DESC);
  `],
  [4, `
    CREATE INDEX IF NOT EXISTS canonical_identity_lookup_idx ON canonical_asset_identities(entity_type, entity_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS canonical_identity_latest_idx ON canonical_asset_identities(latest_version_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS asset_versions_asset_parent_idx ON asset_versions(asset_id, parent_version_id, created_at DESC);
  `],
  [5, `
    CREATE TABLE IF NOT EXISTS canonical_dependency_state (
      version_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      lineage_confidence TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      FOREIGN KEY(version_id) REFERENCES asset_versions(version_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS canonical_dependency_state_idx ON canonical_dependency_state(state, computed_at DESC);
  `],
  [6, `
    ALTER TABLE canonical_asset_identities ADD COLUMN structural_kind TEXT;
    ALTER TABLE canonical_asset_identities ADD COLUMN semantic_role TEXT;
    ALTER TABLE canonical_asset_identities ADD COLUMN behavior_kind TEXT;
    CREATE INDEX IF NOT EXISTS canonical_identity_taxonomy_idx ON canonical_asset_identities(structural_kind, semantic_role, behavior_kind, updated_at DESC);
  `],
  [7, `
    CREATE TABLE IF NOT EXISTS registry_dependency_projection_nodes (
      version_id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      name TEXT,
      kind TEXT,
      status TEXT,
      structural_kind TEXT,
      semantic_role TEXT,
      behavior_kind TEXT,
      is_registry_projected INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      node_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registry_dependency_projection_edges (
      edge_key TEXT PRIMARY KEY,
      from_version_id TEXT NOT NULL,
      to_version_id TEXT NOT NULL,
      from_asset_id TEXT NOT NULL,
      to_asset_id TEXT NOT NULL,
      source TEXT NOT NULL,
      relationship_type TEXT,
      updated_at TEXT NOT NULL,
      edge_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registry_projection_edges_from_idx ON registry_dependency_projection_edges(from_version_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS registry_projection_edges_to_idx ON registry_dependency_projection_edges(to_version_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS registry_dependency_projection_state (
      projection_id TEXT PRIMARY KEY CHECK (projection_id = 'default'),
      is_dirty INTEGER NOT NULL,
      computed_at TEXT,
      source_version_count INTEGER,
      source_lineage_edge_count INTEGER,
      updated_at TEXT NOT NULL
    );
    INSERT INTO registry_dependency_projection_state (projection_id, is_dirty, computed_at, source_version_count, source_lineage_edge_count, updated_at)
    VALUES ('default', 1, NULL, NULL, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(projection_id) DO NOTHING;
  `],
]);

export class SqliteAssetSystemRepository implements
  IAssetRecordRepository,
  IAssetVersionRepository,
  IAssetLineageRepository,
  IAssetTransformationRepository,
  ICanonicalAssetIdentityRepository,
  ICanonicalDependencyStateRepository,
  IRegistryGraphProjectionRepository,
  IAssetSystemQueryRepository {
  private database?: Database.Database;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async save(asset: IAsset): Promise<void> {
    const db = this.getDatabase();
    db.prepare(`
      INSERT INTO assets (asset_id, name, kind, status, source_type, updated_at, asset_json)
      VALUES (@assetId, @name, @kind, @status, @sourceType, @updatedAt, @assetJson)
      ON CONFLICT(asset_id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        status = excluded.status,
        source_type = excluded.source_type,
        updated_at = excluded.updated_at,
        asset_json = excluded.asset_json
    `).run({
      assetId: asset.id,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      sourceType: asset.source.type,
      updatedAt: asset.audit?.updatedAt?.toISOString() ?? new Date().toISOString(),
      assetJson: JSON.stringify(asset),
    });
  }

  public async getById(assetId: string): Promise<IAsset | undefined> {
    const row = this.getDatabase()
      .prepare("SELECT asset_json FROM assets WHERE asset_id = ?")
      .get(assetId.trim()) as AssetRow | undefined;

    return row ? this.parseAsset(row.asset_json) : undefined;
  }

  public async list(): Promise<ReadonlyArray<IAsset>> {
    const rows = this.getDatabase()
      .prepare("SELECT asset_json FROM assets ORDER BY name COLLATE NOCASE ASC")
      .all() as AssetRow[];

    return Object.freeze(rows.map((row) => this.parseAsset(row.asset_json)));
  }

  public async listAssetsByCriteria(criteria?: CanonicalAssetQueryCriteria): Promise<ReadonlyArray<IAsset>> {
    const where: string[] = [];
    const params: Record<string, unknown> = {};

    if (criteria?.kinds?.length) {
      const placeholders = criteria.kinds.map((_, index) => `@kind${index}`);
      criteria.kinds.forEach((value, index) => { params[`kind${index}`] = value; });
      where.push(`kind IN (${placeholders.join(", ")})`);
    }

    if (criteria?.sourceTypes?.length) {
      const placeholders = criteria.sourceTypes.map((_, index) => `@sourceType${index}`);
      criteria.sourceTypes.forEach((value, index) => { params[`sourceType${index}`] = value; });
      where.push(`source_type IN (${placeholders.join(", ")})`);
    }

    if (criteria?.statuses?.length) {
      const placeholders = criteria.statuses.map((_, index) => `@status${index}`);
      criteria.statuses.forEach((value, index) => { params[`status${index}`] = value; });
      where.push(`status IN (${placeholders.join(", ")})`);
    }

    if (criteria?.structuralKinds?.length) {
      const placeholders = criteria.structuralKinds.map((_, index) => `@structuralKind${index}`);
      criteria.structuralKinds.forEach((value, index) => { params[`structuralKind${index}`] = value; });
      where.push(`
        EXISTS (
          SELECT 1 FROM canonical_asset_identities cai
          WHERE cai.asset_id = assets.asset_id
            AND cai.structural_kind IN (${placeholders.join(", ")})
        )
      `);
    }

    if (criteria?.semanticRoles?.length) {
      const placeholders = criteria.semanticRoles.map((_, index) => `@semanticRole${index}`);
      criteria.semanticRoles.forEach((value, index) => { params[`semanticRole${index}`] = value; });
      where.push(`
        EXISTS (
          SELECT 1 FROM canonical_asset_identities cai
          WHERE cai.asset_id = assets.asset_id
            AND cai.semantic_role IN (${placeholders.join(", ")})
        )
      `);
    }

    if (criteria?.behaviorKinds?.length) {
      const placeholders = criteria.behaviorKinds.map((_, index) => `@behaviorKind${index}`);
      criteria.behaviorKinds.forEach((value, index) => { params[`behaviorKind${index}`] = value; });
      where.push(`
        EXISTS (
          SELECT 1 FROM canonical_asset_identities cai
          WHERE cai.asset_id = assets.asset_id
            AND cai.behavior_kind IN (${placeholders.join(", ")})
        )
      `);
    }

    const sql = `SELECT asset_json FROM assets ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, name COLLATE NOCASE ASC ${criteria?.limit ? "LIMIT @limit" : ""}`;
    if (criteria?.limit) {
      params.limit = criteria.limit;
    }

    const rows = this.getDatabase().prepare(sql).all(params) as AssetRow[];
    return Object.freeze(rows.map((row) => this.parseAsset(row.asset_json)));
  }

  public async exists(assetId: string): Promise<boolean> {
    const row = this.getDatabase().prepare("SELECT asset_id FROM assets WHERE asset_id = ?").get(assetId.trim()) as { asset_id: string } | undefined;
    return !!row;
  }

  public async saveVersion(version: AssetVersion): Promise<void> {
    this.assertAssetExists(version.assetId.value);

    this.getDatabase().prepare(`
      INSERT INTO asset_versions (version_id, asset_id, version_label, parent_version_id, created_at, content_sha256, version_json)
      VALUES (@versionId, @assetId, @versionLabel, @parentVersionId, @createdAt, @contentSha256, @versionJson)
      ON CONFLICT(version_id) DO UPDATE SET
        asset_id = excluded.asset_id,
        version_label = excluded.version_label,
        parent_version_id = excluded.parent_version_id,
        created_at = excluded.created_at,
        content_sha256 = excluded.content_sha256,
        version_json = excluded.version_json
    `).run({
      versionId: version.versionId,
      assetId: version.assetId.value,
      versionLabel: version.versionLabel,
      parentVersionId: version.parentVersionId,
      createdAt: version.createdAt.toISOString(),
      contentSha256: version.contentSha256,
      versionJson: JSON.stringify(version),
    });
    await this.markProjectionDirty();
  }

  public async getByVersionId(versionId: string): Promise<AssetVersion | undefined> {
    const row = this.getDatabase().prepare("SELECT version_json, version_label, parent_version_id FROM asset_versions WHERE version_id = ?").get(versionId.trim()) as AssetVersionRow | undefined;
    return row ? this.parseVersion(row) : undefined;
  }

  public async listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    const rows = this.getDatabase()
      .prepare("SELECT version_json, version_label, parent_version_id FROM asset_versions WHERE asset_id = ? ORDER BY created_at DESC")
      .all(assetId.trim()) as AssetVersionRow[];

    return Object.freeze(rows.map((row) => this.parseVersion(row)));
  }

  public async getLatestVersionForAsset(assetId: string): Promise<AssetVersion | undefined> {
    const row = this.getDatabase()
      .prepare("SELECT version_json, version_label, parent_version_id FROM asset_versions WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(assetId.trim()) as AssetVersionRow | undefined;
    return row ? this.parseVersion(row) : undefined;
  }

  public async listVersionChainByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    const rows = this.getDatabase()
      .prepare("SELECT version_json, version_label, parent_version_id FROM asset_versions WHERE asset_id = ? ORDER BY created_at DESC")
      .all(assetId.trim()) as AssetVersionRow[];
    return Object.freeze(rows.map((row) => this.parseVersion(row)));
  }

  public async saveEdge(edge: AssetLineageEdge): Promise<void> {
    this.assertVersionExists(edge.fromVersionId);
    this.assertVersionExists(edge.toVersionId);

    this.getDatabase().prepare(`
      INSERT INTO asset_lineage_edges (edge_id, from_version_id, to_version_id, kind, transformation_id, created_at, edge_json)
      VALUES (@edgeId, @fromVersionId, @toVersionId, @kind, @transformationId, @createdAt, @edgeJson)
      ON CONFLICT(edge_id) DO UPDATE SET
        from_version_id = excluded.from_version_id,
        to_version_id = excluded.to_version_id,
        kind = excluded.kind,
        transformation_id = excluded.transformation_id,
        created_at = excluded.created_at,
        edge_json = excluded.edge_json
    `).run({
      edgeId: edge.edgeId,
      fromVersionId: edge.fromVersionId,
      toVersionId: edge.toVersionId,
      kind: edge.kind,
      transformationId: edge.transformationId,
      createdAt: edge.createdAt.toISOString(),
      edgeJson: JSON.stringify(edge),
    });
    await this.markProjectionDirty();
  }

  public async listEdgesByVersionId(versionId: string, direction: AssetLineageDirection = "both"): Promise<ReadonlyArray<AssetLineageEdge>> {
    const normalizedVersionId = versionId.trim();
    let sql = "SELECT edge_json FROM asset_lineage_edges WHERE from_version_id = @versionId OR to_version_id = @versionId ORDER BY created_at DESC";
    if (direction === "upstream") {
      sql = "SELECT edge_json FROM asset_lineage_edges WHERE to_version_id = @versionId ORDER BY created_at DESC";
    } else if (direction === "downstream") {
      sql = "SELECT edge_json FROM asset_lineage_edges WHERE from_version_id = @versionId ORDER BY created_at DESC";
    }

    const rows = this.getDatabase().prepare(sql).all({ versionId: normalizedVersionId }) as LineageRow[];
    return Object.freeze(rows.map((row) => this.parseLineageEdge(row.edge_json)));
  }

  public async saveTransformation(transformation: AssetTransformation): Promise<void> {
    const db = this.getDatabase();
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO asset_transformations (transformation_id, kind, status, created_at, transformation_json)
        VALUES (@transformationId, @kind, @status, @createdAt, @transformationJson)
        ON CONFLICT(transformation_id) DO UPDATE SET
          kind = excluded.kind,
          status = excluded.status,
          created_at = excluded.created_at,
          transformation_json = excluded.transformation_json
      `).run({
        transformationId: transformation.transformationId,
        kind: transformation.kind,
        status: transformation.status,
        createdAt: transformation.createdAt.toISOString(),
        transformationJson: JSON.stringify(transformation),
      });

      db.prepare("DELETE FROM asset_transformation_versions WHERE transformation_id = ?").run(transformation.transformationId);
      const insert = db.prepare(`
        INSERT INTO asset_transformation_versions (transformation_id, version_id, role)
        VALUES (@transformationId, @versionId, @role)
      `);

      for (const versionId of transformation.inputVersionIds) {
        this.assertVersionExists(versionId);
        insert.run({ transformationId: transformation.transformationId, versionId, role: "input" });
      }

      for (const versionId of transformation.outputVersionIds) {
        this.assertVersionExists(versionId);
        insert.run({ transformationId: transformation.transformationId, versionId, role: "output" });
      }
    });

    transaction();
  }

  public async getById(transformationId: string): Promise<AssetTransformation | undefined> {
    const row = this.getDatabase().prepare("SELECT transformation_json FROM asset_transformations WHERE transformation_id = ?").get(transformationId.trim()) as TransformationRow | undefined;
    return row ? this.parseTransformation(row.transformation_json) : undefined;
  }

  public async listByVersionId(versionId: string): Promise<ReadonlyArray<AssetTransformation>> {
    const rows = this.getDatabase().prepare(`
      SELECT DISTINCT t.transformation_json
      FROM asset_transformations t
      JOIN asset_transformation_versions tv ON tv.transformation_id = t.transformation_id
      WHERE tv.version_id = ?
      ORDER BY t.created_at DESC
    `).all(versionId.trim()) as TransformationRow[];

    return Object.freeze(rows.map((row) => this.parseTransformation(row.transformation_json)));
  }

  public async listTransformationsByAssetId(assetId: string): Promise<ReadonlyArray<AssetTransformation>> {
    const rows = this.getDatabase().prepare(`
      SELECT DISTINCT t.transformation_json
      FROM asset_transformations t
      JOIN asset_transformation_versions tv ON tv.transformation_id = t.transformation_id
      JOIN asset_versions v ON v.version_id = tv.version_id
      WHERE v.asset_id = ?
      ORDER BY t.created_at DESC
    `).all(assetId.trim()) as TransformationRow[];

    return Object.freeze(rows.map((row) => this.parseTransformation(row.transformation_json)));
  }

  public async listLineageEdgesByAssetId(assetId: string): Promise<ReadonlyArray<AssetLineageEdge>> {
    const rows = this.getDatabase().prepare(`
      SELECT DISTINCT e.edge_json
      FROM asset_lineage_edges e
      JOIN asset_versions v ON v.version_id = e.from_version_id OR v.version_id = e.to_version_id
      WHERE v.asset_id = ?
      ORDER BY e.created_at DESC
    `).all(assetId.trim()) as LineageRow[];

    return Object.freeze(rows.map((row) => this.parseLineageEdge(row.edge_json)));
  }

  public async listAdjacentVersionIds(versionId: string, direction: AssetLineageDirection): Promise<ReadonlyArray<string>> {
    const normalized = versionId.trim();
    if (direction === "both") {
      const [upstream, downstream] = await Promise.all([
        this.listAdjacentVersionIds(normalized, "upstream"),
        this.listAdjacentVersionIds(normalized, "downstream"),
      ]);
      return Object.freeze([...new Set([...upstream, ...downstream])]);
    }

    const rows = direction === "upstream"
      ? this.getDatabase().prepare("SELECT from_version_id AS version_id FROM asset_lineage_edges WHERE to_version_id = ? ORDER BY created_at DESC").all(normalized) as Array<{ version_id: string }>
      : this.getDatabase().prepare("SELECT to_version_id AS version_id FROM asset_lineage_edges WHERE from_version_id = ? ORDER BY created_at DESC").all(normalized) as Array<{ version_id: string }>;
    return Object.freeze([...new Set(rows.map((row) => row.version_id))]);
  }

  public async upsertIdentity(record: { readonly entityType: CanonicalEntityType; readonly entityId: string; readonly assetId: string; readonly latestVersionId?: string; readonly taxonomy?: CanonicalAssetIdentityRecord["taxonomy"]; readonly updatedAt?: Date; }): Promise<void> {
    this.assertAssetExists(record.assetId);
    if (record.latestVersionId) {
      this.assertVersionExists(record.latestVersionId);
    }

    this.getDatabase().prepare(`
      INSERT INTO canonical_asset_identities (entity_type, entity_id, asset_id, latest_version_id, structural_kind, semantic_role, behavior_kind, updated_at)
      VALUES (@entityType, @entityId, @assetId, @latestVersionId, @structuralKind, @semanticRole, @behaviorKind, @updatedAt)
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET
        asset_id = excluded.asset_id,
        latest_version_id = excluded.latest_version_id,
        structural_kind = excluded.structural_kind,
        semantic_role = excluded.semantic_role,
        behavior_kind = excluded.behavior_kind,
        updated_at = excluded.updated_at
    `).run({
      entityType: record.entityType,
      entityId: record.entityId.trim(),
      assetId: record.assetId.trim(),
      latestVersionId: record.latestVersionId,
      structuralKind: record.taxonomy?.structuralKind,
      semanticRole: record.taxonomy?.semanticRole,
      behaviorKind: record.taxonomy?.behaviorKind,
      updatedAt: (record.updatedAt ?? new Date()).toISOString(),
    });
  }

  public async getIdentity(entityType: CanonicalEntityType, entityId: string): Promise<CanonicalAssetIdentityRecord | undefined> {
    const row = this.getDatabase().prepare(`
      SELECT entity_type, entity_id, asset_id, latest_version_id, structural_kind, semantic_role, behavior_kind, updated_at
      FROM canonical_asset_identities
      WHERE entity_type = ? AND entity_id = ?
    `).get(entityType, entityId.trim()) as IdentityRow | undefined;

    if (!row) {
      return undefined;
    }

    return Object.freeze({
      entityType: row.entity_type,
      entityId: row.entity_id,
      assetId: row.asset_id,
      latestVersionId: row.latest_version_id ?? undefined,
      taxonomy: parseIdentityTaxonomy(row),
      updatedAt: new Date(row.updated_at),
    });
  }

  public async listCanonicalIdentities(params?: { readonly entityType?: CanonicalEntityType; readonly assetId?: string }): Promise<ReadonlyArray<CanonicalAssetIdentityRecord>> {
    const where: string[] = [];
    const bind: Record<string, unknown> = {};
    if (params?.entityType) {
      where.push("entity_type = @entityType");
      bind.entityType = params.entityType;
    }
    if (params?.assetId) {
      where.push("asset_id = @assetId");
      bind.assetId = params.assetId.trim();
    }

    const sql = `
      SELECT entity_type, entity_id, asset_id, latest_version_id, structural_kind, semantic_role, behavior_kind, updated_at
      FROM canonical_asset_identities
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY updated_at DESC, entity_type ASC, entity_id ASC
    `;
    const rows = this.getDatabase().prepare(sql).all(bind) as IdentityRow[];
    return Object.freeze(rows.map((row) => Object.freeze({
      entityType: row.entity_type,
      entityId: row.entity_id,
      assetId: row.asset_id,
      latestVersionId: row.latest_version_id ?? undefined,
      taxonomy: parseIdentityTaxonomy(row),
      updatedAt: new Date(row.updated_at),
    })));
  }

  public async saveDependencyState(record: {
    readonly versionId: string;
    readonly summary: CanonicalDependencyStateSummary;
    readonly computedAt: Date;
  }): Promise<void> {
    this.assertVersionExists(record.versionId);
    this.getDatabase().prepare(`
      INSERT INTO canonical_dependency_state (version_id, state, lineage_confidence, computed_at, summary_json)
      VALUES (@versionId, @state, @lineageConfidence, @computedAt, @summaryJson)
      ON CONFLICT(version_id) DO UPDATE SET
        state = excluded.state,
        lineage_confidence = excluded.lineage_confidence,
        computed_at = excluded.computed_at,
        summary_json = excluded.summary_json
    `).run({
      versionId: record.versionId.trim(),
      state: record.summary.state,
      lineageConfidence: record.summary.lineageConfidence,
      computedAt: record.computedAt.toISOString(),
      summaryJson: JSON.stringify(record.summary),
    });
  }

  public async getDependencyState(versionId: string): Promise<{ readonly versionId: string; readonly summary: CanonicalDependencyStateSummary; readonly computedAt: Date; } | undefined> {
    const row = this.getDatabase().prepare(`
      SELECT version_id, summary_json, computed_at
      FROM canonical_dependency_state
      WHERE version_id = ?
    `).get(versionId.trim()) as DependencyStateRow | undefined;
    if (!row) {
      return undefined;
    }
    return Object.freeze({
      versionId: row.version_id,
      summary: this.parseDependencyState(row.summary_json),
      computedAt: new Date(row.computed_at),
    });
  }

  public async loadProjection(): Promise<RegistryGraphProjectionSnapshot | undefined> {
    const state = await this.getProjectionState();
    if (!state?.computedAt) {
      return undefined;
    }

    const nodes = this.getDatabase()
      .prepare("SELECT node_json FROM registry_dependency_projection_nodes ORDER BY updated_at DESC, version_id ASC")
      .all() as RegistryGraphProjectionRow[];
    const edges = this.getDatabase()
      .prepare("SELECT edge_json FROM registry_dependency_projection_edges ORDER BY updated_at DESC, edge_key ASC")
      .all() as RegistryGraphProjectionRow[];

    return Object.freeze({
      nodes: Object.freeze(
        nodes
          .map((row) => row.node_json)
          .filter((row): row is string => typeof row === "string")
          .map((row) => Object.freeze(JSON.parse(row))),
      ),
      edges: Object.freeze(
        edges
          .map((row) => row.edge_json)
          .filter((row): row is string => typeof row === "string")
          .map((row) => Object.freeze(JSON.parse(row))),
      ),
      computedAt: state.computedAt,
      sourceSignature: state.sourceSignature,
    });
  }

  public async saveProjection(snapshot: RegistryGraphProjectionSnapshot): Promise<void> {
    const db = this.getDatabase();
    const computedAt = snapshot.computedAt.toISOString();
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM registry_dependency_projection_nodes").run();
      db.prepare("DELETE FROM registry_dependency_projection_edges").run();

      const insertNode = db.prepare(`
        INSERT INTO registry_dependency_projection_nodes (
          version_id, asset_id, name, kind, status, structural_kind, semantic_role, behavior_kind, is_registry_projected, updated_at, node_json
        ) VALUES (
          @versionId, @assetId, @name, @kind, @status, @structuralKind, @semanticRole, @behaviorKind, @isRegistryProjected, @updatedAt, @nodeJson
        )
      `);
      for (const node of snapshot.nodes) {
        insertNode.run({
          versionId: node.versionId,
          assetId: node.assetId,
          name: node.name,
          kind: node.kind,
          status: node.status,
          structuralKind: node.taxonomy?.structuralKind,
          semanticRole: node.taxonomy?.semanticRole,
          behaviorKind: node.taxonomy?.behaviorKind,
          isRegistryProjected: node.isRegistryProjected ? 1 : 0,
          updatedAt: computedAt,
          nodeJson: JSON.stringify(node),
        });
      }

      const insertEdge = db.prepare(`
        INSERT INTO registry_dependency_projection_edges (
          edge_key, from_version_id, to_version_id, from_asset_id, to_asset_id, source, relationship_type, updated_at, edge_json
        ) VALUES (
          @edgeKey, @fromVersionId, @toVersionId, @fromAssetId, @toAssetId, @source, @relationshipType, @updatedAt, @edgeJson
        )
      `);
      for (const edge of snapshot.edges) {
        const edgeKey = `${edge.fromVersionId}->${edge.toVersionId}:${edge.source}:${edge.relationshipType ?? ""}`;
        insertEdge.run({
          edgeKey,
          fromVersionId: edge.fromVersionId,
          toVersionId: edge.toVersionId,
          fromAssetId: edge.fromAssetId,
          toAssetId: edge.toAssetId,
          source: edge.source,
          relationshipType: edge.relationshipType,
          updatedAt: computedAt,
          edgeJson: JSON.stringify(edge),
        });
      }

      db.prepare(`
        INSERT INTO registry_dependency_projection_state (
          projection_id, is_dirty, computed_at, source_version_count, source_lineage_edge_count, updated_at
        ) VALUES (
          'default', 0, @computedAt, @sourceVersionCount, @sourceLineageEdgeCount, @updatedAt
        )
        ON CONFLICT(projection_id) DO UPDATE SET
          is_dirty = excluded.is_dirty,
          computed_at = excluded.computed_at,
          source_version_count = excluded.source_version_count,
          source_lineage_edge_count = excluded.source_lineage_edge_count,
          updated_at = excluded.updated_at
      `).run({
        computedAt,
        sourceVersionCount: snapshot.sourceSignature?.versionCount ?? null,
        sourceLineageEdgeCount: snapshot.sourceSignature?.lineageEdgeCount ?? null,
        updatedAt: computedAt,
      });
    });

    transaction();
  }

  public async markProjectionDirty(): Promise<void> {
    const updatedAt = new Date().toISOString();
    this.getDatabase().prepare(`
      INSERT INTO registry_dependency_projection_state (
        projection_id, is_dirty, computed_at, source_version_count, source_lineage_edge_count, updated_at
      ) VALUES (
        'default', 1, NULL, NULL, NULL, @updatedAt
      )
      ON CONFLICT(projection_id) DO UPDATE SET
        is_dirty = 1,
        updated_at = excluded.updated_at
    `).run({ updatedAt });
  }

  public async getProjectionState(): Promise<RegistryGraphProjectionState | undefined> {
    const row = this.getDatabase().prepare(`
      SELECT is_dirty, computed_at, source_version_count, source_lineage_edge_count
      FROM registry_dependency_projection_state
      WHERE projection_id = 'default'
    `).get() as RegistryGraphProjectionStateRow | undefined;

    if (!row) {
      return undefined;
    }

    return Object.freeze({
      dirty: row.is_dirty === 1,
      computedAt: row.computed_at ? new Date(row.computed_at) : undefined,
      sourceSignature:
        typeof row.source_version_count === "number" && typeof row.source_lineage_edge_count === "number"
          ? Object.freeze({
            versionCount: row.source_version_count,
            lineageEdgeCount: row.source_lineage_edge_count,
          })
          : undefined,
    });
  }

  public async getCurrentSourceSignature(): Promise<{ readonly versionCount: number; readonly lineageEdgeCount: number; }> {
    const versions = this.getDatabase().prepare("SELECT COUNT(*) AS count FROM asset_versions").get() as { count: number };
    const edges = this.getDatabase().prepare("SELECT COUNT(*) AS count FROM asset_lineage_edges").get() as { count: number };
    return Object.freeze({
      versionCount: versions.count,
      lineageEdgeCount: edges.count,
    });
  }

  public get isAvailable(): boolean {
    try {
      const probe = new Database(":memory:");
      probe.close();
      return true;
    } catch {
      return false;
    }
  }
  private getDatabase(): Database.Database {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = new Database(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      const db = this.database;
      db.exec("CREATE TABLE IF NOT EXISTS asset_system_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
      const applied = new Set((db.prepare("SELECT version FROM asset_system_migrations").all() as Array<{ version: number }>).map((row) => row.version));

      for (const [version, sql] of MIGRATIONS) {
        if (applied.has(version)) {
          continue;
        }

        const transaction = db.transaction(() => {
          db.exec(sql);
          db.prepare("INSERT INTO asset_system_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
        });
        transaction();
      }

      const latestVersion = (db.prepare("SELECT MAX(version) AS version FROM asset_system_migrations").get() as { version?: number } | undefined)?.version ?? 0;
      if (latestVersion < SCHEMA_VERSION) {
        throw new Error(`Asset system schema expected version ${SCHEMA_VERSION} but found ${latestVersion}.`);
      }

      this.initialized = true;
    }

    return this.database;
  }

  private assertAssetExists(assetId: string): void {
    const exists = this.getDatabase().prepare("SELECT asset_id FROM assets WHERE asset_id = ?").get(assetId) as { asset_id: string } | undefined;
    if (!exists) {
      throw new Error(`Asset '${assetId}' was not found before saving version metadata.`);
    }
  }

  private assertVersionExists(versionId: string): void {
    const exists = this.getDatabase().prepare("SELECT version_id FROM asset_versions WHERE version_id = ?").get(versionId) as { version_id: string } | undefined;
    if (!exists) {
      throw new Error(`Asset version '${versionId}' was not found.`);
    }
  }

  private parseAsset(json: string): IAsset {
    const parsed = JSON.parse(json) as IAsset;
    return new Asset({
      ...parsed,
      source: new AssetSourceInfo(parsed.source),
      location: new AssetLocation(parsed.location),
      technicalMetadata: parsed.technicalMetadata ? new AssetTechnicalMetadata(parsed.technicalMetadata) : undefined,
      semanticMetadata: parsed.semanticMetadata ? new AssetSemanticMetadata(parsed.semanticMetadata) : undefined,
      audit: parsed.audit ? new AssetAuditInfo({
        createdAt: parsed.audit.createdAt ? new Date(parsed.audit.createdAt) : undefined,
        updatedAt: parsed.audit.updatedAt ? new Date(parsed.audit.updatedAt) : undefined,
      }) : undefined,
    });
  }

  private parseVersion(row: AssetVersionRow): AssetVersion {
    const parsed = JSON.parse(row.version_json) as {
      readonly assetId: { readonly value: string } | string;
      readonly versionId: string;
      readonly versionLabel?: string;
      readonly parentVersionId?: string;
      readonly createdAt: string;
      readonly createdBy?: string;
      readonly contentSha256?: string;
      readonly contentLengthBytes?: number;
      readonly upstreamVersionIds?: ReadonlyArray<string>;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly reproducibilitySummary?: Readonly<Record<string, unknown>>;
    };

    return new AssetVersion({
      assetId: typeof parsed.assetId === "string" ? parsed.assetId : parsed.assetId.value,
      versionId: parsed.versionId,
      versionLabel: parsed.versionLabel ?? row.version_label ?? undefined,
      parentVersionId: parsed.parentVersionId ?? row.parent_version_id ?? undefined,
      createdAt: new Date(parsed.createdAt),
      createdBy: parsed.createdBy,
      contentSha256: parsed.contentSha256,
      contentLengthBytes: parsed.contentLengthBytes,
      upstreamVersionIds: parsed.upstreamVersionIds,
      metadata: parsed.metadata,
      reproducibilitySummary: parsed.reproducibilitySummary,
    });
  }

  private parseLineageEdge(json: string): AssetLineageEdge {
    const parsed = JSON.parse(json) as {
      readonly edgeId: string;
      readonly fromVersionId: string;
      readonly toVersionId: string;
      readonly type?: string;
      readonly kind?: string;
      readonly transformationId?: string;
      readonly createdAt: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    };

    return new AssetLineageEdge({
      edgeId: parsed.edgeId,
      fromVersionId: parsed.fromVersionId,
      toVersionId: parsed.toVersionId,
      type: parsed.type ?? parsed.kind ?? "TRANSFORMED_FROM",
      transformationId: parsed.transformationId,
      createdAt: new Date(parsed.createdAt),
      metadata: parsed.metadata,
    });
  }

  private parseTransformation(json: string): AssetTransformation {
    const parsed = JSON.parse(json) as {
      readonly transformationId: string;
      readonly transformationType?: string;
      readonly kind?: string;
      readonly status: "queued" | "running" | "completed" | "failed" | "cancelled" | "success" | "partial" | "degraded";
      readonly inputVersionIds: ReadonlyArray<string>;
      readonly outputVersionIds: ReadonlyArray<string>;
      readonly workflowId?: string;
      readonly nodeId?: string;
      readonly executionId?: string;
      readonly runtime?: string;
      readonly provider?: string;
      readonly modelId?: string;
      readonly diagnostics?: Readonly<Record<string, unknown>>;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly startedAt?: string;
      readonly completedAt?: string;
      readonly createdAt: string;
    };

    return new AssetTransformation({
      transformationId: parsed.transformationId,
      transformationType: parsed.transformationType ?? parsed.kind ?? "unknown",
      status: parsed.status,
      inputVersionIds: parsed.inputVersionIds,
      outputVersionIds: parsed.outputVersionIds,
      workflowId: parsed.workflowId,
      nodeId: parsed.nodeId,
      executionId: parsed.executionId,
      runtime: parsed.runtime,
      provider: parsed.provider,
      modelId: parsed.modelId,
      diagnostics: parsed.diagnostics,
      metadata: parsed.metadata,
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      createdAt: new Date(parsed.createdAt),
    });
  }

  private parseDependencyState(json: string): CanonicalDependencyStateSummary {
    const parsed = JSON.parse(json) as CanonicalDependencyStateSummary & {
      readonly lifecycle?: {
        readonly source: "persisted-fresh" | "recomputed";
        readonly computedAt: string | Date;
        readonly reason: string;
      };
    };
    const lifecycle = parsed.lifecycle
      ? Object.freeze({
        source: parsed.lifecycle.source,
        computedAt: parsed.lifecycle.computedAt instanceof Date
          ? parsed.lifecycle.computedAt
          : new Date(parsed.lifecycle.computedAt),
        reason: parsed.lifecycle.reason,
      })
      : Object.freeze({
        source: "recomputed" as const,
        computedAt: new Date(),
        reason: "Lifecycle metadata was unavailable in persisted dependency-state summary.",
      });
    return Object.freeze({
      ...parsed,
      lifecycle,
      reasons: Object.freeze([...(parsed.reasons ?? [])]),
      impactedByUpstreamVersionIds: Object.freeze([...(parsed.impactedByUpstreamVersionIds ?? [])]),
      staleBecauseUpstreamAdvanced: Object.freeze([...(parsed.staleBecauseUpstreamAdvanced ?? [])]),
      nextActions: Object.freeze([...(parsed.nextActions ?? [])]),
    });
  }
}
