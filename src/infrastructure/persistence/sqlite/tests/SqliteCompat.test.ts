import { describe, expect, it } from "bun:test";
import { openSqliteCompatDatabase } from "../SqliteCompat";

class FakeBetterSqlite3Database {
  public constructor(public readonly databasePath: string) {}

  public pragma(): void {}

  public exec(): void {}

  public prepare() {
    return {
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    };
  }

  public transaction<T>(operation: () => T): () => T {
    return operation;
  }

  public close(): void {}
}

describe("SqliteCompat", () => {
  it("opens the database when better-sqlite3 exports a constructor directly", () => {
    const databasePath = "/tmp/direct-export.sqlite";
    const database = openSqliteCompatDatabase(databasePath, (moduleId) => {
      if (moduleId === "better-sqlite3") {
        return FakeBetterSqlite3Database;
      }

      throw new Error(`Unexpected module request: ${moduleId}`);
    });

    expect(database).toBeInstanceOf(FakeBetterSqlite3Database);
    expect((database as FakeBetterSqlite3Database).databasePath).toBe(databasePath);
  });

  it("opens the database when better-sqlite3 is exposed as a default export", () => {
    const databasePath = "/tmp/default-export.sqlite";
    const requestedModules: string[] = [];
    const database = openSqliteCompatDatabase(databasePath, (moduleId) => {
      requestedModules.push(moduleId);
      if (moduleId === "better-sqlite3") {
        return { default: FakeBetterSqlite3Database };
      }

      throw new Error(`Unexpected module request: ${moduleId}`);
    });

    expect(database).toBeInstanceOf(FakeBetterSqlite3Database);
    expect((database as FakeBetterSqlite3Database).databasePath).toBe(databasePath);
    expect(requestedModules).toEqual(["better-sqlite3"]);
  });

  it("opens the database when better-sqlite3 is nested under repeated default exports", () => {
    const databasePath = "/tmp/nested-default-export.sqlite";
    const database = openSqliteCompatDatabase(databasePath, (moduleId) => {
      if (moduleId === "better-sqlite3") {
        return { default: { default: FakeBetterSqlite3Database } };
      }

      throw new Error(`Unexpected module request: ${moduleId}`);
    });

    expect(database).toBeInstanceOf(FakeBetterSqlite3Database);
    expect((database as FakeBetterSqlite3Database).databasePath).toBe(databasePath);
  });
});
