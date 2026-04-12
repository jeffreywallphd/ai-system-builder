import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AssetKinds,
  AssetLifecycleStates,
  AssetVisibilities,
  addAssetVersion,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  transitionAssetLifecycle,
} from "@domain/assets/AssetDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteAssetPersistenceAdapter } from "../SqliteAssetPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createSampleAsset(overrides?: {
  readonly id?: string;
  readonly workspaceId?: string;
  readonly ownerUserId?: string;
  readonly kind?: (typeof AssetKinds)[keyof typeof AssetKinds];
  readonly storageInstanceId?: string;
}): ReturnType<typeof createAsset> {
  const id = overrides?.id ?? "asset-sample";
  const workspaceId = overrides?.workspaceId ?? "workspace-alpha";
  const ownerUserId = overrides?.ownerUserId ?? "user-owner";
  const kind = overrides?.kind ?? AssetKinds.uploadedFile;
  const storageInstanceId = overrides?.storageInstanceId ?? "storage-alpha";

  return createAsset({
    id,
    kind,
    ownership: createAssetOwnershipMetadata({
      workspaceId,
      ownerUserId,
      createdBy: ownerUserId,
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId,
    }),
    initialVersion: createAssetVersion({
      versionId: "ver-1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: {
          storageInstanceId,
        },
        objectKey: `${workspaceId}/input/${id}.png`,
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 1024,
        checksum: {
          algorithm: "sha256",
          digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        originalFileName: `${id}.png`,
      }),
      createdBy: ownerUserId,
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

describe("SqliteAssetPersistenceAdapter", () => {
  it("applies asset migrations idempotently and creates persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-asset-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "assets.sqlite");

    const adapter = new SqliteAssetPersistenceAdapter(databasePath);
    await adapter.createAsset(createSampleAsset({ id: "asset-alpha" }));
    adapter.dispose();

    const reopened = new SqliteAssetPersistenceAdapter(databasePath);
    await reopened.findAssetById("asset-alpha");
    reopened.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM asset_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(3);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('asset_records', 'asset_versions', 'asset_lineage_links', 'asset_generated_output_sources')
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "asset_generated_output_sources",
      "asset_lineage_links",
      "asset_records",
      "asset_versions",
    ]);

    const rawPathColumn = database.prepare(`
      SELECT COUNT(*) AS total
      FROM pragma_table_info('asset_records')
      WHERE name IN ('raw_path', 'filesystem_path', 'local_path')
    `).get() as { total?: number };
    expect(rawPathColumn.total).toBe(0);

    const encryptionDescriptorColumn = database.prepare(`
      SELECT COUNT(*) AS total
      FROM pragma_table_info('asset_versions')
      WHERE name = 'content_encryption_descriptor'
    `).get() as { total?: number };
    expect(encryptionDescriptorColumn.total).toBe(1);

    database.close();
  });

  it("supports create, read, list, save, and lineage-scoped retrieval", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-asset-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteAssetPersistenceAdapter(path.join(root, "assets.sqlite"));

    const sourceAsset = createSampleAsset({ id: "asset-source", kind: AssetKinds.generatedOutput });
    await adapter.createAsset(sourceAsset);

    const derivedAsset = createSampleAsset({ id: "asset-derived", kind: AssetKinds.derived });
    await adapter.createAsset(derivedAsset);

    await adapter.replaceAssetLineage("asset-derived", [
      {
        sourceAssetId: "asset-source",
        sourceAssetVersionId: "ver-1",
        relation: "derived-from",
      },
    ]);

    const updated = addAssetVersion(derivedAsset, {
      versionId: "ver-2",
      location: createAssetLocationRef({
        storageInstance: {
          storageInstanceId: "storage-alpha",
        },
        objectKey: "workspace-alpha/output/asset-derived-v2.png",
        area: "output",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 4096,
        checksum: {
          algorithm: "sha256",
          digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        originalFileName: "asset-derived-v2.png",
      }),
      actorUserId: "user-owner",
      occurredAt: "2026-04-06T12:10:00.000Z",
    });

    await adapter.saveAsset(updated);

    const byId = await adapter.findAssetById("asset-derived");
    expect(byId?.versions).toHaveLength(2);
    expect(byId?.currentVersionId).toBe("ver-2");

    const byWorkspaceAndOwner = await adapter.listAssets({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      assetKinds: [AssetKinds.derived],
      visibilities: [AssetVisibilities.private],
      createdByUserId: "user-owner",
    });
    expect(byWorkspaceAndOwner).toHaveLength(1);
    expect(byWorkspaceAndOwner[0]?.id).toBe("asset-derived");

    const byLineage = await adapter.listAssets({
      sourceAssetId: "asset-source",
      sourceAssetVersionId: "ver-1",
    });
    expect(byLineage).toHaveLength(1);
    expect(byLineage[0]?.id).toBe("asset-derived");

    const lineage = await adapter.listAssetLineage("asset-derived");
    expect(lineage).toHaveLength(1);
    expect(lineage[0]?.sourceAssetId).toBe("asset-source");

    await adapter.replaceAssetGeneratedOutputSource("asset-derived", {
      producerType: "run",
      runId: "execution-run-001",
      systemId: "system-asset-render",
    });
    const source = await adapter.getAssetGeneratedOutputSource("asset-derived");
    expect(source).toEqual({
      producerType: "run",
      runId: "execution-run-001",
      systemId: "system-asset-render",
    });

    adapter.dispose();
  });

  it("rejects stale saves when a newer asset record already exists", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-asset-stale-"));
    createdRoots.push(root);
    const adapter = new SqliteAssetPersistenceAdapter(path.join(root, "assets.sqlite"));

    const asset = createSampleAsset({ id: "asset-stale" });
    await adapter.createAsset(asset);

    const newer = transitionAssetLifecycle(asset, AssetLifecycleStates.archived, {
      actorUserId: "user-owner",
      occurredAt: "2026-04-06T12:10:00.000Z",
    });
    await adapter.saveAsset(newer);

    await expect(adapter.saveAsset(asset)).rejects.toThrow("Asset persistence conflict while saving asset");

    adapter.dispose();
  });
});

