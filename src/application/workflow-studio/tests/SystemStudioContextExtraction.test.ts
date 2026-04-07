import { describe, expect, it } from "bun:test";
import { createDefaultSystemStudioContextExtractor } from "../SystemStudioContextExtraction";

describe("SystemStudioContextExtraction", () => {
  it("extracts selected image, parameters, datasets, and runtime metadata into system context", () => {
    const extractor = createDefaultSystemStudioContextExtractor();

    const result = extractor.extract({
      selectedImages: [{
        imageId: "image:selected:1",
        assetRef: {
          assetId: "asset:image:selected:1",
          versionId: "v2",
          uri: "file:///tmp/selected.png",
        },
        metadata: { width: 1024, height: 768 },
      }],
      parameterValues: {
        prompt: "  restyle with cinematic lighting  ",
        denoise: 0.2,
      },
      datasets: [{
        referenceId: "active-input",
        datasetAssetId: "dataset:images",
        datasetVersionId: "v7",
        instanceId: "instance:images:v7",
        role: "active-input",
      }],
      runtime: {
        runtimeSessionId: "runtime:123",
        systemAssetId: "system:image-pipeline",
        workflowAssetId: "workflow:image-to-image",
        sourceStudio: "system-studio",
      },
    });

    expect(result.context.selectedImages[0]?.assetRef?.assetId).toBe("asset:image:selected:1");
    expect(result.context.parameters.prompt).toBe("restyle with cinematic lighting");
    expect(result.context.datasets[0]?.instanceId).toBe("instance:images:v7");
    expect(result.context.runtime.runtimeSessionId).toBe("runtime:123");
    expect(result.issues).toHaveLength(0);
  });

  it("returns inspectable warnings for structurally incomplete selected image and dataset refs", () => {
    const extractor = createDefaultSystemStudioContextExtractor();

    const result = extractor.extract({
      selectedImages: [{ metadata: { note: "missing references" } }],
      datasets: [{ referenceId: "missing-identifiers" }],
    });

    expect(result.issues.map((issue) => issue.code)).toContain("selected-image-missing-reference");
    expect(result.issues.map((issue) => issue.code)).toContain("dataset-reference-missing-identity");
  });
});
