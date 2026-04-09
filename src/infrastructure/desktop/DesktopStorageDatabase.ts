import fs from "node:fs";
import path from "node:path";
import {
  type SqliteCompatDatabase,
  openSqliteCompatDatabase,
} from "../persistence/sqlite/SqliteCompat";
import type { IProductionStorageInitializer } from "@application/runtime/interfaces/IProductionStorageInitializer";
import type { DesktopStoragePaths } from "../../../electron/shared/DesktopContracts";

interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
}

const MIGRATIONS: ReadonlyArray<MigrationDefinition> = Object.freeze([
  {
    version: 1,
    name: "create-key-value-state",
    statements: [
      `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS persistent_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      `,
    ],
  },
]);

export interface DesktopStorageDatabaseOptions {
  readonly paths: DesktopStoragePaths;
}

export class DesktopStorageDatabase implements IProductionStorageInitializer {
  private readonly databasePath: string;
  private database?: SqliteCompatDatabase;

  constructor(private readonly options: DesktopStorageDatabaseOptions) {
    this.databasePath = options.paths.databasePath;
  }

  public initialize(): Promise<{
    appDataDirectory: string;
    storageDirectory: string;
    databasePath: string;
    createdDirectories: ReadonlyArray<string>;
    appliedMigrations: ReadonlyArray<string>;
  }> {
    const createdDirectories = this.ensureDirectories();
    const db = this.getDatabase();
    const appliedMigrations = this.applyMigrations(db);

    return Promise.resolve({
      appDataDirectory: this.options.paths.appDataDirectory,
      storageDirectory: this.options.paths.storageDirectory,
      databasePath: this.databasePath,
      createdDirectories,
      appliedMigrations,
    });
  }

  public getItem(key: string): string | null {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new Error("Desktop storage key cannot be empty.");
    }

    const row = this.getDatabase()
      .prepare("SELECT value FROM persistent_state WHERE key = ?")
      .get(normalizedKey) as { value: string } | undefined;

    return row?.value ?? null;
  }

  public setItem(key: string, value: string): void {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new Error("Desktop storage key cannot be empty.");
    }

    const timestamp = new Date().toISOString();
    this.getDatabase()
      .prepare(
        `
        INSERT INTO persistent_state (key, value, created_at, updated_at)
        VALUES (@key, @value, @timestamp, @timestamp)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
        `,
      )
      .run({ key: normalizedKey, value, timestamp });
  }

  public removeItem(key: string): void {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }

    this.getDatabase()
      .prepare("DELETE FROM persistent_state WHERE key = ?")
      .run(normalizedKey);
  }

  public dispose(): void {
    this.database?.close();
    this.database = undefined;
  }

  private ensureDirectories(): ReadonlyArray<string> {
    const directories = [
      this.options.paths.appDataDirectory,
      this.options.paths.storageDirectory,
      this.options.paths.runtimeDirectory,
      this.options.paths.logsDirectory,
      this.options.paths.modelsDirectory,
      this.options.paths.assetsDirectory,
    ];

    const created: string[] = [];
    for (const directory of directories) {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        created.push(directory);
      }
    }

    return Object.freeze(created);
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

  private applyMigrations(db: SqliteCompatDatabase): ReadonlyArray<string> {
    this.ensureMigrationTable(db);
    const applied = new Set(
      (db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all() as Array<{ version: number }>)
        .map((row) => row.version),
    );
    const appliedNames: string[] = [];

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) {
        continue;
      }

      const transaction = db.transaction(() => {
        for (const statement of migration.statements) {
          db.exec(statement);
        }

        db.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        ).run(migration.version, migration.name, new Date().toISOString());
      });

      transaction();
      appliedNames.push(migration.name);
    }

    return Object.freeze(appliedNames);
  }

  private ensureMigrationTable(db: SqliteCompatDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }
}

