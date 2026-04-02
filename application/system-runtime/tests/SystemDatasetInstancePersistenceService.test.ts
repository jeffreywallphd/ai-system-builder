import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "../../../domain/system-runtime/DatasetInstanceDomain";
import { createDatasetInstanceImageRecord } from "../../../domain/system-runtime/DatasetInstanceRecordDomain";
import { SystemDatasetInstancePersistenceService } from "../SystemDatasetInstancePersistenceService";

describe("SystemDatasetInstancePersistenceService", () => {
  it("captures and restores system-owned dataset instance state including image records", () => {
    const store = {
      instances: new Map<string, ReturnType<typeof createDatasetInstance>>(),
      records: new Map<string, ReturnType<typeof createDatasetInstanceImageRecord>>(),
      listBySystemId(systemId: string) {
        return [...this.instances.values()].filter((entry) => entry.systemId === systemId);
      },
      listImageRecordsBySystemId(input: { readonly systemId: string; readonly instanceId: string }) {
        return [...this.records.values()].filter((entry) => entry.systemId === input.systemId && entry.instanceId === input.instanceId);
      },
      save(instance: ReturnType<typeof createDatasetInstance>) {
        this.instances.set(instance.instanceId, instance);
        return instance;
      },
      saveImageRecord(record: ReturnType<typeof createDatasetInstanceImageRecord>) {
        this.records.set(record.recordId, record);
        return record;
      },
    };

    const instance = createDatasetInstance({
      instanceId: "dataset-instance:output",
      systemId: "system:image",
      datasetAssetId: "dataset:image-output",
      role: "output-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const record = createDatasetInstanceImageRecord({
      recordId: "record:output:1",
      instanceId: "dataset-instance:output",
      systemId: "system:image",
      datasetAssetId: "dataset:image-output",
      image: {
        assetRef: { kind: "canonical-asset", stableId: "canonical-asset:image:1", assetId: "asset:image:1" },
        width: 512,
        height: 512,
        format: "png",
        mimeType: "image/png",
        metadata: {},
        tags: [],
      },
      metadata: {},
      provenance: {},
      admittedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      mutationVersion: 1,
    });
    store.save(instance);
    store.saveImageRecord(record);

    const service = new SystemDatasetInstancePersistenceService(store);
    const captured = service.captureSystemDatasetInstances("system:image");

    expect(captured.datasetInstances[0]?.persistedState?.instance?.instanceId).toBe("dataset-instance:output");
    expect(captured.datasetInstances[0]?.persistedState?.imageRecords?.length).toBe(1);

    const restoreStore = {
      ...store,
      instances: new Map<string, ReturnType<typeof createDatasetInstance>>(),
      records: new Map<string, ReturnType<typeof createDatasetInstanceImageRecord>>(),
    };
    const restoreService = new SystemDatasetInstancePersistenceService(restoreStore);
    const restored = restoreService.restoreSystemDatasetInstances({
      systemId: "system:image",
      datasetInstances: captured.datasetInstances,
    });

    expect(restored.issues).toEqual([]);
    expect(restoreStore.instances.get("dataset-instance:output")).toBeDefined();
    expect(restoreStore.records.get("record:output:1")).toBeDefined();
  });

  it("returns structured warnings/errors for missing or incompatible persisted state", () => {
    const store = {
      listBySystemId: () => [],
      listImageRecordsBySystemId: () => [],
      save: (instance: ReturnType<typeof createDatasetInstance>) => instance,
      saveImageRecord: (record: ReturnType<typeof createDatasetInstanceImageRecord>) => record,
    };
    const service = new SystemDatasetInstancePersistenceService(store);

    const result = service.restoreSystemDatasetInstances({
      systemId: "system:image",
      datasetInstances: [
        { instanceId: "dataset-instance:missing", datasetAssetId: "dataset:image", role: "output-store" },
        {
          instanceId: "dataset-instance:bad",
          datasetAssetId: "dataset:image",
          role: "output-store",
          persistedState: {
            instance: {
              instanceId: "dataset-instance:other",
              systemId: "system:wrong",
              datasetAssetId: "dataset:image",
              role: "output-store",
              lifecycleStatus: "ready",
              runtimeStatus: "idle",
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            imageRecords: [],
          },
        },
      ],
    });

    expect(result.issues.map((entry) => entry.code)).toEqual([
      "missing-dataset-instance-state",
      "invalid-dataset-instance-state",
    ]);
  });
});
