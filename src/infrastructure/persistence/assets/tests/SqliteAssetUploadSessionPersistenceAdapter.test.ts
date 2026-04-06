import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteAssetUploadSessionPersistenceAdapter } from "../SqliteAssetUploadSessionPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteAssetUploadSessionPersistenceAdapter", () => {
  it("persists and updates upload session records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-asset-upload-session-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "assets.sqlite");

    const adapter = new SqliteAssetUploadSessionPersistenceAdapter(databasePath);
    await adapter.createUploadSession({
      uploadSessionId: "asset-upload-session:test-001",
      workspaceId: "workspace-alpha",
      assetId: "asset-upload-001",
      actorUserId: "user-owner",
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/session/file.bin",
      area: "input",
      expected: {
        fileName: "file.bin",
        mimeType: "application/octet-stream",
        sizeBytes: 12,
      },
      status: "pending",
      expiresAt: "2026-04-06T12:15:00.000Z",
      createdAt: "2026-04-06T12:00:00.000Z",
      updatedAt: "2026-04-06T12:00:00.000Z",
    });

    const seeded = await adapter.findUploadSessionById("asset-upload-session:test-001");
    expect(seeded?.status).toBe("pending");
    expect(seeded?.expected.sizeBytes).toBe(12);

    await adapter.saveUploadSession({
      ...seeded!,
      status: "completed",
      updatedAt: "2026-04-06T12:01:00.000Z",
      finalizedVersionId: "asset-upload-001:v2",
      finalizedContent: {
        mimeType: "application/octet-stream",
        sizeBytes: 12,
        checksumAlgorithm: "sha256",
        checksumDigest: "a".repeat(64),
      },
    });

    const completed = await adapter.findUploadSessionById("asset-upload-session:test-001");
    expect(completed?.status).toBe("completed");
    expect(completed?.finalizedVersionId).toBe("asset-upload-001:v2");
    expect(completed?.finalizedContent?.checksumDigest).toBe("a".repeat(64));

    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare(
      "SELECT MAX(version) AS version FROM asset_upload_session_repository_migrations",
    ).get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('asset_upload_sessions', 'asset_upload_session_repository_migrations')
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "asset_upload_session_repository_migrations",
      "asset_upload_sessions",
    ]);

    database.close();
  });
});
