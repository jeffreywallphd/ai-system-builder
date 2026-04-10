import { createHash } from "node:crypto";
import path from "node:path";
import type { SqliteCompatDatabase } from "./sqlite/SqliteCompat";
import type { SqlitePersistenceMigrationHook } from "./sqlite/SqlitePersistenceRuntime";
import { SqliteIdentityPersistenceAdapter } from "./identity/SqliteIdentityPersistenceAdapter";
import { SqliteTrustedDevicePersistenceAdapter } from "./identity/SqliteTrustedDevicePersistenceAdapter";
import { IDENTITY_PERSISTENCE_MIGRATIONS } from "./identity/SqliteIdentityPersistenceMigrations";
import { SqliteWorkspacePersistenceAdapter } from "./workspaces/SqliteWorkspacePersistenceAdapter";
import { WORKSPACE_PERSISTENCE_MIGRATIONS } from "./workspaces/SqliteWorkspacePersistenceMigrations";

interface VersionedMigrationSource {
  readonly domainId: string;
  readonly migrationTableName: string;
  readonly migrations: ReadonlyArray<readonly [number, string]>;
}

export interface AuthMinimalPersistentPlatformServices {
  readonly databasePath: string;
  readonly identityRepository: SqliteIdentityPersistenceAdapter;
  readonly trustedDeviceRepository: SqliteTrustedDevicePersistenceAdapter;
  readonly workspaceRepository: SqliteWorkspacePersistenceAdapter;
  dispose(): void;
}

const VersionedMigrationSources = Object.freeze<ReadonlyArray<VersionedMigrationSource>>([
  Object.freeze({
    domainId: "identity",
    migrationTableName: "identity_repository_migrations",
    migrations: IDENTITY_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "workspaces",
    migrationTableName: "workspace_repository_migrations",
    migrations: WORKSPACE_PERSISTENCE_MIGRATIONS,
  }),
]);

function createMigrationHookChecksum(input: {
  readonly domainId: string;
  readonly version: number;
  readonly sql: string;
}): string {
  const hash = createHash("sha256");
  hash.update(`${input.domainId}:v${input.version}`);
  hash.update("\n");
  hash.update(input.sql);
  return hash.digest("hex");
}

function createVersionedMigrationHooks(source: VersionedMigrationSource): ReadonlyArray<SqlitePersistenceMigrationHook> {
  return Object.freeze(source.migrations.map(([version, sql]) => {
    const migrationId = `${source.domainId}:v${version}`;
    return Object.freeze({
      migrationId,
      checksum: createMigrationHookChecksum({
        domainId: source.domainId,
        version,
        sql,
      }),
      apply(database: SqliteCompatDatabase): void {
        database.exec(`
          CREATE TABLE IF NOT EXISTS ${source.migrationTableName} (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
          );
        `);

        const existing = database
          .prepare(`SELECT version FROM ${source.migrationTableName} WHERE version = ?`)
          .get(version) as { version?: number } | undefined;
        if (typeof existing?.version === "number") {
          return;
        }

        database.exec(sql);
        database
          .prepare(`INSERT INTO ${source.migrationTableName} (version, applied_at) VALUES (?, ?)`)
          .run(version, new Date().toISOString());
      },
    }) satisfies SqlitePersistenceMigrationHook;
  }));
}

export function createAuthMinimalPersistenceMigrationHooks(): ReadonlyArray<SqlitePersistenceMigrationHook> {
  const hooks: SqlitePersistenceMigrationHook[] = [];
  for (const source of VersionedMigrationSources) {
    hooks.push(...createVersionedMigrationHooks(source));
  }
  return Object.freeze(hooks);
}

export function createAuthMinimalPersistentPlatformServices(input: {
  readonly databasePath: string;
}): AuthMinimalPersistentPlatformServices {
  const databasePath = path.resolve(input.databasePath);
  const identityRepository = new SqliteIdentityPersistenceAdapter(databasePath);
  const trustedDeviceRepository = new SqliteTrustedDevicePersistenceAdapter(databasePath);
  const workspaceRepository = new SqliteWorkspacePersistenceAdapter(databasePath);

  return Object.freeze({
    databasePath,
    identityRepository,
    trustedDeviceRepository,
    workspaceRepository,
    dispose(): void {
      identityRepository.dispose();
      trustedDeviceRepository.dispose();
      workspaceRepository.dispose();
    },
  });
}
