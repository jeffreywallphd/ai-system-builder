import { describe, expect, it } from "bun:test";
import { createBatchTransformWorkflowAsset, BatchTransformWorkflowAssetId } from "../BatchTransformWorkflowAsset";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";

describe("BatchTransformWorkflowAsset", () => {
  it("conforms to high-level batch contract with bounded configuration", () => {
    const asset = createBatchTransformWorkflowAsset({
      configuration: {
        concurrency: 6,
        onItemFailure: "halt",
        groupOutputsBy: "source-group",
        resultCountPerItem: 2,
      },
    });

    expect(asset.id).toBe(BatchTransformWorkflowAssetId);
    expect(asset.intentType).toBe(ImageWorkflowAssetIntentTypes.batchTransform);
    expect(asset.contract.identity.intentType).toBe(ImageWorkflowAssetIntentTypes.batchTransform);
    expect(asset.configuration.onItemFailure).toBe("halt");
    expect(asset.bindings.batchItemsFieldId).toBe("batchItems");
    expect(asset.outputMapping.mode).toBe("per-item");
    expect(asset.outputMapping.lineageField).toBe("lineage");
    expect(asset.inputBindings.bindings.some((binding) => binding.inputId === "batchItems")).toBeTrue();
    expect(asset.outputBindings.bindings.some((binding) => binding.targetType === "output-dataset")).toBeTrue();
  });

  it("preserves composition integrity and batch preview/inspection metadata", () => {
    const asset = createBatchTransformWorkflowAsset();
    expect(asset.composition.stages.map((stage) => stage.id)).toEqual([
      "stage.bind-inputs",
      "stage.prepare-conditioning",
      "stage.transform",
      "stage.materialize-output",
    ]);
    expect(asset.composition.bindings.inputs.some((binding) => binding.fieldId === "batchItems")).toBeTrue();
    expect(asset.preview.inspectableFields).toContain("batchSummary");
    expect(asset.preview.compositionSummary.stageCount).toBe(4);
    expect(asset.preview.compositionSummary.adapterBoundary.adapterId).toBe("image-workflow-execution-adapter");
  });

  it("keeps configuration bounded", () => {
    expect(() => createBatchTransformWorkflowAsset({ configuration: { concurrency: 0 } })).toThrow();
    expect(() => createBatchTransformWorkflowAsset({ configuration: { resultCountPerItem: 8 } })).toThrow();
  });
});
