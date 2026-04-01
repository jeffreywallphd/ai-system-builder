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
import { SqliteDatasetInstanceRepository } from "../SqliteDatasetInstanceRepository";

describe("SqliteDatasetInstanceRepository", () => {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
