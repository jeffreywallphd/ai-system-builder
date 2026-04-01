import { describe, expect, it } from "bun:test";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  createDatasetInstance,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRuntimeStatuses,
} from "../../../../domain/system-runtime/DatasetInstanceDomain";
import { createDatasetInstanceImageRecord } from "../../../../domain/system-runtime/DatasetInstanceRecordDomain";
import { StorageBackedDatasetInstanceRepository } from "../../../../application/system-runtime/DatasetInstanceRepository";
import { SqliteDatasetInstanceRepository } from "../SqliteDatasetInstanceRepository";

describe("SqliteDatasetInstanceRepository", () => {
  it("supports repository operations through the storage adapter boundary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-sqlite-adapter-"));
    try {
      const adapter = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      const repository = new StorageBackedDatasetInstanceRepository(adapter);
      const instance = createDatasetInstance({
        instanceId: "dataset-instance:adapter:1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        role: "input-store",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
      });
      repository.save(instance);

      const persisted = repository.getBySystemAndId({
        systemId: "system:image-pipeline",
        instanceId: "dataset-instance:adapter:1",
      });
      expect(persisted?.instanceId).toBe("dataset-instance:adapter:1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists and rehydrates dataset instance identity, ownership, linkage, role, lifecycle, and seed metadata", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-sqlite-"));
    try {
      const repository = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      const instance = createDatasetInstance({
        instanceId: "dataset-instance:input:1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
        runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
        seedMetadata: {
          bucket: "seed-input",
          retainDays: 7,
        },
        lifecycleMetadata: {
          retentionPolicy: "manual",
          cleanupAfter: "2026-04-07T00:00:00.000Z",
          cleanupStatus: "pending",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      });

      repository.save(instance);
      const reloaded = repository.getById("dataset-instance:input:1");

      expect(reloaded?.instanceId).toBe("dataset-instance:input:1");
      expect(reloaded?.systemId).toBe("system:image-pipeline");
      expect(reloaded?.datasetAssetId).toBe("image-ingestor-v1");
      expect(reloaded?.datasetAssetVersionId).toBe("1.0.0");
      expect(reloaded?.role).toBe("input-store");
      expect(reloaded?.purpose).toBe("incoming-images");
      expect(reloaded?.lifecycleStatus).toBe("ready");
      expect(reloaded?.runtimeStatus).toBe("idle");
      expect(reloaded?.seedMetadata?.bucket).toBe("seed-input");
      expect(reloaded?.lifecycleMetadata?.cleanupAfter).toBe("2026-04-07T00:00:00.000Z");
      expect(reloaded?.lifecycleMetadata?.cleanupStatus).toBe("pending");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists instances by system id and resolves output/intermediate role lookups", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-sqlite-list-"));
    try {
      const repository = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:input",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:output",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-exporter-v1",
        datasetAssetVersionId: "1.0.0",
        role: "output-store",
        purpose: "rendered-images",
        lifecycleStatus: "ready",
        runtimeStatus: "processing",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
      }));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:other-system",
        systemId: "system:other",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:intermediate",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-stage-v1",
        datasetAssetVersionId: "1.0.0",
        role: "intermediate-store",
        purpose: "stage:enhance",
        lifecycleStatus: "ready",
        runtimeStatus: "processing",
        lifecycleMetadata: {
          retentionPolicy: "ttl",
          maxAgeDays: 1,
          cleanupStatus: "pending",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:02:00.000Z",
      }));

      const bySystem = repository.listBySystemId("system:image-pipeline");
      expect(bySystem.length).toBe(3);
      expect(bySystem[0]?.instanceId).toBe("dataset-instance:intermediate");

      const inputLookup = repository.findBySystemAndRole({
        systemId: "system:image-pipeline",
        role: "input-store",
        purpose: "incoming-images",
      });
      expect(inputLookup?.instanceId).toBe("dataset-instance:input");

      const outputLookup = repository.findBySystemAndRole({
        systemId: "system:image-pipeline",
        role: "output-store",
        purpose: "rendered-images",
      });
      expect(outputLookup?.instanceId).toBe("dataset-instance:output");

      const intermediateLookup = repository.findBySystemAndRole({
        systemId: "system:image-pipeline",
        role: "intermediate-store",
        purpose: "stage:enhance",
      });
      expect(intermediateLookup?.instanceId).toBe("dataset-instance:intermediate");
      expect(intermediateLookup?.lifecycleMetadata?.retentionPolicy).toBe("ttl");
      expect(intermediateLookup?.lifecycleMetadata?.maxAgeDays).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists, lists, retrieves, and queries image records by dataset instance boundary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-image-records-sqlite-"));
    try {
      const repository = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:input-images",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
        runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));

      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "img-record-1",
        instanceId: "dataset-instance:input-images",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://image-1",
            outputId: "prepared://image-1",
          },
          width: 1024,
          height: 768,
          format: "png",
          metadata: {
            source: "camera-a",
            quality: "high",
          },
          tags: ["portrait", "hero"],
          derived: {
            orientation: "landscape",
          },
          schemaVersion: "1.0.0",
        },
        storage: {
          reference: "prepared://image-1",
          provider: "prepared-store",
        },
        metadata: {
          role: "input",
        },
        admittedAt: "2026-04-01T00:01:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
      }));

      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "img-record-2",
        instanceId: "dataset-instance:input-images",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://image-2",
            outputId: "prepared://image-2",
          },
          width: 512,
          height: 512,
          format: "jpeg",
          metadata: {
            source: "camera-b",
          },
          tags: ["thumbnail"],
          derived: {
            orientation: "square",
          },
          schemaVersion: "1.0.0",
        },
        storage: {
          reference: "prepared://image-2",
        },
        admittedAt: "2026-04-01T00:02:00.000Z",
        updatedAt: "2026-04-01T00:02:00.000Z",
      }));

      const listed = repository.listImageRecordsByInstanceId("dataset-instance:input-images");
      expect(listed.length).toBe(2);
      expect(listed[0]?.recordId).toBe("img-record-2");

      const fetched = repository.getImageRecordById({
        instanceId: "dataset-instance:input-images",
        recordId: "img-record-1",
      });
      expect(fetched?.image.width).toBe(1024);
      expect(fetched?.storage?.reference).toBe("prepared://image-1");
      expect(fetched?.metadata.role).toBe("input");

      const queried = repository.queryImageRecordsByInstanceId({
        instanceId: "dataset-instance:input-images",
        query: {
          format: "png",
          tag: "portrait",
          minWidth: 1000,
        },
      });
      expect(queried.length).toBe(1);
      expect(queried[0]?.recordId).toBe("img-record-1");
      expect(queried[0]?.mutationVersion).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("isolates instance and image-record retrieval by system namespace and allows duplicate record ids per instance", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-isolation-sqlite-"));
    try {
      const repository = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:owned-a",
        systemId: "system:image-pipeline-a",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:owned-b",
        systemId: "system:image-pipeline-b",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));

      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "shared-record-id",
        instanceId: "dataset-instance:owned-a",
        systemId: "system:image-pipeline-a",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://owned-a",
            outputId: "prepared://owned-a",
          },
          width: 100,
          height: 100,
          format: "png",
          metadata: { source: "a" },
          tags: ["a"],
          derived: {},
          schemaVersion: "1.0.0",
        },
      }));
      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "shared-record-id",
        instanceId: "dataset-instance:owned-b",
        systemId: "system:image-pipeline-b",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://owned-b",
            outputId: "prepared://owned-b",
          },
          width: 200,
          height: 200,
          format: "png",
          metadata: { source: "b" },
          tags: ["b"],
          derived: {},
          schemaVersion: "1.0.0",
        },
      }));

      const ownedA = repository.getBySystemAndId({
        systemId: "system:image-pipeline-a",
        instanceId: "dataset-instance:owned-a",
      });
      expect(ownedA?.instanceId).toBe("dataset-instance:owned-a");
      expect(repository.getBySystemAndId({
        systemId: "system:image-pipeline-b",
        instanceId: "dataset-instance:owned-a",
      })).toBeUndefined();

      const recordsA = repository.listImageRecordsBySystemId({
        systemId: "system:image-pipeline-a",
        instanceId: "dataset-instance:owned-a",
      });
      const recordsB = repository.listImageRecordsBySystemId({
        systemId: "system:image-pipeline-b",
        instanceId: "dataset-instance:owned-b",
      });
      expect(recordsA).toHaveLength(1);
      expect(recordsB).toHaveLength(1);
      expect(recordsA[0]?.image.metadata.source).toBe("a");
      expect(recordsB[0]?.image.metadata.source).toBe("b");
      expect(repository.getImageRecordBySystemAndId({
        systemId: "system:image-pipeline-a",
        instanceId: "dataset-instance:owned-a",
        recordId: "shared-record-id",
      })?.image.metadata.source).toBe("a");
      expect(repository.getImageRecordBySystemAndId({
        systemId: "system:image-pipeline-a",
        instanceId: "dataset-instance:owned-b",
        recordId: "shared-record-id",
      })).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("supports clearing/removing image records and deleting dataset instances", () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-instance-delete-sqlite-"));
    try {
      const repository = new SqliteDatasetInstanceRepository(path.join(root, "dataset-instances.sqlite"));
      repository.save(createDatasetInstance({
        instanceId: "dataset-instance:delete-1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        role: "input-store",
        purpose: "incoming-images",
        lifecycleStatus: "ready",
        runtimeStatus: "idle",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }));

      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "img-record-delete-1",
        instanceId: "dataset-instance:delete-1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://delete-1",
            outputId: "prepared://delete-1",
          },
          width: 512,
          height: 512,
          format: "png",
          metadata: {},
          tags: [],
          derived: {},
          schemaVersion: "1.0.0",
        },
        admittedAt: "2026-04-01T00:01:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
      }));

      const deletedRecord = repository.deleteImageRecordById({
        instanceId: "dataset-instance:delete-1",
        recordId: "img-record-delete-1",
      });
      expect(deletedRecord).toBeTrue();
      expect(repository.listImageRecordsByInstanceId("dataset-instance:delete-1").length).toBe(0);

      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "img-record-delete-2",
        instanceId: "dataset-instance:delete-1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://delete-2",
            outputId: "prepared://delete-2",
          },
          width: 256,
          height: 256,
          format: "png",
          metadata: {},
          tags: [],
          derived: {},
          schemaVersion: "1.0.0",
        },
        admittedAt: "2026-04-01T00:02:00.000Z",
        updatedAt: "2026-04-01T00:02:00.000Z",
      }));
      repository.saveImageRecord(createDatasetInstanceImageRecord({
        recordId: "img-record-delete-3",
        instanceId: "dataset-instance:delete-1",
        systemId: "system:image-pipeline",
        datasetAssetId: "image-ingestor-v1",
        datasetAssetVersionId: "1.0.0",
        image: {
          assetRef: {
            kind: "generated-output",
            stableId: "generated-output:prepared://delete-3",
            outputId: "prepared://delete-3",
          },
          width: 128,
          height: 128,
          format: "png",
          metadata: {},
          tags: [],
          derived: {},
          schemaVersion: "1.0.0",
        },
        admittedAt: "2026-04-01T00:03:00.000Z",
        updatedAt: "2026-04-01T00:03:00.000Z",
      }));

      const removedCount = repository.deleteImageRecordsByInstanceId("dataset-instance:delete-1");
      expect(removedCount).toBe(2);
      expect(repository.listImageRecordsByInstanceId("dataset-instance:delete-1").length).toBe(0);

      const deletedInstance = repository.deleteById("dataset-instance:delete-1");
      expect(deletedInstance).toBeTrue();
      expect(repository.getById("dataset-instance:delete-1")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
