import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  createImageAsset,
  transitionImageAssetStatus,
} from "@domain/image-assets/ImageAssetDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteImageAssetPersistenceAdapter } from "../SqliteImageAssetPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createFixtureAsset(input?: {
  readonly assetId?: string;
  readonly workspaceId?: string;
  readonly ownerUserId?: string;
  readonly originKind?: "uploaded-source" | "generated-result";
  readonly status?: "ingesting" | "available" | "failed" | "archived" | "deleted";
  readonly sourceRunId?: string;
  readonly generationOperationId?: string;
  readonly storageInstanceId?: string;
}): ReturnType<typeof createImageAsset> {
  return createImageAsset({
    assetId: input?.assetId ?? "image-asset:test:001",
    workspaceId: input?.workspaceId ?? "workspace-alpha",
    ownerUserId: input?.ownerUserId ?? "user-alpha",
    storageInstanceId: input?.storageInstanceId ?? "storage-alpha",
    storageBindingReference: `storage-instance://${input?.storageInstanceId ?? "storage-alpha"}/image-assets`,
    originKind: input?.originKind ?? ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: "input.png",
    normalizedFilename: "input.png",
    sizeBytes: 1024,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: "a".repeat(64),
    },
    visibility: ResourceVisibilities.private,
    sharingPolicy: {
      mode: SharingPolicyModes.ownerOnly,
    },
    createdBy: "user-alpha",
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
    lastModifiedBy: "user-alpha",
    lifecycleStatus: input?.status ?? ImageAssetStatuses.ingesting,
    lineage: {
      upstreamAssetIds: ["image-asset:upstream:001", "image-asset:upstream:002"],
      sourceRunId: input?.sourceRunId,
      generationOperationId: input?.generationOperationId,
    },
  });
}

describe("SqliteImageAssetPersistenceAdapter", () => {
  it("applies image-asset metadata migrations and creates authoritative tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-assets-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "image-assets.sqlite");

    const adapter = new SqliteImageAssetPersistenceAdapter(databasePath);
    await adapter.createImageAsset(createFixtureAsset(), {
      operationKey: "op:image-asset:create:001",
      actorUserId: "user-alpha",
      occurredAt: "2026-04-08T12:00:00.000Z",
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare(
      "SELECT MAX(version) AS version FROM image_asset_repository_migrations",
    ).get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'image_asset_records',
          'image_asset_lineage_upstreams',
          'image_asset_mutation_replays',
          'image_asset_repository_migrations'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "image_asset_lineage_upstreams",
      "image_asset_mutation_replays",
      "image_asset_records",
      "image_asset_repository_migrations",
    ]);

    const rawPathColumns = database.prepare(`
      SELECT COUNT(*) AS total
      FROM pragma_table_info('image_asset_records')
      WHERE name IN ('filesystem_path', 'raw_path', 'local_path')
    `).get() as { total?: number };
    expect(rawPathColumns.total).toBe(0);

    database.close();
  });

  it("supports create/get/list, lifecycle archive/delete, and replay-safe mutation semantics", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-assets-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteImageAssetPersistenceAdapter(path.join(root, "image-assets.sqlite"));

    const uploaded = createFixtureAsset({
      assetId: "image-asset:test:uploaded",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-alpha",
      originKind: ImageAssetOriginKinds.uploadedSource,
      status: ImageAssetStatuses.ingesting,
      storageInstanceId: "storage-alpha",
    });

    const generated = transitionImageAssetStatus(
      createFixtureAsset({
        assetId: "image-asset:test:generated",
        workspaceId: "workspace-alpha",
        ownerUserId: "user-beta",
        originKind: ImageAssetOriginKinds.generatedResult,
        sourceRunId: "run:alpha:001",
        generationOperationId: "op:gen:001",
        storageInstanceId: "storage-beta",
      }),
      {
        nextStatus: ImageAssetStatuses.available,
        actorUserId: "user-beta",
        occurredAt: "2026-04-08T12:05:00.000Z",
      },
    );

    const createdUploaded = await adapter.createImageAsset(uploaded, {
      operationKey: "op:image-asset:create:uploaded",
      actorUserId: "user-alpha",
      occurredAt: "2026-04-08T12:00:00.000Z",
    });
    expect(createdUploaded.changed).toBeTrue();
    expect(createdUploaded.wasReplay).toBeFalse();

    const replayCreate = await adapter.createImageAsset(uploaded, {
      operationKey: "op:image-asset:create:uploaded",
      actorUserId: "user-alpha",
      occurredAt: "2026-04-08T12:00:10.000Z",
    });
    expect(replayCreate.changed).toBeFalse();
    expect(replayCreate.wasReplay).toBeTrue();

    await adapter.createImageAsset(generated, {
      operationKey: "op:image-asset:create:generated",
      actorUserId: "user-beta",
      occurredAt: "2026-04-08T12:05:00.000Z",
    });

    const foundUploaded = await adapter.findImageAssetById("image-asset:test:uploaded");
    expect(foundUploaded?.assetId).toBe("image-asset:test:uploaded");
    expect(foundUploaded?.lineage?.upstreamAssetIds).toEqual([
      "image-asset:upstream:001",
      "image-asset:upstream:002",
    ]);

    const filtered = await adapter.listImageAssets({
      workspaceId: "workspace-alpha",
      originKinds: [ImageAssetOriginKinds.generatedResult],
      lifecycleStatuses: [ImageAssetStatuses.available],
      sourceRunIds: ["run:alpha:001"],
      generationOperationIds: ["op:gen:001"],
      storageInstanceIds: ["storage-beta"],
      includeDeleted: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.assetId).toBe("image-asset:test:generated");

    const archived = await adapter.archiveImageAsset("image-asset:test:generated", {
      operationKey: "op:image-asset:archive:generated",
      actorUserId: "user-beta",
      occurredAt: "2026-04-08T12:10:00.000Z",
    });
    expect(archived?.imageAsset.lifecycle.status).toBe(ImageAssetStatuses.archived);

    const deleted = await adapter.softDeleteImageAsset("image-asset:test:generated", {
      operationKey: "op:image-asset:delete:generated",
      actorUserId: "user-beta",
      occurredAt: "2026-04-08T12:12:00.000Z",
    });
    expect(deleted?.imageAsset.lifecycle.status).toBe(ImageAssetStatuses.deleted);

    const hiddenDeleted = await adapter.findImageAssetById("image-asset:test:generated");
    expect(hiddenDeleted).toBeUndefined();

    const visibleDeleted = await adapter.findImageAssetById("image-asset:test:generated", {
      includeDeleted: true,
    });
    expect(visibleDeleted?.lifecycle.status).toBe(ImageAssetStatuses.deleted);

    adapter.dispose();
  });

  it("supports created/updated timestamp range filters for metadata listing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-assets-timestamp-filters-"));
    createdRoots.push(root);
    const adapter = new SqliteImageAssetPersistenceAdapter(path.join(root, "image-assets.sqlite"));

    const older = createFixtureAsset({
      assetId: "image-asset:test:older",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-alpha",
      storageInstanceId: "storage-alpha",
    });
    const recent = createFixtureAsset({
      assetId: "image-asset:test:recent",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-alpha",
      storageInstanceId: "storage-alpha",
    });
    const recentUpdated = transitionImageAssetStatus(recent, {
      nextStatus: ImageAssetStatuses.available,
      actorUserId: "user-alpha",
      occurredAt: "2026-04-09T12:00:00.000Z",
    });

    await adapter.createImageAsset(older, {
      operationKey: "op:image-asset:create:older",
      actorUserId: "user-alpha",
      occurredAt: "2026-04-08T12:00:00.000Z",
    });

    await adapter.createImageAsset(recentUpdated, {
      operationKey: "op:image-asset:create:recent",
      actorUserId: "user-alpha",
      occurredAt: "2026-04-09T12:00:00.000Z",
    });

    const filtered = await adapter.listImageAssets({
      workspaceId: "workspace-alpha",
      updatedAfter: "2026-04-09T00:00:00.000Z",
      includeDeleted: false,
    });

    expect(filtered.map((asset) => asset.assetId)).toEqual(["image-asset:test:recent"]);
    adapter.dispose();
  });
});
