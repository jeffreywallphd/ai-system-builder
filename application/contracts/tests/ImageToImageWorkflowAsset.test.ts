import { describe, expect, it } from "bun:test";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";
import { createImageToImageWorkflowAsset, ImageToImageWorkflowAssetId } from "../ImageToImageWorkflowAsset";
import { createDefaultImageWorkflowAssetRegistry } from "../ImageWorkflowAssetRegistry";

describe("ImageToImageWorkflowAsset", () => {
  it("conforms to high-level contract and preserves bounded config", () => {
    const asset = createImageToImageWorkflowAsset({
      configuration: {
        variationStrength: 0.7,
        resultCount: 2,
        preserveComposition: false,
      },
    });

    expect(asset.id).toBe(ImageToImageWorkflowAssetId);
    expect(asset.intentType).toBe(ImageWorkflowAssetIntentTypes.imageToImage);
    expect(asset.contract.identity.intentType).toBe(ImageWorkflowAssetIntentTypes.imageToImage);
    expect(asset.configuration.resultCount).toBe(2);
    expect(asset.bindings.sourceImageFieldId).toBe("sourceImage");
    expect(asset.bindings.promptFieldId).toBe("instruction");
    expect(asset.bindings.outputFieldId).toBe("images");
    expect(asset.inputBindings.bindings.some((binding) => binding.inputId === "sourceImage")).toBeTrue();
  });

  it("exposes composition stages and preview inspection metadata", () => {
    const asset = createImageToImageWorkflowAsset();
    expect(asset.composition.stages.map((stage) => stage.id)).toEqual([
      "stage.bind-inputs",
      "stage.prepare-conditioning",
      "stage.transform",
      "stage.materialize-output",
    ]);
    expect(asset.preview.inspectableFields).toContain("sourceImage");
    expect(asset.preview.inspectableStageIds).toContain("stage.transform");
  });

  it("registers through image workflow asset discovery registry", () => {
    const registry = createDefaultImageWorkflowAssetRegistry();
    const listed = registry.list();

    expect(listed.some((entry) => entry.id === ImageToImageWorkflowAssetId)).toBeTrue();
    expect(listed.some((entry) => entry.intentType === ImageWorkflowAssetIntentTypes.restyle)).toBeTrue();
    expect(listed.some((entry) => entry.intentType === ImageWorkflowAssetIntentTypes.enhanceUpscale)).toBeTrue();
    expect(listed.some((entry) => entry.intentType === ImageWorkflowAssetIntentTypes.batchTransform)).toBeTrue();
    expect(registry.getByIntent(ImageWorkflowAssetIntentTypes.imageToImage)?.preview.title).toContain("Image-to-image");
  });

  it("keeps configuration bounded", () => {
    expect(() => createImageToImageWorkflowAsset({ configuration: { resultCount: 0 } })).toThrow();
    expect(() => createImageToImageWorkflowAsset({ configuration: { variationStrength: 2 } })).toThrow();
  });
});
