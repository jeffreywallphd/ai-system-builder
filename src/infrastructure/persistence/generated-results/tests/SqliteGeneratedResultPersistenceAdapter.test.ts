import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorkspaceTenancyMetadata } from "@shared/persistence/PersistenceTenancyMetadataFactory";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses, GeneratedResultPreviewKinds } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteGeneratedResultPersistenceAdapter } from "../SqliteGeneratedResultPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createFixtureRecord(input?: {
  readonly resultAssetId?: string;
  readonly workspaceId?: string;
  readonly runId?: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly status?: "pending-collection" | "available" | "preview-ready" | "failed-collection" | "archived";
  readonly createdAt?: string;
  readonly lastModifiedAt?: string;
  readonly inputAssetIds?: ReadonlyArray<string>;
}): Parameters<SqliteGeneratedResultPersistenceAdapter["saveResult"]>[0] {
  const status = input?.status ?? GeneratedResultAssetStatuses.pendingCollection;
  const createdAt = input?.createdAt ?? "2026-04-08T12:00:00.000Z";
  const lastModifiedAt = input?.lastModifiedAt ?? createdAt;

  return Object.freeze({
    resultAssetId: input?.resultAssetId ?? "gr-asset-001",
    workspaceId: input?.workspaceId ?? "workspace-alpha",
    ownerUserId: "user-alpha",
    runId: input?.runId ?? "run:alpha:001",
    systemId: input?.systemId ?? "system:alpha",
    workflowId: input?.workflowId ?? "workflow:alpha",
    workflowTemplateId: "template:portrait",
    executionNodeId: "node:trusted-1",
    outputSlot: "primary",
    inputAssetIds: Object.freeze(input?.inputAssetIds ?? ["input-asset-001", "input-asset-002"]),
    workflowTemplateVersionId: "template-version-001",
    workflowTemplateVersionTag: "1.2.3",
    systemSnapshotId: "system-snapshot-001",
    systemVersionTag: "1.0.0",
    parameterSnapshotId: "parameter-snapshot-001",
    selectedNodeId: "node:trusted-1",
    executionAdapterKind: "comfyui",
    executionBackendFamily: "comfyui",
    visibility: "workspace",
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/generated-results",
    mediaType: "image/png",
    status,
    pendingSince: "2026-04-08T11:59:50.000Z",
    logicalAssetVersionId: status === GeneratedResultAssetStatuses.available || status === GeneratedResultAssetStatuses.previewReady
      ? "logical-version-001"
      : undefined,
    persistedAt: status === GeneratedResultAssetStatuses.available || status === GeneratedResultAssetStatuses.previewReady
      ? "2026-04-08T12:00:00.000Z"
      : undefined,
    persistedBy: status === GeneratedResultAssetStatuses.available || status === GeneratedResultAssetStatuses.previewReady
      ? "user-alpha"
      : undefined,
    previewReadyAt: status === GeneratedResultAssetStatuses.previewReady ? "2026-04-08T12:01:00.000Z" : undefined,
    previewReadyBy: status === GeneratedResultAssetStatuses.previewReady ? "user-alpha" : undefined,
    failedAt: status === GeneratedResultAssetStatuses.failedCollection ? "2026-04-08T12:02:00.000Z" : undefined,
    failedBy: status === GeneratedResultAssetStatuses.failedCollection ? "user-alpha" : undefined,
    failureCode: status === GeneratedResultAssetStatuses.failedCollection ? "collection-failed" : undefined,
    failureMessage: status === GeneratedResultAssetStatuses.failedCollection ? "Collection failed." : undefined,
    archivedAt: status === GeneratedResultAssetStatuses.archived ? "2026-04-08T12:03:00.000Z" : undefined,
    archivedBy: status === GeneratedResultAssetStatuses.archived ? "user-alpha" : undefined,
    tenancy: createWorkspaceTenancyMetadata(input?.workspaceId ?? "workspace-alpha"),
    createdAt,
    createdBy: "user-alpha",
    lastModifiedAt,
    lastModifiedBy: "user-alpha",
    revision: 1,
    schemaVersion: 1,
  });
}

describe("SqliteGeneratedResultPersistenceAdapter", () => {
  it("applies generated-result migrations and creates authoritative tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-generated-results-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "generated-results.sqlite");

    const adapter = new SqliteGeneratedResultPersistenceAdapter(databasePath);
    await adapter.saveResult(createFixtureRecord(), {
      operationKey: "op:generated-result:create:001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:00:00.000Z",
      },
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare(
      "SELECT MAX(version) AS version FROM generated_result_repository_migrations",
    ).get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'generated_result_records',
          'generated_result_lineage_inputs',
          'generated_result_previews',
          'generated_result_mutation_replays',
          'generated_result_preview_mutation_replays',
          'generated_result_repository_migrations'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((entry) => entry.name)).toEqual([
      "generated_result_lineage_inputs",
      "generated_result_mutation_replays",
      "generated_result_preview_mutation_replays",
      "generated_result_previews",
      "generated_result_records",
      "generated_result_repository_migrations",
    ]);

    database.close();
  });

  it("supports create/read/list/update with lineage and replay-safe semantics", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-generated-results-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteGeneratedResultPersistenceAdapter(path.join(root, "generated-results.sqlite"));

    const created = await adapter.createResult(createFixtureRecord(), {
      operationKey: "op:generated-result:create:asset-001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:00:00.000Z",
      },
    });
    expect(created.changed).toBeTrue();
    expect(created.wasReplay).toBeFalse();

    const replay = await adapter.createResult(createFixtureRecord(), {
      operationKey: "op:generated-result:create:asset-001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:00:01.000Z",
      },
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();

    const found = await adapter.findResultById("gr-asset-001");
    expect(found?.resultAssetId).toBe("gr-asset-001");
    expect(found?.inputAssetIds).toEqual(["input-asset-001", "input-asset-002"]);

    const saved = await adapter.saveResult(createFixtureRecord({
      status: GeneratedResultAssetStatuses.available,
      lastModifiedAt: "2026-04-08T12:01:00.000Z",
    }), {
      operationKey: "op:generated-result:save:asset-001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:01:00.000Z",
      },
      expectedRevision: found?.revision,
    });

    expect(saved.record.status).toBe(GeneratedResultAssetStatuses.available);
    expect(saved.record.revision).toBe(2);

    await adapter.saveResult(createFixtureRecord({
      resultAssetId: "gr-asset-002",
      runId: "run:alpha:002",
      workflowId: "workflow:beta",
      status: GeneratedResultAssetStatuses.failedCollection,
      createdAt: "2026-04-08T12:02:00.000Z",
      lastModifiedAt: "2026-04-08T12:02:00.000Z",
      inputAssetIds: ["input-asset-010"],
    }), {
      operationKey: "op:generated-result:save:asset-002",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:02:00.000Z",
      },
    });

    const listedByRun = await adapter.listResultsByRun({
      workspaceId: "workspace-alpha",
      runId: "run:alpha:001",
    });
    expect(listedByRun).toHaveLength(1);
    expect(listedByRun[0]?.resultAssetId).toBe("gr-asset-001");

    const listed = await adapter.listResults({
      workspaceId: "workspace-alpha",
      statuses: [GeneratedResultAssetStatuses.failedCollection],
      includeArchived: true,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.resultAssetId).toBe("gr-asset-002");

    const lineage = await adapter.getLineageByResultId("gr-asset-001");
    expect(lineage?.runId).toBe("run:alpha:001");
    expect(lineage?.inputAssetIds).toEqual(["input-asset-001", "input-asset-002"]);

    const listedByLineageInput = await adapter.listResults({
      workspaceId: "workspace-alpha",
      lineageInputAssetIds: ["input-asset-010"],
      includeArchived: true,
    });
    expect(listedByLineageInput).toHaveLength(1);
    expect(listedByLineageInput[0]?.resultAssetId).toBe("gr-asset-002");

    adapter.dispose();
  });

  it("persists preview descriptors and supports preview replay semantics", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-generated-results-preview-"));
    createdRoots.push(root);
    const adapter = new SqliteGeneratedResultPersistenceAdapter(path.join(root, "generated-results.sqlite"));

    await adapter.saveResult(createFixtureRecord({
      status: GeneratedResultAssetStatuses.available,
    }), {
      operationKey: "op:generated-result:create-preview-parent",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:00:00.000Z",
      },
    });

    const preview = Object.freeze({
      derivativeId: "gr-preview-001",
      resultAssetId: "gr-asset-001",
      resultLogicalAssetVersionId: "logical-version-001",
      previewKind: GeneratedResultPreviewKinds.thumbnail,
      availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.available,
      isPrimaryPreview: true,
      protectedResourceId: "protected:preview:001",
      accessHandle: "preview-handle-001",
      mediaType: "image/png",
      width: 320,
      height: 240,
      byteSize: 2048,
      generatedAt: "2026-04-08T12:01:10.000Z",
      tenancy: createWorkspaceTenancyMetadata("workspace-alpha"),
      createdAt: "2026-04-08T12:01:10.000Z",
      createdBy: "user-alpha",
      lastModifiedAt: "2026-04-08T12:01:10.000Z",
      lastModifiedBy: "user-alpha",
      revision: 1,
      schemaVersion: 1,
    });

    const saved = await adapter.savePreview(preview, {
      operationKey: "op:generated-result:preview:001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:01:10.000Z",
      },
    });
    expect(saved.changed).toBeTrue();
    expect(saved.record.derivativeId).toBe("gr-preview-001");

    const replay = await adapter.savePreview(preview, {
      operationKey: "op:generated-result:preview:001",
      context: {
        actorUserId: "user-alpha",
        occurredAt: "2026-04-08T12:01:11.000Z",
      },
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();

    const previews = await adapter.listPreviewsByResultId("gr-asset-001");
    expect(previews).toHaveLength(1);
    expect(previews[0]?.previewKind).toBe(GeneratedResultPreviewKinds.thumbnail);

    adapter.dispose();
  });
});
