import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageReplicationModes,
  createStorageAttribution,
  createStorageInstance,
  transitionStorageLifecycle,
} from "../../../../domain/storage/StorageDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteStorageInstancePersistenceAdapter } from "../SqliteStorageInstancePersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteStorageInstancePersistenceAdapter", () => {
  it("applies storage migrations idempotently and creates persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-storage-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "storage.sqlite");

    const adapter = new SqliteStorageInstancePersistenceAdapter(databasePath);
    await adapter.createStorageInstance(createStorageInstance({
      id: "storage-alpha",
      displayName: "Storage Alpha",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace-alpha",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-alpha",
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "corr-storage-alpha",
    }), {
      operationKey: "op-storage-create-alpha",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-storage-alpha",
    });
    adapter.dispose();

    const reopened = new SqliteStorageInstancePersistenceAdapter(databasePath);
    await reopened.findStorageInstanceById("storage-alpha");
    reopened.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM storage_instance_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('storage_instances', 'storage_instance_mutation_replays')
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "storage_instance_mutation_replays",
      "storage_instances",
    ]);

    const rawPathColumn = database.prepare(`
      SELECT COUNT(*) AS total
      FROM pragma_table_info('storage_instances')
      WHERE name IN ('raw_client_path', 'filesystem_path', 'client_path')
    `).get() as { total?: number };
    expect(rawPathColumn.total).toBe(0);

    database.close();
  });

  it("supports storage create, replay-safe save, list queries, and lifecycle updates", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-storage-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteStorageInstancePersistenceAdapter(path.join(root, "storage.sqlite"));

    const primary = createStorageInstance({
      id: "storage-primary",
      displayName: "Primary Storage",
      backendType: StorageBackendTypes.objectStorage,
      ownership: {
        workspaceId: "workspace-alpha",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readOnly,
        scope: StorageAccessScopes.workspaceMembers,
      },
      replication: {
        mode: StorageReplicationModes.syncMirror,
        replicaStorageInstanceId: "storage-replica",
      },
      policy: {
        policyId: "policy-primary",
        labels: {
          tier: "gold",
        },
        retentionDays: 30,
        encryption: {
          profileId: "profile-default",
          keyReferenceId: "keyref-primary",
          envelopeRequired: true,
        },
        security: {
          encryptionMode: "customer-managed",
          contentEncryptionRequired: true,
          keyScope: "storage-instance",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        lifecycle: {
          retentionExpiryAction: "archive",
        },
      },
      lifecycleState: StorageLifecycleStates.active,
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "corr-storage-primary-create",
    });

    const created = await adapter.createStorageInstance(primary, {
      operationKey: "op-storage-primary-create",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-storage-primary-create",
    });
    expect(created.changed).toBeTrue();
    expect(created.wasReplay).toBeFalse();

    const replay = await adapter.createStorageInstance(primary, {
      operationKey: "op-storage-primary-create",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:00:01.000Z",
      correlationId: "corr-storage-primary-create",
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();

    const transitioned = transitionStorageLifecycle(
      primary,
      StorageLifecycleStates.archived,
      createStorageAttribution({
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-06T12:30:00.000Z",
        correlationId: "corr-storage-primary-archive",
      }),
    );

    const saved = await adapter.saveStorageInstance(transitioned, {
      operationKey: "op-storage-primary-save",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:30:00.000Z",
      correlationId: "corr-storage-primary-archive",
    });
    expect(saved.changed).toBeTrue();
    expect(saved.wasReplay).toBeFalse();
    expect(saved.storageInstance.lifecycleState).toBe(StorageLifecycleStates.archived);

    const listed = await adapter.listStorageInstances({
      workspaceId: "workspace-alpha",
      backendTypes: [StorageBackendTypes.objectStorage],
      lifecycleStates: [StorageLifecycleStates.archived],
      accessModes: [StorageAccessModes.readOnly],
      accessScopes: [StorageAccessScopes.workspaceMembers],
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe("storage-primary");
    expect((await adapter.findStorageInstanceById("storage-primary"))?.lifecycleState).toBe(StorageLifecycleStates.archived);

    adapter.dispose();
  });

  it("rejects stale storage updates when a newer persisted record exists", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-storage-stale-"));
    createdRoots.push(root);
    const adapter = new SqliteStorageInstancePersistenceAdapter(path.join(root, "storage.sqlite"));

    const storage = createStorageInstance({
      id: "storage-stale",
      displayName: "Stale Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownership: {
        workspaceId: "workspace-alpha",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-stale",
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
      lastCorrelationId: "corr-storage-stale-create",
    });

    await adapter.createStorageInstance(storage, {
      operationKey: "op-storage-stale-create",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-storage-stale-create",
    });

    const newer = transitionStorageLifecycle(
      storage,
      StorageLifecycleStates.active,
      createStorageAttribution({
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-06T12:10:00.000Z",
        correlationId: "corr-storage-stale-newer",
      }),
    );

    await adapter.saveStorageInstance(newer, {
      operationKey: "op-storage-stale-save-newer",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:10:00.000Z",
      correlationId: "corr-storage-stale-newer",
    });

    await expect(adapter.saveStorageInstance(storage, {
      operationKey: "op-storage-stale-save-older",
      actorUserIdentityId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-storage-stale-older",
    })).rejects.toThrow("Storage persistence conflict while saving storage instance");

    adapter.dispose();
  });
});
