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

const AddColumnStatementPattern = /^\s*ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b/i;
const DuplicateColumnErrorPattern = /duplicate column name:/i;

function splitSqlStatements(sql: string): ReadonlyArray<string> {
  const statements: string[] = [];
  let buffer = "";
  let insideSingleQuote = false;
  let insideDoubleQuote = false;
  let insideLineComment = false;
  let insideBlockComment = false;
  let insideTriggerBody = false;
  let pendingCreateKeyword = false;
  let pendingTriggerBodyBegin = false;
  let currentWord = "";

  const commitWord = (): void => {
    if (currentWord.length === 0) {
      return;
    }
    const word = currentWord.toUpperCase();
    if (word === "CREATE") {
      pendingCreateKeyword = true;
      pendingTriggerBodyBegin = false;
    } else if (word === "TRIGGER" && pendingCreateKeyword) {
      pendingTriggerBodyBegin = true;
    } else if (word === "BEGIN" && pendingTriggerBodyBegin) {
      insideTriggerBody = true;
      pendingTriggerBodyBegin = false;
    } else if (word === "END" && insideTriggerBody) {
      insideTriggerBody = false;
    }
    currentWord = "";
  };

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index] ?? "";
    const next = sql[index + 1] ?? "";
    const previous = sql[index - 1] ?? "";
    buffer += current;

    if (insideLineComment) {
      if (current === "\n") {
        insideLineComment = false;
      }
      continue;
    }

    if (insideBlockComment) {
      if (previous === "*" && current === "/") {
        insideBlockComment = false;
      }
      continue;
    }

    if (!insideSingleQuote && !insideDoubleQuote) {
      if (current === "-" && next === "-") {
        commitWord();
        insideLineComment = true;
        continue;
      }
      if (current === "/" && next === "*") {
        commitWord();
        insideBlockComment = true;
        continue;
      }
    }

    if (insideSingleQuote) {
      if (current === "'" && next === "'") {
        buffer += next;
        index += 1;
        continue;
      }
      if (current === "'" && previous !== "\\") {
        insideSingleQuote = false;
      }
      continue;
    }

    if (insideDoubleQuote) {
      if (current === "\"" && next === "\"") {
        buffer += next;
        index += 1;
        continue;
      }
      if (current === "\"" && previous !== "\\") {
        insideDoubleQuote = false;
      }
      continue;
    }

    if (current === "'") {
      commitWord();
      insideSingleQuote = true;
      continue;
    }
    if (current === "\"") {
      commitWord();
      insideDoubleQuote = true;
      continue;
    }

    if (/[A-Za-z0-9_]/.test(current)) {
      currentWord += current;
      continue;
    }
    commitWord();

    if (!/\s/.test(current) && current !== "(") {
      pendingCreateKeyword = false;
    }

    if (current === ";" && !insideTriggerBody) {
      const statement = buffer.trim();
      if (statement.length > 1) {
        statements.push(statement);
      }
      buffer = "";
      pendingCreateKeyword = false;
      pendingTriggerBodyBegin = false;
    }
  }

  commitWord();
  const trailing = buffer.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }
  return statements;
}

function isIgnorableDuplicateAddColumnError(error: unknown, statement: string): boolean {
  if (!AddColumnStatementPattern.test(statement)) {
    return false;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return DuplicateColumnErrorPattern.test(error.message);
}

function execVersionedMigrationSql(database: SqliteCompatDatabase, sql: string): void {
  for (const statement of splitSqlStatements(sql)) {
    try {
      database.exec(`${statement};`);
    } catch (error) {
      // Drift-safe replay: ignore duplicate-column faults only for ALTER TABLE ... ADD COLUMN statements.
      if (isIgnorableDuplicateAddColumnError(error, statement)) {
        continue;
      }
      throw error;
    }
  }
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

        execVersionedMigrationSql(database, sql);
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
