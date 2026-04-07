import fs from "node:fs";
import path from "node:path";
import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import { AssetVersion } from "../../../src/domain/assets/AssetVersion";
import {
  AssetDraftLifecycleStatuses,
  AssetSessionStatuses,
  StudioLifecycleStatuses,
  createAssetDraft,
  createAssetSession,
  createStudio,
  normalizeAssetMetadata,
  type AssetDraft,
  type AssetDraftLifecycleStatus,
  type AssetSession,
  type Studio,
} from "../../../src/domain/studio-shell/StudioShellDomain";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";

interface SnapshotRow {
  readonly snapshot_json: string;
}

const SCHEMA_VERSION = 1;
const MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS studio_shell_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_shell_studios (
      studio_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_shell_sessions (
      session_id TEXT PRIMARY KEY,
      studio_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS studio_shell_sessions_studio_updated_idx
      ON studio_shell_sessions(studio_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS studio_shell_drafts (
      draft_id TEXT PRIMARY KEY,
      studio_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      lifecycle_status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS studio_shell_drafts_session_updated_idx
      ON studio_shell_drafts(session_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS studio_shell_drafts_studio_updated_idx
      ON studio_shell_drafts(studio_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS studio_shell_asset_versions (
      version_id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS studio_shell_asset_versions_asset_created_idx
      ON studio_shell_asset_versions(asset_id, created_at ASC);
  `],
]);

export class SqliteStudioShellRepository implements IStudioShellRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;

  constructor(private readonly databasePath: string) {}

  public async saveStudio(studio: Studio): Promise<Studio> {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_shell_studios (
          studio_id,
          name,
          status,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(studio_id) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        studio.id,
        studio.name,
        studio.status,
        studio.updatedAt,
        JSON.stringify(studio),
      );

    return studio;
  }

  public async getStudio(studioId: string): Promise<Studio | undefined> {
    const normalized = studioId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_studios WHERE studio_id = ?")
      .get(normalized) as SnapshotRow | undefined;

    return row ? this.rehydrateStudio(row.snapshot_json) : undefined;
  }

  public async saveSession(session: AssetSession): Promise<AssetSession> {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_shell_sessions (
          session_id,
          studio_id,
          status,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          studio_id = excluded.studio_id,
          status = excluded.status,
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        session.id,
        session.studioId,
        session.status,
        session.updatedAt,
        JSON.stringify(session),
      );

    return session;
  }

  public async getSession(sessionId: string): Promise<AssetSession | undefined> {
    const normalized = sessionId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_sessions WHERE session_id = ?")
      .get(normalized) as SnapshotRow | undefined;

    return row ? this.rehydrateSession(row.snapshot_json) : undefined;
  }

  public async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> {
    const normalized = studioId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_sessions WHERE studio_id = ? ORDER BY updated_at DESC")
      .all(normalized) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.rehydrateSession(row.snapshot_json)));
  }

  public async saveDraft(draft: AssetDraft): Promise<AssetDraft> {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_shell_drafts (
          draft_id,
          studio_id,
          session_id,
          asset_id,
          lifecycle_status,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(draft_id) DO UPDATE SET
          studio_id = excluded.studio_id,
          session_id = excluded.session_id,
          asset_id = excluded.asset_id,
          lifecycle_status = excluded.lifecycle_status,
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        draft.id,
        draft.studioId,
        draft.sessionId,
        draft.assetId,
        draft.lifecycleStatus,
        draft.updatedAt,
        JSON.stringify(draft),
      );

    return draft;
  }

  public async getDraft(draftId: string): Promise<AssetDraft | undefined> {
    const normalized = draftId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_drafts WHERE draft_id = ?")
      .get(normalized) as SnapshotRow | undefined;

    return row ? this.rehydrateDraft(row.snapshot_json) : undefined;
  }

  public async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> {
    const normalized = sessionId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_drafts WHERE session_id = ? ORDER BY updated_at DESC")
      .all(normalized) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.rehydrateDraft(row.snapshot_json)));
  }

  public async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> {
    this.getDatabase()
      .prepare(`
        INSERT INTO studio_shell_asset_versions (
          version_id,
          asset_id,
          created_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(version_id) DO UPDATE SET
          asset_id = excluded.asset_id,
          created_at = excluded.created_at,
          snapshot_json = excluded.snapshot_json
      `)
      .run(
        version.versionId,
        version.assetId.value,
        version.createdAt.toISOString(),
        JSON.stringify(version),
      );

    return version;
  }

  public async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> {
    const normalized = versionId.trim();
    if (!normalized) {
      return undefined;
    }

    const row = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_asset_versions WHERE version_id = ?")
      .get(normalized) as SnapshotRow | undefined;

    return row ? this.rehydrateAssetVersion(row.snapshot_json) : undefined;
  }

  public async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    const normalized = assetId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    const rows = this.getDatabase()
      .prepare("SELECT snapshot_json FROM studio_shell_asset_versions WHERE asset_id = ? ORDER BY created_at ASC")
      .all(normalized) as SnapshotRow[];

    return Object.freeze(rows.map((row) => this.rehydrateAssetVersion(row.snapshot_json)));
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
    }
    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }
    return this.database;
  }

  private initialize(db: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(db);
    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(
        `Studio shell repository schema version ${currentVersion} is newer than supported schema version ${SCHEMA_VERSION}.`,
      );
    }

    for (const [version, migrationSql] of MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }
      db.transaction(() => {
        db.exec(migrationSql);
        db.prepare("INSERT INTO studio_shell_repository_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(db: SqliteCompatDatabase): number {
    db.exec(`
      CREATE TABLE IF NOT EXISTS studio_shell_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT MAX(version) AS version FROM studio_shell_repository_migrations")
      .get() as { version?: number } | undefined;
    return typeof row?.version === "number" ? row.version : 0;
  }

  private rehydrateStudio(snapshotJson: string): Studio {
    const raw = parseObject(snapshotJson, "Persisted studio shell studio");
    const base = createStudio({
      id: assertString(raw.id, "Persisted studio id"),
      name: assertString(raw.name, "Persisted studio name"),
      status: assertStudioStatus(raw.status),
      now: parseDate(assertString(raw.createdAt, "Persisted studio createdAt"), "Persisted studio createdAt"),
    });

    return Object.freeze({
      ...base,
      activeSessionId: optionalString(raw.activeSessionId),
      updatedAt: normalizeIsoTimestamp(raw.updatedAt, "Persisted studio updatedAt"),
    });
  }

  private rehydrateSession(snapshotJson: string): AssetSession {
    const raw = parseObject(snapshotJson, "Persisted studio shell session");
    const base = createAssetSession({
      id: assertString(raw.id, "Persisted session id"),
      studioId: assertString(raw.studioId, "Persisted session studioId"),
      status: assertSessionStatus(raw.status),
      now: parseDate(assertString(raw.openedAt, "Persisted session openedAt"), "Persisted session openedAt"),
    });
    const draftIds = freezeStringList(raw.draftIds, "Persisted session draftIds");
    const currentDraftId = optionalString(raw.currentDraftId);

    if (currentDraftId && !draftIds.includes(currentDraftId)) {
      throw new Error(`Persisted session currentDraftId '${currentDraftId}' is not listed in draftIds.`);
    }

    return Object.freeze({
      ...base,
      draftIds,
      currentDraftId,
      updatedAt: normalizeIsoTimestamp(raw.updatedAt, "Persisted session updatedAt"),
      closedAt: optionalIsoTimestamp(raw.closedAt, "Persisted session closedAt"),
    });
  }

  private rehydrateDraft(snapshotJson: string): AssetDraft {
    const raw = parseObject(snapshotJson, "Persisted studio shell draft");
    const studioId = assertString(raw.studioId, "Persisted draft studioId");
    const sessionId = assertString(raw.sessionId, "Persisted draft sessionId");
    const seedSession = createAssetSession({
      id: sessionId,
      studioId,
      status: AssetSessionStatuses.active,
      now: parseDate(assertString(raw.createdAt, "Persisted draft createdAt"), "Persisted draft createdAt"),
    });
    const seedDraft = createAssetDraft({
      id: assertString(raw.id, "Persisted draft id"),
      assetId: assertString(raw.assetId, "Persisted draft assetId"),
      studioId,
      session: seedSession,
      content: assertString(raw.content, "Persisted draft content"),
      metadata: normalizeAssetMetadata(assertObject(raw.metadata, "Persisted draft metadata") as AssetDraft["metadata"]),
      dependencies: freezeDependencyList(raw.dependencies),
      now: parseDate(assertString(raw.createdAt, "Persisted draft createdAt"), "Persisted draft createdAt"),
    });

    const lifecycleStatus = assertDraftLifecycleStatus(raw.lifecycleStatus);
    const revision = assertPositiveInteger(raw.revision, "Persisted draft revision");
    const publishedVersionIds = freezeStringList(raw.publishedVersionIds, "Persisted draft publishedVersionIds");
    const lastPublishedVersionId = optionalString(raw.lastPublishedVersionId);

    if (lastPublishedVersionId && !publishedVersionIds.includes(lastPublishedVersionId)) {
      throw new Error(`Persisted draft lastPublishedVersionId '${lastPublishedVersionId}' is not listed in publishedVersionIds.`);
    }

    return Object.freeze({
      ...seedDraft,
      lifecycleStatus,
      revision,
      createdAt: normalizeIsoTimestamp(raw.createdAt, "Persisted draft createdAt"),
      updatedAt: normalizeIsoTimestamp(raw.updatedAt, "Persisted draft updatedAt"),
      publishedVersionIds,
      lastPublishedVersionId,
    });
  }

  private rehydrateAssetVersion(snapshotJson: string): AssetVersion {
    const raw = parseObject(snapshotJson, "Persisted studio shell asset version");
    const createdAt = parseDate(assertString(raw.createdAt, "Persisted asset version createdAt"), "Persisted asset version createdAt");

    return new AssetVersion({
      assetId: resolvePersistedAssetId(raw.assetId),
      versionId: assertString(raw.versionId, "Persisted asset version versionId"),
      versionLabel: optionalString(raw.versionLabel),
      parentVersionId: optionalString(raw.parentVersionId),
      createdBy: optionalString(raw.createdBy),
      createdAt,
      upstreamVersionIds: freezeStringList(raw.upstreamVersionIds, "Persisted asset version upstreamVersionIds"),
      metadata: assertObject(raw.metadata, "Persisted asset version metadata"),
    });
  }
}

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${label} is malformed.`);
  }
  return parsed as Record<string, unknown>;
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} is required.`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseDate(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} '${value}' is invalid.`);
  }
  return parsed;
}

function normalizeIsoTimestamp(value: unknown, label: string): string {
  const normalized = assertString(value, label);
  parseDate(normalized, label);
  return normalized;
}

function optionalIsoTimestamp(value: unknown, label: string): string | undefined {
  const normalized = optionalString(value);
  if (!normalized) {
    return undefined;
  }
  parseDate(normalized, label);
  return normalized;
}

function assertStudioStatus(value: unknown): Studio["status"] {
  if (value === StudioLifecycleStatuses.active || value === StudioLifecycleStatuses.archived || value === StudioLifecycleStatuses.draft) {
    return value;
  }
  throw new Error(`Persisted studio status '${String(value)}' is invalid.`);
}

function assertSessionStatus(value: unknown): AssetSession["status"] {
  if (value === AssetSessionStatuses.active || value === AssetSessionStatuses.paused || value === AssetSessionStatuses.closed) {
    return value;
  }
  throw new Error(`Persisted session status '${String(value)}' is invalid.`);
}

function assertDraftLifecycleStatus(value: unknown): AssetDraftLifecycleStatus {
  if (value === AssetDraftLifecycleStatuses.draft || value === AssetDraftLifecycleStatuses.validated || value === AssetDraftLifecycleStatuses.published) {
    return value;
  }
  throw new Error(`Persisted draft lifecycle status '${String(value)}' is invalid.`);
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function freezeStringList(value: unknown, label: string): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is required.`);
  }
  const deduped = new Set<string>();
  for (const entry of value) {
    deduped.add(assertString(entry, label));
  }
  return Object.freeze([...deduped]);
}


function resolvePersistedAssetId(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }
  if (value && typeof value === "object" && "value" in value) {
    const nested = (value as { readonly value?: unknown }).value;
    if (typeof nested === "string") {
      const normalized = nested.trim();
      if (normalized) {
        return normalized;
      }
    }
  }
  throw new Error("Persisted asset version assetId is required.");
}

function freezeDependencyList(value: unknown): AssetDraft["dependencies"] {
  if (!Array.isArray(value)) {
    throw new Error("Persisted draft dependencies are required.");
  }

  const deduped = new Map<string, AssetDraft["dependencies"][number]>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Persisted draft dependency is malformed.");
    }

    const snapshot = entry as { readonly assetId?: unknown; readonly versionId?: unknown };
    const assetId = assertString(snapshot.assetId, "Persisted draft dependency assetId");
    const versionId = optionalString(snapshot.versionId);
    deduped.set(`${assetId}::${versionId ?? ""}`, Object.freeze({ assetId, versionId }));
  }

  return Object.freeze([...deduped.values()]);
}
