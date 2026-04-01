import { describe, expect, it } from "bun:test";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";
import { createRestyleWorkflowAsset, RestyleWorkflowAssetId } from "../RestyleWorkflowAsset";

describe("RestyleWorkflowAsset", () => {
  it("conforms to the high-level contract with bounded config", () => {
    const asset = createRestyleWorkflowAsset({
      configuration: {
        styleStrength: 0.8,
        variationStrength: 0.4,
        preserveFaces: false,
      },
    });

    expect(asset.id).toBe(RestyleWorkflowAssetId);
    expect(asset.intentType).toBe(ImageWorkflowAssetIntentTypes.restyle);
    expect(asset.contract.identity.intentType).toBe(ImageWorkflowAssetIntentTypes.restyle);
    expect(asset.configuration.styleStrength).toBe(0.8);
    expect(asset.bindings.sourceImageFieldId).toBe("sourceImage");
    expect(asset.bindings.stylePresetFieldId).toBe("stylePreset");
    expect(asset.bindings.outputFieldId).toBe("images");
    expect(asset.inputBindings.bindings.some((binding) => binding.inputId === "stylePreset")).toBeTrue();
  });

  it("exposes reusable composition and preview metadata", () => {
    const asset = createRestyleWorkflowAsset();

    expect(asset.composition.stages.map((stage) => stage.id)).toEqual([
      "stage.bind-inputs",
      "stage.prepare-conditioning",
      "stage.transform",
      "stage.materialize-output",
    ]);
    expect(asset.composition.bindings.inputs.some((binding) => binding.fieldId === "stylePreset")).toBeTrue();
    expect(asset.preview.inspectableFields).toContain("styleSummary");
    expect(asset.preview.inspectableStageIds).toContain("stage.transform");
  });

  it("keeps configuration bounded", () => {
    expect(() => createRestyleWorkflowAsset({ configuration: { styleStrength: 1.5 } })).toThrow();
    expect(() => createRestyleWorkflowAsset({ configuration: { variationStrength: -0.1 } })).toThrow();
  });
});
