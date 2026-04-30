import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { TaskType, type RuntimeTaskRecord } from "../../../../contracts/runtime";
import type { ArtifactStoragePort } from "../../../ports/storage";
import type { ImageAssetRegistryPort, ImageBinaryRetrievalPort } from "../../../ports/image";
import { FinalizeImageGenerationService } from "../finalize-image-generation.service";

function createTask(overrides: Partial<RuntimeTaskRecord> = {}): RuntimeTaskRecord {
  return {
    requestId: "req-1",
    taskType: TaskType.IMAGE_GENERATION,
    status: "succeeded",
    concurrencyClass: "unknown",
    data: { outputs: [{ fileName: "out.png", mimeType: "image/png", outputId: "o1" }], payload: { prompt: "a sunset", negativePrompt: "blurry" } },
    metadata: { seed: 7, width: 512, height: 768, model: "sdxl", workflowTemplateId: "wf-1" },
    ...overrides,
  };
}

describe("FinalizeImageGenerationService", () => {
  it("succeeds when task completed and returns asset references", async () => {
    const artifactStorage: ArtifactStoragePort = { storeArtifact: testDouble.fn(async () => ({ ok: true, value: { storageKey: "art-1", mediaType: "image/png" } })) };
    const imageAssetRegistry: ImageAssetRegistryPort = {
      registerImageAsset: testDouble.fn(async () => ({ assetId: "asset-1" })),
      getImageAsset: testDouble.fn(async () => null),
    };
    const imageBinaryRetrieval: ImageBinaryRetrievalPort = { getImageBinary: testDouble.fn(async () => new Uint8Array([1, 2, 3])) };

    const service = new FinalizeImageGenerationService({ artifactStorage, imageAssetRegistry, imageBinaryRetrieval });
    const result = await service.finalizeCompletedTask(createTask());

    expect(result).toEqual({ assets: [{ assetId: "asset-1", artifactId: "art-1" }] });
  });

  it("rejects non-succeeded tasks", async () => {
    const service = new FinalizeImageGenerationService({
      artifactStorage: { storeArtifact: testDouble.fn(async () => ({ ok: true, value: { storageKey: "art-1", mediaType: "image/png" } })) },
      imageAssetRegistry: { registerImageAsset: testDouble.fn(async () => ({ assetId: "asset-1" })), getImageAsset: testDouble.fn(async () => null) },
      imageBinaryRetrieval: { getImageBinary: testDouble.fn(async () => new Uint8Array()) },
    });

    await expect(service.finalizeCompletedTask(createTask({ status: "running" }))).rejects.toThrow(
      "Image generation finalization requires a succeeded runtime task.",
    );
  });

  it("stores artifacts and registers image assets with mapped metadata", async () => {
    const artifactStorage: ArtifactStoragePort = { storeArtifact: testDouble.fn(async () => ({ ok: true, value: { storageKey: "art-1", mediaType: "image/png" } })) };
    const imageAssetRegistry: ImageAssetRegistryPort = {
      registerImageAsset: testDouble.fn(async () => ({ assetId: "asset-1" })),
      getImageAsset: testDouble.fn(async () => null),
    };
    const imageBinaryRetrieval: ImageBinaryRetrievalPort = { getImageBinary: testDouble.fn(async () => new Uint8Array([9])) };

    const service = new FinalizeImageGenerationService({ artifactStorage, imageAssetRegistry, imageBinaryRetrieval });
    await service.finalizeCompletedTask(createTask());

    expect(artifactStorage.storeArtifact).toHaveBeenCalledWith({
      descriptor: { storageKey: "out.png", mediaType: "image/png" },
      content: new Uint8Array([9]),
    });
    const call = (imageAssetRegistry.registerImageAsset as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0];
    expect(call.artifactId).toBe("art-1");
    expect(call.source).toBe("generated");
    expect(call.metadata).toMatchObject({
      prompt: "a sunset",
      negativePrompt: "blurry",
      seed: 7,
      width: 512,
      height: 768,
      model: "sdxl",
      workflowTemplateId: "wf-1",
      engine: "comfyui",
    });
    expect(typeof call.metadata.createdAt).toBe("number");
  });

  it("is idempotent and does not duplicate stored assets", async () => {
    const artifactStorage: ArtifactStoragePort = { storeArtifact: testDouble.fn(async () => ({ ok: true, value: { storageKey: "art-1", mediaType: "image/png" } })) };
    const imageAssetRegistry: ImageAssetRegistryPort = {
      registerImageAsset: testDouble.fn(async () => ({ assetId: "asset-1" })),
      getImageAsset: testDouble.fn(async () => null),
    };
    const imageBinaryRetrieval: ImageBinaryRetrievalPort = { getImageBinary: testDouble.fn(async () => new Uint8Array([1])) };

    const service = new FinalizeImageGenerationService({ artifactStorage, imageAssetRegistry, imageBinaryRetrieval });
    const task = createTask();
    const first = await service.finalizeCompletedTask(task);
    const second = await service.finalizeCompletedTask(task);

    expect(first).toEqual(second);
    expect(artifactStorage.storeArtifact).toHaveBeenCalledTimes(1);
    expect(imageAssetRegistry.registerImageAsset).toHaveBeenCalledTimes(1);
    expect(imageBinaryRetrieval.getImageBinary).toHaveBeenCalledTimes(1);
  });
});
