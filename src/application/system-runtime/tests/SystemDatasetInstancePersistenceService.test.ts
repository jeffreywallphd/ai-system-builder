import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import { createDatasetInstanceImageRecord } from "@domain/system-runtime/DatasetInstanceRecordDomain";
import {
  DatasetInstanceDuplicationModes,
  SystemDatasetInstancePersistenceService,
} from "../SystemDatasetInstancePersistenceService";

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

  it("skips restoring a dataset instance when any persisted image record ownership is invalid", () => {
    const store = {
      instances: new Map<string, ReturnType<typeof createDatasetInstance>>(),
      records: new Map<string, ReturnType<typeof createDatasetInstanceImageRecord>>(),
      listBySystemId: () => [],
      listImageRecordsBySystemId: () => [],
      save(instance: ReturnType<typeof createDatasetInstance>) {
        this.instances.set(instance.instanceId, instance);
        return instance;
      },
      saveImageRecord(record: ReturnType<typeof createDatasetInstanceImageRecord>) {
        this.records.set(record.recordId, record);
        return record;
      },
    };
    const service = new SystemDatasetInstancePersistenceService(store);

    const result = service.restoreSystemDatasetInstances({
      systemId: "system:image",
      datasetInstances: [{
        instanceId: "dataset-instance:output",
        datasetAssetId: "dataset:image-output",
        role: "output-store",
        persistedState: {
          instance: {
            instanceId: "dataset-instance:output",
            systemId: "system:image",
            datasetAssetId: "dataset:image-output",
            role: "output-store",
            lifecycleStatus: "ready",
            runtimeStatus: "idle",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          imageRecords: [{
            recordId: "record:bad",
            instanceId: "dataset-instance:other",
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
          }],
        },
      }],
    });

    expect(result.issues.map((entry) => entry.code)).toEqual(["invalid-dataset-instance-state"]);
    expect(store.instances.size).toBe(0);
    expect(store.records.size).toBe(0);
  });

  it("duplicates dataset instances into isolated runtime state for another system", () => {
    const store = {
      listBySystemId: () => [],
      listImageRecordsBySystemId: () => [],
      save: (instance: ReturnType<typeof createDatasetInstance>) => instance,
      saveImageRecord: (record: ReturnType<typeof createDatasetInstanceImageRecord>) => record,
    };
    const service = new SystemDatasetInstancePersistenceService(store);
    const record = createDatasetInstanceImageRecord({
      recordId: "record:output:1",
      instanceId: "dataset-instance:output",
      systemId: "system:source",
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
    const sourceInstance = createDatasetInstance({
      instanceId: "dataset-instance:output",
      systemId: "system:source",
      datasetAssetId: "dataset:image-output",
      role: "output-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const duplicated = service.duplicateSystemDatasetInstances({
      sourceSystemId: "system:source",
      targetSystemId: "system:target",
      mode: DatasetInstanceDuplicationModes.duplicate,
      datasetInstances: [{
        instanceId: "dataset-instance:output",
        datasetAssetId: "dataset:image-output",
        role: "output-store",
        persistedState: {
          instance: sourceInstance,
          imageRecords: [record],
        },
      }],
    });

    const duplicateInstance = duplicated.datasetInstances[0];
    expect(duplicated.issues).toEqual([]);
    expect(duplicateInstance?.instanceId).toBe("system:target::dataset-instance:output");
    expect(duplicateInstance?.persistedState?.instance?.systemId).toBe("system:target");
    expect(duplicateInstance?.persistedState?.imageRecords?.[0]?.systemId).toBe("system:target");
    expect(duplicateInstance?.persistedState?.instance).not.toBe(sourceInstance);
  });

  it("can explicitly reuse dataset instances without duplication", () => {
    const store = {
      listBySystemId: () => [],
      listImageRecordsBySystemId: () => [],
      save: (instance: ReturnType<typeof createDatasetInstance>) => instance,
      saveImageRecord: (record: ReturnType<typeof createDatasetInstanceImageRecord>) => record,
    };
    const service = new SystemDatasetInstancePersistenceService(store);
    const datasetInstances = Object.freeze([{ instanceId: "dataset-instance:shared", datasetAssetId: "dataset:image", role: "input-store" as const }]);

    const reused = service.duplicateSystemDatasetInstances({
      sourceSystemId: "system:source",
      targetSystemId: "system:target",
      mode: DatasetInstanceDuplicationModes.reuse,
      datasetInstances,
    });

    expect(reused.issues).toEqual([]);
    expect(reused.datasetInstances[0]).toEqual(datasetInstances[0]);
  });
});

