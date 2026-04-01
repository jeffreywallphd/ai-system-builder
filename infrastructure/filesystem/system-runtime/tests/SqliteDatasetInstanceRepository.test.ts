import { describe, expect, it } from "bun:test";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  createDatasetInstance,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRuntimeStatuses,
} from "../../../../domain/system-runtime/DatasetInstanceDomain";
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists instances by system id and resolves role/purpose lookups", () => {
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

      const bySystem = repository.listBySystemId("system:image-pipeline");
      expect(bySystem.length).toBe(2);
      expect(bySystem[0]?.instanceId).toBe("dataset-instance:output");

      const lookup = repository.findBySystemAndRole({
        systemId: "system:image-pipeline",
        role: "input-store",
        purpose: "incoming-images",
      });
      expect(lookup?.instanceId).toBe("dataset-instance:input");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
