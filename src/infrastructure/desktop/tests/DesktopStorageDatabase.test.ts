import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { ProductionStorageInitializationScopes } from "@application/runtime/interfaces/IProductionStorageInitializer";
import { resolveDesktopStoragePaths } from "../DesktopAppPaths";
import { DesktopStorageDatabase } from "../DesktopStorageDatabase";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStorageDatabase", () => {
  it("creates production storage directories and persists values", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-storage-test-"));
    tempRoots.push(root);

    const database = new DesktopStorageDatabase({
      paths: resolveDesktopStoragePaths({
        userDataPath: path.join(root, "user-data"),
        logsPath: path.join(root, "logs"),
      }),
    });

    const result = await database.initialize();
    database.setItem("settings", JSON.stringify({ theme: "dark" }));

    expect(fs.existsSync(result.databasePath)).toBe(true);
    expect(result.createdDirectories.length).toBeGreaterThan(0);
    expect(database.getItem("settings")).toContain("dark");

    database.removeItem("settings");
    expect(database.getItem("settings")).toBeNull();
    database.dispose();
  });

  it("initializes successfully when legacy database is missing schema_migrations", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-storage-legacy-test-"));
    tempRoots.push(root);

    const paths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    fs.mkdirSync(path.dirname(paths.databasePath), { recursive: true });
    const legacyDb = new Database(paths.databasePath);
    legacyDb.exec(`
      CREATE TABLE persistent_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    legacyDb.close();

    const database = new DesktopStorageDatabase({ paths });
    const result = await database.initialize();

    expect(result.appliedMigrations).toContain("create-key-value-state");
    database.setItem("settings", JSON.stringify({ theme: "light" }));
    expect(database.getItem("settings")).toContain("light");
    database.dispose();
  });

  it("supports auth-shell pre-login initialization without provisioning runtime directories", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-storage-auth-shell-test-"));
    tempRoots.push(root);

    const paths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });
    const database = new DesktopStorageDatabase({ paths });

    const result = await database.initialize({
      scope: ProductionStorageInitializationScopes.authShellPreLogin,
    });
    database.setItem("ai-loom.identity.session.v1", JSON.stringify({ sessionToken: "abc" }));

    expect(fs.existsSync(result.databasePath)).toBe(true);
    expect(fs.existsSync(paths.storageDirectory)).toBe(true);
    expect(fs.existsSync(paths.runtimeDirectory)).toBe(false);
    expect(fs.existsSync(paths.logsDirectory)).toBe(false);
    expect(fs.existsSync(paths.modelsDirectory)).toBe(false);
    expect(fs.existsSync(paths.assetsDirectory)).toBe(false);
    expect(database.getItem("ai-loom.identity.session.v1")).toContain("sessionToken");

    database.dispose();
  });

  it("can expand from auth-shell initialization to full runtime provisioning", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-storage-runtime-expand-test-"));
    tempRoots.push(root);

    const paths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });
    const database = new DesktopStorageDatabase({ paths });

    await database.initialize({
      scope: ProductionStorageInitializationScopes.authShellPreLogin,
    });
    await database.initialize({
      scope: ProductionStorageInitializationScopes.fullRuntime,
    });

    expect(fs.existsSync(paths.runtimeDirectory)).toBe(true);
    expect(fs.existsSync(paths.logsDirectory)).toBe(true);
    expect(fs.existsSync(paths.modelsDirectory)).toBe(true);
    expect(fs.existsSync(paths.assetsDirectory)).toBe(true);

    database.dispose();
  });
});
