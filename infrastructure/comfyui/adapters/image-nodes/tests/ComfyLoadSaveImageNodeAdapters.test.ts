import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { StorageBackedDatasetInstanceRepository } from "../../../../../application/system-runtime/DatasetInstanceRepository";
import type { DatasetInstanceStorageAdapter } from "../../../../../application/system-runtime/DatasetInstanceStorageAdapter";
import { createImageRecord } from "../../../../../domain/dataset-studio/contracts/ImageRecord";
import {
  createDatasetInstance,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRuntimeStatuses,
} from "../../../../../domain/system-runtime/DatasetInstanceDomain";
import {
  createDatasetInstanceImageRecord,
  type DatasetInstanceImageRecord,
} from "../../../../../domain/system-runtime/DatasetInstanceRecordDomain";
import { ComfyLoadImageNodeAdapter } from "../ComfyLoadImageNodeAdapter";
import { ComfySaveImageNodeAdapter } from "../ComfySaveImageNodeAdapter";

class MemoryDatasetStorageAdapter implements DatasetInstanceStorageAdapter {
  private readonly instances = new Map<string, ReturnType<typeof createDatasetInstance>>();
  private readonly records = new Map<string, Map<string, DatasetInstanceImageRecord>>();

  saveInstance(instance: ReturnType<typeof createDatasetInstance>) {
    this.instances.set(instance.instanceId, instance);
    return instance;
  }
  getInstanceById(instanceId: string) { return this.instances.get(instanceId); }
  getInstanceBySystemAndId(input: { readonly systemId: string; readonly instanceId: string; }) {
    const instance = this.instances.get(input.instanceId);
    return instance?.systemId === input.systemId ? instance : undefined;
  }
  deleteInstanceById(instanceId: string) { return this.instances.delete(instanceId); }
  listInstancesBySystemId(systemId: string) { return [...this.instances.values()].filter((entry) => entry.systemId === systemId); }
  findInstanceBySystemAndRole(input: { readonly systemId: string; readonly role: "input-store" | "output-store" | "intermediate-store"; readonly purpose?: string; }) {
    return this.listInstancesBySystemId(input.systemId).find((entry) => entry.role === input.role && entry.purpose === input.purpose);
  }

  saveImageRecord(record: DatasetInstanceImageRecord) {
    const byRecord = this.records.get(record.instanceId) ?? new Map<string, DatasetInstanceImageRecord>();
    byRecord.set(record.recordId, record);
    this.records.set(record.instanceId, byRecord);
    return record;
  }
  getImageRecordById(input: { readonly instanceId: string; readonly recordId: string; }) { return this.records.get(input.instanceId)?.get(input.recordId); }
  getImageRecordBySystemAndId(input: { readonly systemId: string; readonly instanceId: string; readonly recordId: string; }) {
    const record = this.records.get(input.instanceId)?.get(input.recordId);
    return record?.systemId === input.systemId ? record : undefined;
  }
  deleteImageRecordById(input: { readonly instanceId: string; readonly recordId: string; }) { return this.records.get(input.instanceId)?.delete(input.recordId) ?? false; }
  deleteImageRecordsByInstanceId(instanceId: string) {
    const count = this.records.get(instanceId)?.size ?? 0;
    this.records.delete(instanceId);
    return count;
  }
  listImageRecordsByInstanceId(instanceId: string) {
    return [...(this.records.get(instanceId)?.values() ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  listImageRecordsBySystemId(input: { readonly systemId: string; readonly instanceId: string; }) {
    return this.listImageRecordsByInstanceId(input.instanceId).filter((entry) => entry.systemId === input.systemId);
  }
}

describe("Comfy load/save image node adapters", () => {
  it("loads image records from dataset instances and returns internal image + metadata output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "loom-load-"));
    const sourcePath = path.join(root, "input.png");
    fs.writeFileSync(sourcePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const repository = new StorageBackedDatasetInstanceRepository(new MemoryDatasetStorageAdapter());
    repository.save(createDatasetInstance({
      instanceId: "dataset-instance:input:1",
      systemId: "system:alpha",
      datasetAssetId: "asset:dataset:input",
      role: "input-store",
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
    }));
    repository.saveImageRecord(createDatasetInstanceImageRecord({
      recordId: "record:input:1",
      instanceId: "dataset-instance:input:1",
      systemId: "system:alpha",
      datasetAssetId: "asset:dataset:input",
      image: createImageRecord({
        assetRef: { kind: "local-file", path: sourcePath },
        width: 128,
        height: 64,
        format: "png",
        mimeType: "image/png",
      }),
      storage: { reference: sourcePath, provider: "filesystem" },
      metadata: {},
    }));

    const adapter = new ComfyLoadImageNodeAdapter(repository, () => 0.25);
    const payload = adapter.toComfyPayload({
      nodeId: "load-1",
      inputs: {
        datasetInstanceId: "dataset-instance:input:1",
        systemId: "system:alpha",
        selection: { strategy: "latest" },
      },
    });

    const response = adapter.fromComfyResult(
      { nodeId: "load-1", inputs: { datasetInstanceId: "dataset-instance:input:1" } },
      { outputs: { image: "comfy-tensor" } },
    );

    expect(payload.classType).toBe("LoadImage");
    expect(response.outputs[0]?.outputId).toBe("image");
    expect((response.outputs[0]?.value as { width: number }).width).toBe(128);
    expect((response.outputs[1]?.value as { imageId: string }).imageId).toBe("record:input:1");
  });

  it("persists save-image output into a dataset instance and supports load->save composition", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "loom-save-"));
    const sourcePath = path.join(root, "source.png");
    fs.writeFileSync(sourcePath, Buffer.from([1, 2, 3, 4, 5]));

    const repository = new StorageBackedDatasetInstanceRepository(new MemoryDatasetStorageAdapter());
    repository.save(createDatasetInstance({
      instanceId: "dataset-instance:input:2",
      systemId: "system:beta",
      datasetAssetId: "asset:dataset:input-2",
      role: "input-store",
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
    }));
    repository.save(createDatasetInstance({
      instanceId: "dataset-instance:output:2",
      systemId: "system:beta",
      datasetAssetId: "asset:dataset:output-2",
      role: "output-store",
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
    }));
    repository.saveImageRecord(createDatasetInstanceImageRecord({
      recordId: "record:seed:2",
      instanceId: "dataset-instance:input:2",
      systemId: "system:beta",
      datasetAssetId: "asset:dataset:input-2",
      image: createImageRecord({
        assetRef: { kind: "local-file", path: sourcePath },
        width: 32,
        height: 32,
        format: "png",
        mimeType: "image/png",
      }),
      storage: { reference: sourcePath, provider: "filesystem" },
      metadata: {},
    }));

    const loadAdapter = new ComfyLoadImageNodeAdapter(repository);
    loadAdapter.toComfyPayload({
      nodeId: "load-compose",
      inputs: { datasetInstanceId: "dataset-instance:input:2" },
    });
    const loadResponse = loadAdapter.fromComfyResult(
      { nodeId: "load-compose", inputs: { datasetInstanceId: "dataset-instance:input:2" } },
      { outputs: { image: "tensor" } },
    );

    const saveAdapter = new ComfySaveImageNodeAdapter(
      repository,
      root,
      () => new Date("2026-01-02T03:04:05.678Z"),
      () => "abc12345",
    );

    const savePayload = saveAdapter.toComfyPayload({
      nodeId: "save-compose",
      inputs: {
        datasetInstanceId: "dataset-instance:output:2",
        image: loadResponse.outputs[0]?.value,
        metadata: {
          workflowId: "workflow:compose:1",
          sourceImageRecordId: "record:seed:2",
          prompt: "test prompt",
        },
      },
      config: { filenamePrefix: "generated" },
    });

    const saveResponse = saveAdapter.fromComfyResult(
      {
        nodeId: "save-compose",
        inputs: {
          datasetInstanceId: "dataset-instance:output:2",
          image: loadResponse.outputs[0]?.value,
        },
      },
      { outputs: {} },
    );

    const savedRecords = repository.listImageRecordsByInstanceId("dataset-instance:output:2");
    expect(savePayload.classType).toBe("SaveImage");
    expect(savedRecords).toHaveLength(1);
    expect(savedRecords[0]?.provenance.sourceReference).toBe("record:seed:2");
    expect(savedRecords[0]?.provenance.sourceRunId).toBe("workflow:compose:1");
    expect(saveResponse.outputs[0]?.outputId).toBe("record");
    expect((saveResponse.outputs[0]?.value as { datasetInstanceId: string }).datasetInstanceId).toBe(
      "dataset-instance:output:2",
    );
  });

  it("keeps comfy-specific typing inside adapter boundaries", async () => {
    const module = await import(
      "../../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts"
    );

    expect(Object.keys(module).some((key) => key.toLowerCase().includes("comfy"))).toBe(false);
  });
});
