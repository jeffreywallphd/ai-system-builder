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

describe("Filesystem SqliteCompat", () => {
  it("resolves better-sqlite3 constructors nested under default wrappers", () => {
    const databasePath = "/tmp/filesystem-nested-default-export.sqlite";
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
