import { describe, expect, it } from "bun:test";
import {
  buildImageManipulationDatasetInstanceRequests,
  ImageManipulationPrimaryWorkflowTemplateAssetId,
  ImageManipulationSystemTemplate,
  ImageManipulationSystemTemplateId,
} from "../ImageManipulationSystemTemplate";
import {
  ImageManipulationRuntimeTargets,
  validateImageManipulationSystemTemplate,
} from "../ImageManipulationSystemTemplateValidation";

describe("ImageManipulationSystemTemplate", () => {
  it("exposes a concrete system template contract with composition extension points", () => {
    expect(ImageManipulationSystemTemplate.templateId).toBe(ImageManipulationSystemTemplateId);
    expect(ImageManipulationSystemTemplate.systemAsset.assetId).toBe("asset:system:reference-image-manipulation");
    expect(ImageManipulationSystemTemplate.systemAsset.components.map((entry) => entry.alias)).toEqual([
      "input-image-dataset-asset",
      "output-image-dataset-asset",
      "reference-image-dataset-asset",
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

    expect(ImageManipulationSystemTemplate.systemAsset.executionMetadata?.runtime?.environment).toBe(
      ImageManipulationRuntimeTargets.runtimeEnvironment,
    );
    expect(ImageManipulationSystemTemplate.systemAsset.executionMetadata?.orchestration?.mode).toBe(
      ImageManipulationRuntimeTargets.orchestrationMode,
    );
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

  it("can include optional FaceID reference dataset provisioning when explicitly requested", () => {
    const requests = buildImageManipulationDatasetInstanceRequests("system:image-manipulation", {
      includeOptionalReferenceDatasets: true,
    });

    expect(requests).toHaveLength(3);
    expect(requests.map((entry) => entry.datasetAssetId)).toContain("asset:dataset:image-faceid-reference");
  });

  it("passes structural validation for required datasets, workflow, and runtime metadata", () => {
    const validation = validateImageManipulationSystemTemplate(ImageManipulationSystemTemplate);

    expect(validation.status).toBe("valid");
    expect(validation.errors).toHaveLength(0);
    expect(validation.metadata?.validatedTemplateId).toBe(ImageManipulationSystemTemplateId);
  });

  it("reports inspectable validation errors when required runtime metadata is missing", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      systemAsset: {
        ...ImageManipulationSystemTemplate.systemAsset,
        executionMetadata: {
          ...ImageManipulationSystemTemplate.systemAsset.executionMetadata,
          runtime: {
            ...ImageManipulationSystemTemplate.systemAsset.executionMetadata?.runtime,
            environment: "",
            requirements: [],
          },
        },
      },
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("runtime-environment-invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("runtime-capability-missing");
  });
});
