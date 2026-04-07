import { describe, expect, it } from "bun:test";
import { createBatchTransformWorkflowAsset } from "../BatchTransformWorkflowAsset";
import { createEnhanceUpscaleWorkflowAsset } from "../EnhanceUpscaleWorkflowAsset";
import { createImageToImageWorkflowAsset } from "../ImageToImageWorkflowAsset";
import { createRestyleWorkflowAsset } from "../RestyleWorkflowAsset";

describe("ImageWorkflowAssetPreview", () => {
  it("provides stable inspectable preview summaries across image workflow assets", () => {
    const assets = [
      createImageToImageWorkflowAsset(),
      createRestyleWorkflowAsset(),
      createEnhanceUpscaleWorkflowAsset(),
      createBatchTransformWorkflowAsset(),
    ];

    for (const asset of assets) {
      expect(asset.preview.workflowType).toBe("image-workflow");
      expect(asset.preview.intentType).toBe(asset.intentType);
      expect(asset.preview.inputSummary.length).toBeGreaterThan(0);
      expect(asset.preview.outputSummary.length).toBeGreaterThan(0);
      expect(asset.preview.boundedConfigurationSummary.length).toBeGreaterThan(0);
      expect(asset.preview.compositionSummary.stageCount).toBe(asset.composition.stages.length);
      expect(asset.preview.compositionSummary.inspectableStageIds).toEqual(asset.preview.inspectableStageIds);
      expect(asset.preview.compositionSummary.adapterBoundary.adapterId).toBe("image-workflow-execution-adapter");
    }
  });
});
