import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import { createDatasetInstanceImageRecord } from "@domain/system-runtime/DatasetInstanceRecordDomain";
import {
  StorageBackedDatasetInstanceRepository,
  type DatasetInstanceRepository,
} from "../DatasetInstanceRepository";
import type { DatasetInstanceStorageAdapter } from "../DatasetInstanceStorageAdapter";

class InMemoryAdapter implements DatasetInstanceStorageAdapter {
  public readonly instances = new Map<string, ReturnType<typeof createDatasetInstance>>();
  public readonly records = new Map<string, ReturnType<typeof createDatasetInstanceImageRecord>>();

  public saveInstance(instance: ReturnType<typeof createDatasetInstance>) { this.instances.set(instance.instanceId, instance); return instance; }
  public getInstanceById(instanceId: string) { return this.instances.get(instanceId); }
  public getInstanceBySystemAndId(input: { readonly systemId: string; readonly instanceId: string; }) {
    const instance = this.instances.get(input.instanceId);
    return instance?.systemId === input.systemId ? instance : undefined;
  }
  public deleteInstanceById(instanceId: string) { return this.instances.delete(instanceId); }
  public listInstancesBySystemId(systemId: string) { return Object.freeze([...this.instances.values()].filter((i) => i.systemId === systemId)); }
  public findInstanceBySystemAndRole(input: { readonly systemId: string; readonly role: "input-store" | "output-store" | "intermediate-store"; readonly purpose?: string; }) {
    return [...this.instances.values()].find((i) => i.systemId === input.systemId && i.role === input.role && i.purpose === input.purpose);
  }

  public saveImageRecord(record: ReturnType<typeof createDatasetInstanceImageRecord>) { this.records.set(`${record.instanceId}:${record.recordId}`, record); return record; }
  public getImageRecordById(input: { readonly instanceId: string; readonly recordId: string; }) { return this.records.get(`${input.instanceId}:${input.recordId}`); }
  public getImageRecordBySystemAndId(input: { readonly systemId: string; readonly instanceId: string; readonly recordId: string; }) {
    const record = this.getImageRecordById(input);
    return record?.systemId === input.systemId ? record : undefined;
  }
  public deleteImageRecordById(input: { readonly instanceId: string; readonly recordId: string; }) { return this.records.delete(`${input.instanceId}:${input.recordId}`); }
  public deleteImageRecordsByInstanceId(instanceId: string) {
    let removed = 0;
    for (const key of [...this.records.keys()]) {
      if (key.startsWith(`${instanceId}:`)) {
        this.records.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
  public listImageRecordsByInstanceId(instanceId: string) {
    return Object.freeze([...this.records.values()].filter((record) => record.instanceId === instanceId));
  }
  public listImageRecordsBySystemId(input: { readonly systemId: string; readonly instanceId: string; }) {
    return Object.freeze(this.listImageRecordsByInstanceId(input.instanceId).filter((record) => record.systemId === input.systemId));
  }
}

describe("StorageBackedDatasetInstanceRepository", () => {
  it("persists instance and image records through the adapter seam", () => {
    const adapter = new InMemoryAdapter();
    const repository: DatasetInstanceRepository = new StorageBackedDatasetInstanceRepository(adapter);
    const instance = createDatasetInstance({
      instanceId: "dataset-instance:1",
      systemId: "system:test",
      datasetAssetId: "asset:dataset",
      role: "input-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
    });
    repository.save(instance);
    const record = createDatasetInstanceImageRecord({
      recordId: "record-1",
      instanceId: instance.instanceId,
      systemId: instance.systemId,
      datasetAssetId: instance.datasetAssetId,
      image: { assetRef: { kind: "local-file", stableId: "local-file:/tmp/input.png", path: "/tmp/input.png" }, width: 10, height: 10, format: "png", metadata: {}, tags: [] },
      mutationVersion: 1,
    });

    repository.saveImageRecord(record);

    expect(repository.getBySystemAndId({ systemId: "system:test", instanceId: "dataset-instance:1" })?.instanceId).toBe("dataset-instance:1");
    expect(repository.getImageRecordBySystemAndId({ systemId: "system:test", instanceId: "dataset-instance:1", recordId: "record-1" })?.recordId).toBe("record-1");
  });

  it("fails predictably when adapter receives image records for mismatched system ownership", () => {
    const repository: DatasetInstanceRepository = new StorageBackedDatasetInstanceRepository(new InMemoryAdapter());
    const instance = createDatasetInstance({
      instanceId: "dataset-instance:2",
      systemId: "system:owner-a",
      datasetAssetId: "asset:dataset",
      role: "input-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
    });
    repository.save(instance);

    expect(() => repository.saveImageRecord(createDatasetInstanceImageRecord({
      recordId: "record-x",
      instanceId: "dataset-instance:2",
      systemId: "system:owner-b",
      datasetAssetId: "asset:dataset",
      image: { assetRef: { kind: "generated-output", stableId: "generated-output:foo", outputId: "foo" }, width: 10, height: 10, format: "png", metadata: {}, tags: [] },
      mutationVersion: 1,
    }))).toThrow("invalid-request:Cannot save image record");
  });
});

