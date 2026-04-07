import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createAuthoritativePersistenceMigrationHooks,
  createAuthoritativePersistentPlatformServices,
} from "../AuthoritativePersistenceComposition";
import { openSqliteCompatDatabase } from "../sqlite/SqliteCompat";

describe("AuthoritativePersistenceComposition", () => {
  it("builds deterministic migration hooks for all authoritative persistence domains", () => {
    const hooks = createAuthoritativePersistenceMigrationHooks();
    const ids = hooks.map((hook) => hook.migrationId);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBeGreaterThan(0);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids).toContain("identity:v1");
    expect(ids).toContain("workspaces:v1");
    expect(ids).toContain("authorization:v1");
    expect(ids).toContain("nodes:v1");
    expect(ids).toContain("storage:v1");
    expect(ids).toContain("assets:v1");
    expect(ids).toContain("asset-upload-sessions:v1");
    expect(ids).toContain("platform:v1");
    expect(ids).toContain("certificate-authority:v1");
    expect(ids).toContain("secret-records:v1");
  });

  it("creates and disposes authoritative persistent platform services", () => {
    const services = createAuthoritativePersistentPlatformServices({
      databasePath: path.join("runtime-assets", "server", "authoritative-composition-test.sqlite"),
    });

    expect(services.databasePath.endsWith("authoritative-composition-test.sqlite")).toBeTrue();
    expect(services.identityRepository).toBeDefined();
    expect(services.workspaceRepository).toBeDefined();
    expect(services.platformPersistenceRepository).toBeDefined();

    expect(() => services.dispose()).not.toThrow();
  });

  it("treats duplicate workspace encryption-policy add-column drift as idempotent migration replay", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-authoritative-workspace-migration-drift-"));
    const databasePath = path.join(root, "workspace-drift.sqlite");
    const database = openSqliteCompatDatabase(databasePath);

    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS workspace_repository_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        INSERT INTO workspace_repository_migrations (version, applied_at)
        VALUES (2, '2026-04-06T00:00:00.000Z');

        CREATE TABLE IF NOT EXISTS workspace_records (
          workspace_id TEXT PRIMARY KEY,
          slug TEXT NOT NULL,
          display_name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          owner_user_id TEXT NOT NULL,
          visibility TEXT NOT NULL,
          encryption_mode TEXT NOT NULL DEFAULT 'platform-managed',
          content_encryption_required INTEGER NOT NULL DEFAULT 1,
          key_scope TEXT NOT NULL DEFAULT 'workspace',
          allow_preview_decryption INTEGER NOT NULL DEFAULT 0,
          allow_worker_decryption INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          last_modified_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_modified_at TEXT NOT NULL
        );
      `);

      const hook = createAuthoritativePersistenceMigrationHooks()
        .find((migration) => migration.migrationId === "workspaces:v3");
      expect(hook).toBeDefined();

      expect(() => hook?.apply(database)).not.toThrow();

      const version = database.prepare(`
        SELECT MAX(version) AS version
        FROM workspace_repository_migrations
      `).get() as { version?: number };
      expect(version.version).toBe(3);
    } finally {
      database.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
