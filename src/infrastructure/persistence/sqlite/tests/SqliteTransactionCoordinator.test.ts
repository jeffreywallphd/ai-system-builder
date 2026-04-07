import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openSqliteCompatDatabase } from "../SqliteCompat";
import { SqliteTransactionCoordinator } from "../SqliteTransactionCoordinator";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteTransactionCoordinator", () => {
  it("commits grouped writes when the transaction operation succeeds", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-sqlite-transaction-commit-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "coordinator.sqlite");
    const database = openSqliteCompatDatabase(databasePath);
    database.exec("CREATE TABLE ledger (id TEXT PRIMARY KEY, value TEXT NOT NULL);");

    const coordinator = new SqliteTransactionCoordinator(() => database);
    await coordinator.runInTransaction(async () => {
      database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)")
        .run("first", "v1");
      database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)")
        .run("second", "v2");
    });

    const row = database.prepare("SELECT COUNT(*) AS total FROM ledger")
      .get() as { total?: number };
    expect(row.total).toBe(2);
    database.close();
  });

  it("rolls back grouped writes when the transaction operation fails", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-sqlite-transaction-rollback-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "coordinator.sqlite");
    const database = openSqliteCompatDatabase(databasePath);
    database.exec("CREATE TABLE ledger (id TEXT PRIMARY KEY, value TEXT NOT NULL);");

    const coordinator = new SqliteTransactionCoordinator(() => database);
    await expect(coordinator.runInTransaction(async () => {
      database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)")
        .run("first", "v1");
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");

    const row = database.prepare("SELECT COUNT(*) AS total FROM ledger")
      .get() as { total?: number };
    expect(row.total).toBe(0);
    database.close();
  });

  it("supports nested transaction scopes through savepoints", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-sqlite-transaction-nested-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "coordinator.sqlite");
    const database = openSqliteCompatDatabase(databasePath);
    database.exec("CREATE TABLE ledger (id TEXT PRIMARY KEY, value TEXT NOT NULL);");

    const coordinator = new SqliteTransactionCoordinator(() => database);
    await coordinator.runInTransaction(async () => {
      database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)")
        .run("outer", "v1");

      await expect(coordinator.runInTransaction(async () => {
        database.prepare("INSERT INTO ledger (id, value) VALUES (?, ?)")
          .run("inner", "v2");
        throw new Error("rollback nested");
      })).rejects.toThrow("rollback nested");

      const row = database.prepare("SELECT COUNT(*) AS total FROM ledger")
        .get() as { total?: number };
      expect(row.total).toBe(1);
    });

    const finalRows = database.prepare("SELECT id FROM ledger ORDER BY id ASC")
      .all() as Array<{ id: string }>;
    expect(finalRows.map((row) => row.id)).toEqual(["outer"]);
    database.close();
  });
});

