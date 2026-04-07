import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { StorageBackedDatasetInstanceRepository } from "../../../../../application/system-runtime/DatasetInstanceRepository";
import type { DatasetInstanceStorageAdapter } from "../../../../../application/system-runtime/DatasetInstanceStorageAdapter";
import { createImageRecord } from "../../../../../src/domain/dataset-studio/contracts/ImageRecord";
import {
  createDatasetInstance,
  DatasetInstanceLifecycleStatuses,
  DatasetInstanceRuntimeStatuses,
} from "../../../../../src/domain/system-runtime/DatasetInstanceDomain";
import {
  createDatasetInstanceImageRecord,
  type DatasetInstanceImageRecord,
} from "../../../../../src/domain/system-runtime/DatasetInstanceRecordDomain";
import { ComfyLoadImageNodeAdapter } from "../ComfyLoadImageNodeAdapter";
import { ComfyModelLoaderNodeAdapter } from "../ComfyModelLoaderNodeAdapter";
import { ComfyPromptInputNodeAdapter } from "../ComfyPromptInputNodeAdapter";
import { ComfyResizeUpscaleNodeAdapter } from "../ComfyResizeUpscaleNodeAdapter";
import { ComfySamplerWrapperNodeAdapter } from "../ComfySamplerWrapperNodeAdapter";
import { ComfySaveImageNodeAdapter } from "../ComfySaveImageNodeAdapter";
import { VaeDecodeNodeAdapter } from "../VaeDecodeNodeAdapter";
import { VaeEncodeNodeAdapter } from "../VaeEncodeNodeAdapter";

class MemoryDatasetStorageAdapter implements DatasetInstanceStorageAdapter {
  private readonly instances = new Map<string, ReturnType<typeof createDatasetInstance>>();
  private readonly records = new Map<string, Map<string, DatasetInstanceImageRecord>>();

  saveInstance(instance: ReturnType<typeof createDatasetInstance>) { this.instances.set(instance.instanceId, instance); return instance; }
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
  deleteImageRecordsByInstanceId(instanceId: string) { const count = this.records.get(instanceId)?.size ?? 0; this.records.delete(instanceId); return count; }
  listImageRecordsByInstanceId(instanceId: string) { return [...(this.records.get(instanceId)?.values() ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  listImageRecordsBySystemId(input: { readonly systemId: string; readonly instanceId: string; }) {
    return this.listImageRecordsByInstanceId(input.instanceId).filter((entry) => entry.systemId === input.systemId);
  }
}

describe("Comfy common image node composability integration", () => {
  it("composes load -> VAE encode -> sampler -> VAE decode -> resize -> save with internal contracts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "loom-compose-"));
    const sourcePath = path.join(root, "seed.png");
    fs.writeFileSync(sourcePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const repository = new StorageBackedDatasetInstanceRepository(new MemoryDatasetStorageAdapter());
    repository.save(createDatasetInstance({
      instanceId: "dataset-instance:input:compose",
      systemId: "system:compose",
      datasetAssetId: "asset:dataset:input",
      role: "input-store",
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
    }));
    repository.save(createDatasetInstance({
      instanceId: "dataset-instance:output:compose",
      systemId: "system:compose",
      datasetAssetId: "asset:dataset:output",
      role: "output-store",
      lifecycleStatus: DatasetInstanceLifecycleStatuses.ready,
      runtimeStatus: DatasetInstanceRuntimeStatuses.idle,
    }));
    repository.saveImageRecord(createDatasetInstanceImageRecord({
      recordId: "record:compose:seed",
      instanceId: "dataset-instance:input:compose",
      systemId: "system:compose",
      datasetAssetId: "asset:dataset:input",
      image: createImageRecord({
        assetRef: { kind: "local-file", path: sourcePath },
        width: 256,
        height: 256,
        format: "png",
        mimeType: "image/png",
      }),
      storage: { reference: sourcePath, provider: "filesystem" },
      metadata: {},
    }));

    const load = new ComfyLoadImageNodeAdapter(repository);
    const modelLoader = new ComfyModelLoaderNodeAdapter();
    const prompt = new ComfyPromptInputNodeAdapter();
    const sampler = new ComfySamplerWrapperNodeAdapter();
    const encode = new VaeEncodeNodeAdapter();
    const decode = new VaeDecodeNodeAdapter();
    const resize = new ComfyResizeUpscaleNodeAdapter();
    const save = new ComfySaveImageNodeAdapter(repository, root);

    load.toComfyPayload({ nodeId: "load", inputs: { datasetInstanceId: "dataset-instance:input:compose" } });
    const loaded = load.fromComfyResult(
      { nodeId: "load", inputs: { datasetInstanceId: "dataset-instance:input:compose" } },
      { outputs: { image: "tensor" } },
    );

    const model = modelLoader.fromComfyResult(
      { nodeId: "model", inputs: { modelRef: "asset:model:sdxl-base" } },
      { outputs: { model: { runtime: true } } },
    );

    const conditioning = prompt.fromComfyResult(
      {
        nodeId: "prompt",
        inputs: {
          positivePrompt: "cinematic portrait",
          model: model.outputs[0]?.value,
        },
      },
      { outputs: { conditioning: [] } },
    );

    const encoded = encode.fromComfyResult(
      {
        nodeId: "encode",
        inputs: {
          image: loaded.outputs[0]?.value,
          model: model.outputs[0]?.value,
        },
      },
      { outputs: { samples: "latent:encoded:compose" } },
    );

    const sampled = sampler.fromComfyResult(
      {
        nodeId: "sampler",
        inputs: {
          model: model.outputs[0]?.value,
          promptConditioning: conditioning.outputs[0]?.value,
          sourceImage: loaded.outputs[0]?.value,
        },
      },
      { outputs: { latent: (encoded.outputs[0]?.value as { latentRef?: string })?.latentRef ?? "latent:fallback" } },
    );

    const decoded = decode.fromComfyResult(
      {
        nodeId: "decode",
        inputs: {
          latent: sampled.outputs[0]?.value,
          model: model.outputs[0]?.value,
        },
      },
      { outputs: {} },
    );

    const resized = resize.fromComfyResult(
      {
        nodeId: "resize",
        inputs: {
          image: decoded.outputs[0]?.value,
          metadata: decoded.outputs[1]?.value,
        },
        config: { scaleFactor: 1.5 },
      },
      { outputs: {} },
    );

    save.toComfyPayload({
      nodeId: "save",
      inputs: {
        datasetInstanceId: "dataset-instance:output:compose",
        image: resized.outputs[0]?.value,
        metadata: { workflowId: "workflow:compose", sourceImageRecordId: "record:compose:seed" },
      },
    });

    const saved = save.fromComfyResult(
      {
        nodeId: "save",
        inputs: {
          datasetInstanceId: "dataset-instance:output:compose",
          image: resized.outputs[0]?.value,
          metadata: { workflowId: "workflow:compose", sourceImageRecordId: "record:compose:seed" },
        },
      },
      { outputs: {} },
    );

    expect(saved.status).toBe("completed");
    expect(saved.outputs[0]?.outputId).toBe("record");
    expect(repository.listImageRecordsByInstanceId("dataset-instance:output:compose")).toHaveLength(1);

    const inspect = decode.inspect({ nodeId: "inspect", inputs: { latent: sampled.outputs[0]?.value, model: model.outputs[0]?.value } });
    expect(inspect.summary?.mode).toBe("decode");
  });

  it("normalizes representative integration failures", () => {
    const decode = new VaeDecodeNodeAdapter();
    const error = decode.normalizeError(
      new Error("VAE decode node input 'latent.latentRef' must be a non-empty string."),
      { nodeId: "decode-fail", inputs: { latent: {} } },
    );

    expect(error.code).toBe("vae-decode-invalid");
    expect(error.category).toBe("validation");
    expect(error.details?.mode).toBe("decode");
  });
});
