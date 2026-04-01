import { describe, expect, it } from "bun:test";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";
import { createEnhanceUpscaleWorkflowAsset, EnhanceUpscaleWorkflowAssetId } from "../EnhanceUpscaleWorkflowAsset";

describe("EnhanceUpscaleWorkflowAsset", () => {
  it("conforms to the high-level contract with bounded config", () => {
    const asset = createEnhanceUpscaleWorkflowAsset({
      configuration: {
        scaleFactor: 3,
        sharpen: false,
        denoise: 0.2,
      },
    });

    expect(asset.id).toBe(EnhanceUpscaleWorkflowAssetId);
    expect(asset.intentType).toBe(ImageWorkflowAssetIntentTypes.enhanceUpscale);
    expect(asset.contract.identity.intentType).toBe(ImageWorkflowAssetIntentTypes.enhanceUpscale);
    expect(asset.configuration.scaleFactor).toBe(3);
    expect(asset.bindings.sourceImageFieldId).toBe("sourceImage");
    expect(asset.bindings.outputFieldId).toBe("enhancedImage");
    expect(asset.inputBindings.bindings.some((binding) => binding.inputId === "sourceImage")).toBeTrue();
    expect(asset.outputBindings.bindings.some((binding) => binding.targetType === "output-dataset")).toBeTrue();
  });

  it("exposes composition integrity and preview metadata", () => {
    const asset = createEnhanceUpscaleWorkflowAsset();

    expect(asset.composition.stages.map((stage) => stage.id)).toEqual([
      "stage.bind-inputs",
      "stage.transform",
      "stage.materialize-output",
    ]);
    expect(asset.composition.stages[1]?.steps[0]?.nodeKind).toBe("resize-upscale");
    expect(asset.preview.inspectableFields).toContain("qualityMetrics");
    expect(asset.preview.inspectableStageIds).toContain("stage.transform");
  });

  it("keeps configuration bounded", () => {
    expect(() => createEnhanceUpscaleWorkflowAsset({ configuration: { scaleFactor: 0.5 } })).toThrow();
    expect(() => createEnhanceUpscaleWorkflowAsset({ configuration: { denoise: 2 } })).toThrow();
  });
});
