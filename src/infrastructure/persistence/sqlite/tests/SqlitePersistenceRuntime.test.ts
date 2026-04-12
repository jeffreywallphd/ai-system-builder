import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openSqliteCompatDatabase } from "../SqliteCompat";
import {
  SqlitePersistenceEnvironmentKeys,
  createSqlitePersistenceRuntime,
  resolveSqlitePersistenceRuntimeConfiguration,
} from "../SqlitePersistenceRuntime";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqlitePersistenceRuntime", () => {
  it("resolves sqlite persistence configuration from explicit input and environment", () => {
    const explicit = resolveSqlitePersistenceRuntimeConfiguration({
      databasePath: "relative/dev.sqlite",
      environment: {},
    });
    expect(explicit.databasePath.endsWith(path.join("relative", "dev.sqlite"))).toBeTrue();
    expect(explicit.pragmas.journalMode).toBe("WAL");
    expect(explicit.pragmas.foreignKeys).toBeTrue();

    const fromEnvironment = resolveSqlitePersistenceRuntimeConfiguration({
      environment: {
        [SqlitePersistenceEnvironmentKeys.databasePath]: "env/dev.sqlite",
        [SqlitePersistenceEnvironmentKeys.journalMode]: "delete",
        [SqlitePersistenceEnvironmentKeys.foreignKeys]: "false",
      },
    });
    expect(fromEnvironment.databasePath.endsWith(path.join("env", "dev.sqlite"))).toBeTrue();
    expect(fromEnvironment.pragmas.journalMode).toBe("DELETE");
    expect(fromEnvironment.pragmas.foreignKeys).toBeFalse();
  });

  it("applies bootstrap metadata and migration hooks exactly once", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-persistence-bootstrap-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "bootstrap.sqlite");

    const runtime = createSqlitePersistenceRuntime({
      configuration: resolveSqlitePersistenceRuntimeConfiguration({
        databasePath,
      }),
      migrationHooks: [
        {
          migrationId: "bootstrap:create-example-table",
          checksum: "v1",
          apply: (database) => {
            database.exec(`
              CREATE TABLE IF NOT EXISTS example_records (
                record_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
              );
            `);
          },
        },
      ],
    });

    const firstStart = await runtime.start();
    expect(firstStart.migrationIdsApplied).toEqual(["bootstrap:create-example-table"]);

    const secondStart = await runtime.start();
    expect(secondStart.migrationIdsApplied).toEqual([]);

    await runtime.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const metadata = database.prepare(`
      SELECT value
      FROM platform_persistence_bootstrap_metadata
      WHERE key = 'bootstrap-version'
      LIMIT 1
    `).get() as { value?: string } | undefined;
    expect(metadata?.value).toBe("1");

    const migration = database.prepare(`
      SELECT migration_id, checksum
      FROM platform_persistence_bootstrap_migrations
      WHERE migration_id = 'bootstrap:create-example-table'
      LIMIT 1
    `).get() as { migration_id?: string; checksum?: string } | undefined;
    expect(migration?.migration_id).toBe("bootstrap:create-example-table");
    expect(migration?.checksum).toBe("v1");

    const tableExists = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'example_records'
      LIMIT 1
    `).get() as { name?: string } | undefined;
    expect(tableExists?.name).toBe("example_records");
    database.close();
  });

  it("fails fast when a persisted bootstrap migration checksum changes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-persistence-checksum-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "checksum.sqlite");

    const firstRuntime = createSqlitePersistenceRuntime({
      configuration: resolveSqlitePersistenceRuntimeConfiguration({
        databasePath,
      }),
      migrationHooks: [
        {
          migrationId: "bootstrap:checksum",
          checksum: "v1",
          apply: () => {},
        },
      ],
    });
    await firstRuntime.start();
    await firstRuntime.dispose();

    const secondRuntime = createSqlitePersistenceRuntime({
      configuration: resolveSqlitePersistenceRuntimeConfiguration({
        databasePath,
      }),
      migrationHooks: [
        {
          migrationId: "bootstrap:checksum",
          checksum: "v2",
          apply: () => {},
        },
      ],
    });

    await expect(secondRuntime.start()).rejects.toThrow("checksum mismatch");
    await secondRuntime.dispose();
  });
});
