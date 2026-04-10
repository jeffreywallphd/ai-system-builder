import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createAuthMinimalPersistenceMigrationHooks,
  createAuthMinimalPersistentPlatformServices,
} from "../AuthMinimalPersistenceComposition";
import { openSqliteCompatDatabase } from "../sqlite/SqliteCompat";

describe("AuthMinimalPersistenceComposition", () => {
  it("builds deterministic migration hooks only for auth-critical persistence domains", () => {
    const hooks = createAuthMinimalPersistenceMigrationHooks();
    const ids = hooks.map((hook) => hook.migrationId);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBeGreaterThan(0);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids).toContain("identity:v1");
    expect(ids).toContain("workspaces:v1");
    expect(ids.some((id) => id.startsWith("authorization:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("deployment-policy:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("storage:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("assets:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("image-assets:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("platform:"))).toBeFalse();
    expect(ids.some((id) => id.startsWith("audit-ledger:"))).toBeFalse();
  });

  it("creates and disposes auth-minimal persistent platform services without non-auth repositories", () => {
    const services = createAuthMinimalPersistentPlatformServices({
      databasePath: path.join("runtime-assets", "server", "auth-minimal-composition-test.sqlite"),
    });
    const serviceRecord = services as unknown as Record<string, unknown>;

    expect(services.databasePath.endsWith("auth-minimal-composition-test.sqlite")).toBeTrue();
    expect(services.identityRepository).toBeDefined();
    expect(services.trustedDeviceRepository).toBeDefined();
    expect(services.workspaceRepository).toBeDefined();
    expect(serviceRecord.authorizationRepository).toBeUndefined();
    expect(serviceRecord.deploymentPolicyRepository).toBeUndefined();
    expect(serviceRecord.storageInstanceRepository).toBeUndefined();
    expect(serviceRecord.assetRepository).toBeUndefined();
    expect(serviceRecord.imageAssetRepository).toBeUndefined();
    expect(serviceRecord.platformPersistenceRepository).toBeUndefined();
    expect(serviceRecord.auditLedgerRepository).toBeUndefined();
    expect(serviceRecord.generatedResultRepository).toBeUndefined();

    expect(() => services.dispose()).not.toThrow();
  });

  it("treats duplicate workspace encryption-policy add-column drift as idempotent migration replay", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-auth-minimal-workspace-migration-drift-"));
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

      const hook = createAuthMinimalPersistenceMigrationHooks()
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
