import { describe, expect, it } from "bun:test";
import {
  ComfyImageManipulationDatasetBindingAsset,
  resolveComfyInputDatasetBinding,
} from "../ComfyImageManipulationDatasetBindingAsset";

describe("ComfyImageManipulationDatasetBindingAsset", () => {
  it("defines a logical-reference dataset binding asset contract", () => {
    expect(ComfyImageManipulationDatasetBindingAsset.assetId).toBe("asset:config-profile:comfy-image-manipulation-dataset-binding");
    expect(ComfyImageManipulationDatasetBindingAsset.configSurface.forbidsRawFilesystemPaths).toBeTrue();
    expect(ComfyImageManipulationDatasetBindingAsset.configSurface.supportsSharedStorageInstances).toBeTrue();
  });

  it("resolves workflow dataset binding from dataset runtime handles without exposing paths", () => {
    const binding = resolveComfyInputDatasetBinding({
      handles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance:reference-image:input",
          role: "active-input",
          datasetAssetId: "asset:dataset:image-reference-input",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-runtime",
        },
      ],
    });

    expect(binding.bindingId).toBe("input-image-dataset");
    expect(binding.workflowInputId).toBe("sourceImage");
    expect(binding.datasetRef.logicalRef).toBe("dataset-instance://dataset-instance%3Areference-image%3Ainput");
    expect(binding.datasetRef.storageInstanceRef).toBe("storage-instance://storage-instance%3Ashared-runtime");
  });

  it("rejects raw storage filesystem path references", () => {
    expect(() => resolveComfyInputDatasetBinding({
      handles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance:reference-image:input",
          role: "active-input",
          storageInstanceRef: "/storage/shared-runtime/input",
        },
      ],
    })).toThrow("storage instance references must be logical references");
  });
});
