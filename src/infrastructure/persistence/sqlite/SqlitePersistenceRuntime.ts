import fs from "node:fs";
import path from "node:path";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "./SqliteCompat";

export const SqlitePersistenceEnvironmentKeys = Object.freeze({
  databasePath: "AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH",
  journalMode: "AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE",
  foreignKeys: "AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS",
});

export interface SqlitePersistenceRuntimePragmas {
  readonly journalMode: string;
  readonly foreignKeys: boolean;
}

export interface SqlitePersistenceRuntimeConfiguration {
  readonly databasePath: string;
  readonly pragmas: SqlitePersistenceRuntimePragmas;
}

export interface SqlitePersistenceMigrationHook {
  readonly migrationId: string;
  readonly checksum: string;
  apply(database: SqliteCompatDatabase): void;
}

export interface SqlitePersistenceRuntimeOptions {
  readonly configuration: SqlitePersistenceRuntimeConfiguration;
  readonly migrationHooks?: ReadonlyArray<SqlitePersistenceMigrationHook>;
  readonly openDatabase?: (databasePath: string) => SqliteCompatDatabase;
  readonly now?: () => Date;
}

export interface SqlitePersistenceBootstrapResult {
  readonly databasePath: string;
  readonly migrationIdsApplied: ReadonlyArray<string>;
}

export interface SqlitePersistenceRuntime {
  readonly configuration: SqlitePersistenceRuntimeConfiguration;
  start(): Promise<SqlitePersistenceBootstrapResult>;
  getConnection(): SqliteCompatDatabase;
  dispose(): Promise<void>;
}

const BootstrapMetadataTableName = "platform_persistence_bootstrap_metadata";
const BootstrapMigrationsTableName = "platform_persistence_bootstrap_migrations";
const BootstrapVersionMetadataKey = "bootstrap-version";
const BootstrapVersion = "1";

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new Error(`Invalid boolean value '${value}'. Use true/false or 1/0.`);
}

function normalizeJournalMode(value: string | undefined, fallback: string): string {
  const normalized = normalizeOptional(value)?.toUpperCase();
  return normalized ?? fallback;
}

export function resolveSqlitePersistenceRuntimeConfiguration(input: {
  readonly databasePath?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fallbackDatabasePath?: string;
  readonly fallbackPragmas?: Partial<SqlitePersistenceRuntimePragmas>;
}): SqlitePersistenceRuntimeConfiguration {
  const environment = input.environment ?? process.env;
  const resolvedDatabasePath = normalizeOptional(input.databasePath)
    ?? normalizeOptional(environment[SqlitePersistenceEnvironmentKeys.databasePath])
    ?? normalizeOptional(input.fallbackDatabasePath)
    ?? path.resolve("runtime-assets", "server", "authoritative-server.sqlite");
  if (!resolvedDatabasePath) {
    throw new Error("SQLite persistence databasePath could not be resolved.");
  }

  const pragmas: SqlitePersistenceRuntimePragmas = Object.freeze({
    journalMode: normalizeJournalMode(
      environment[SqlitePersistenceEnvironmentKeys.journalMode],
      input.fallbackPragmas?.journalMode ?? "WAL",
    ),
    foreignKeys: normalizeBoolean(
      environment[SqlitePersistenceEnvironmentKeys.foreignKeys],
      input.fallbackPragmas?.foreignKeys ?? true,
    ),
  });

  return Object.freeze({
    databasePath: path.resolve(resolvedDatabasePath),
    pragmas,
  });
}

class DefaultSqlitePersistenceRuntime implements SqlitePersistenceRuntime {
  private database?: SqliteCompatDatabase;
  private started = false;

  public constructor(
    public readonly configuration: SqlitePersistenceRuntimeConfiguration,
    private readonly migrationHooks: ReadonlyArray<SqlitePersistenceMigrationHook>,
    private readonly openDatabase: (databasePath: string) => SqliteCompatDatabase,
    private readonly now: () => Date,
  ) {}

  public async start(): Promise<SqlitePersistenceBootstrapResult> {
    if (this.started) {
      return Object.freeze({
        databasePath: this.configuration.databasePath,
        migrationIdsApplied: Object.freeze([]),
      });
    }

    const database = this.getConnection();
    this.ensureBootstrapTables(database);
    this.ensureBootstrapVersion(database);

    const applied: string[] = [];
    for (const hook of this.migrationHooks) {
      const migrationId = normalizeRequired(hook.migrationId, "SQLite persistence migrationId");
      const checksum = normalizeRequired(hook.checksum, `SQLite persistence migration checksum '${migrationId}'`);
      const existing = database.prepare(`
        SELECT migration_id, checksum
        FROM ${BootstrapMigrationsTableName}
        WHERE migration_id = ?
      `).get(migrationId) as { migration_id?: string; checksum?: string } | undefined;

      if (existing?.migration_id) {
        if (existing.checksum !== checksum) {
          throw new Error(
            `SQLite persistence migration '${migrationId}' checksum mismatch. Existing='${existing.checksum}', requested='${checksum}'.`,
          );
        }
        continue;
      }

      database.transaction(() => {
        hook.apply(database);
        database.prepare(`
          INSERT INTO ${BootstrapMigrationsTableName} (migration_id, checksum, applied_at)
          VALUES (?, ?, ?)
        `).run(migrationId, checksum, this.now().toISOString());
      })();
      applied.push(migrationId);
    }

    this.started = true;
    return Object.freeze({
      databasePath: this.configuration.databasePath,
      migrationIdsApplied: Object.freeze(applied),
    });
  }

  public getConnection(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.configuration.databasePath), { recursive: true });
      this.database = this.openDatabase(this.configuration.databasePath);
      this.database.pragma(`journal_mode = ${this.configuration.pragmas.journalMode}`);
      this.database.pragma(`foreign_keys = ${this.configuration.pragmas.foreignKeys ? "ON" : "OFF"}`);
    }
    return this.database;
  }

  public async dispose(): Promise<void> {
    this.database?.close();
    this.database = undefined;
    this.started = false;
  }

  private ensureBootstrapTables(database: SqliteCompatDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ${BootstrapMetadataTableName} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${BootstrapMigrationsTableName} (
        migration_id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  private ensureBootstrapVersion(database: SqliteCompatDatabase): void {
    database.prepare(`
      INSERT INTO ${BootstrapMetadataTableName} (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(
      BootstrapVersionMetadataKey,
      BootstrapVersion,
      this.now().toISOString(),
    );
  }
}

export function createSqlitePersistenceRuntime(options: SqlitePersistenceRuntimeOptions): SqlitePersistenceRuntime {
  const migrationHooks = new Map<string, SqlitePersistenceMigrationHook>();
  for (const hook of options.migrationHooks ?? []) {
    const migrationId = normalizeRequired(hook.migrationId, "SQLite persistence migrationId");
    if (migrationHooks.has(migrationId)) {
      throw new Error(`SQLite persistence migration '${migrationId}' is duplicated.`);
    }
    migrationHooks.set(migrationId, hook);
  }

  return new DefaultSqlitePersistenceRuntime(
    options.configuration,
    Object.freeze([...migrationHooks.values()]),
    options.openDatabase ?? openSqliteCompatDatabase,
    options.now ?? (() => new Date()),
  );
}
