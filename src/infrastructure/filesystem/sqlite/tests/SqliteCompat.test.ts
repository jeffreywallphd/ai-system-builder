import { describe, expect, it } from "bun:test";
import path from "node:path";
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

  it("retries better-sqlite3 from module-directory node_modules before sqlite fallbacks", () => {
    const databasePath = "/tmp/missing-better-sqlite3.sqlite";
    const requestedModules: string[] = [];

    expect(() =>
      openSqliteCompatDatabase(databasePath, (moduleId) => {
        requestedModules.push(moduleId);
        throw new Error(`Cannot load module: ${moduleId}`);
      })
    ).toThrow("Cannot load module: bun:sqlite");

    expect(requestedModules[0]).toBe("better-sqlite3");
    expect(requestedModules[1]).toContain(`${path.sep}node_modules${path.sep}better-sqlite3`);
    expect(requestedModules.slice(2)).toEqual(["node:sqlite", "bun:sqlite"]);
  });

});
