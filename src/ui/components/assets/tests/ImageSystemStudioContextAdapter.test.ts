import { describe, expect, it } from "bun:test";
import { createInitialImageInterfaceState } from "../image-system/ImageSystemStateIntegration";
import { mapImageInterfaceStateToSystemContextSource } from "../image-system/ImageSystemStudioContextAdapter";

describe("ImageSystemStudioContextAdapter", () => {
  it("maps image system interface state into extraction source without leaking component state", () => {
    const state = createInitialImageInterfaceState({
      selectedImageId: "image-1",
      parameterValues: {
        prompt: "make this cinematic",
      },
      datasetRef: {
        datasetAssetId: "dataset:images",
        datasetVersionId: "v3",
        datasetInstanceId: "instance:images:v3",
      },
      systemRef: {
        systemAssetId: "system:image-pipeline",
        runtimeSessionId: "runtime:xyz",
      },
      imageCollection: [{
        imageId: "image-1",
        title: "Source",
        sourceUrl: "file:///tmp/source.png",
        metadata: { width: 512, height: 512, format: "png" },
        tags: ["source"],
        context: {
          dataset: {
            datasetAssetId: "dataset:images",
            datasetVersionId: "v3",
            datasetInstanceId: "instance:images:v3",
          },
        },
      }],
    });

    const source = mapImageInterfaceStateToSystemContextSource(state, {
      workflowAssetId: "workflow:image-to-image",
      sourceStudio: "system-studio",
    });

    expect(source.selectedImages?.[0]?.imageId).toBe("image-1");
    expect(source.parameterValues?.prompt).toBe("make this cinematic");
    expect(source.datasets?.[0]?.datasetAssetId).toBe("dataset:images");
    expect(source.runtime?.runtimeSessionId).toBe("runtime:xyz");
    expect(source.runtime?.workflowAssetId).toBe("workflow:image-to-image");
  });
});
