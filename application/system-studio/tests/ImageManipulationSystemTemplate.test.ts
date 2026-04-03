import { describe, expect, it } from "bun:test";
import {
  buildImageManipulationDatasetInstanceRequests,
  ImageManipulationPrimaryWorkflowTemplateAssetId,
  ImageManipulationSystemTemplate,
  ImageManipulationSystemTemplateId,
} from "../ImageManipulationSystemTemplate";

describe("ImageManipulationSystemTemplate", () => {
  it("exposes a concrete system template contract with composition extension points", () => {
    expect(ImageManipulationSystemTemplate.templateId).toBe(ImageManipulationSystemTemplateId);
    expect(ImageManipulationSystemTemplate.systemAsset.assetId).toBe("asset:system:reference-image-manipulation");
    expect(ImageManipulationSystemTemplate.systemAsset.components.map((entry) => entry.alias)).toEqual([
      "input-image-dataset-asset",
      "output-image-dataset-asset",
      "reference-workflow",
      "reference-ui",
    ]);
    expect(ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId).toBe(
      ImageManipulationPrimaryWorkflowTemplateAssetId,
    );

    expect(ImageManipulationSystemTemplate.compositionBindings.inputDatasetBindingId).toBe("input-image-dataset");
    expect(ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId).toBe("output-image-dataset");
    expect(ImageManipulationSystemTemplate.compositionBindings.optionalReferenceDatasetBindingId).toBe("reference-image-dataset");
    expect(ImageManipulationSystemTemplate.compositionBindings.workflowTemplateBindingId).toBe("primary-image-workflow");
    expect(ImageManipulationSystemTemplate.compositionBindings.propertySchemaBindingId).toBe("property-schema:image-manipulation");
    expect(ImageManipulationSystemTemplate.compositionBindings.pageBindingId).toBe("system-page:image-manipulation");
    expect(ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId).toBe("runtime:image-manipulation");
  });

  it("builds runtime dataset requests for system-managed dataset provisioning", () => {
    const requests = buildImageManipulationDatasetInstanceRequests("system:image-manipulation");

    expect(requests).toHaveLength(2);
    expect(requests[0]?.seedMetadata?.templateId).toBe(ImageManipulationSystemTemplateId);
    expect(requests.map((entry) => entry.datasetAssetId)).toEqual([
      "asset:dataset:image-reference-input",
      "asset:dataset:image-reference-output",
    ]);
  });
});
