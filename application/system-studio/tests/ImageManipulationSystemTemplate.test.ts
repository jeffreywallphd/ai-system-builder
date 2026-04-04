import { describe, expect, it } from "bun:test";
import {
  buildImageManipulationDatasetInstanceRequests,
  ImageManipulationPrimaryWorkflowTemplateAssetId,
  ImageManipulationSystemTemplate,
  ImageManipulationSystemTemplateId,
} from "../ImageManipulationSystemTemplate";
import {
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../../dataset-studio/ImageManipulationDatasetAssets";
import { getDataStudioAssetRegistry } from "../../dataset-studio/DataStudioAssetRegistryCatalog";
import { CoreImageStarterWorkflowTemplates } from "../../workflow-template-studio/CoreImageStarterWorkflowTemplates";
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
    expect(ImageManipulationSystemTemplate.compositionBindings.propertyMappingBindingId).toBe("asset:config-profile:comfy-image-manipulation-property-mapping");
    expect(ImageManipulationSystemTemplate.compositionBindings.inputDatasetWorkflowBindingId).toBe("asset:config-profile:comfy-image-manipulation-dataset-binding");
    expect(ImageManipulationSystemTemplate.compositionBindings.pageBindingId).toBe("system-page:image-manipulation");
    expect(ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId).toBe("runtime:image-manipulation");
    expect(ImageManipulationSystemTemplate.compositionBindings.runtimeInstallationBindingId).toBe("runtime-installation:comfyui");

    expect(ImageManipulationSystemTemplate.primaryWorkflowAsset.datasetBindings.inputDatasetBindingAssetId).toBe(
      "asset:config-profile:comfy-image-manipulation-dataset-binding",
    );
    expect(ImageManipulationSystemTemplate.primaryWorkflowAsset.datasetBindings.propertyMappingAssetId).toBe(
      "asset:config-profile:comfy-image-manipulation-property-mapping",
    );
    expect(ImageManipulationSystemTemplate.runtimeInstallationAsset.assetId).toBe(
      "asset:config-profile:comfyui-runtime-installation",
    );

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

  it("resolves composed datasets and workflow through the shared registries used by the platform", () => {
    const registry = getDataStudioAssetRegistry();
    const inputBinding = ImageManipulationSystemTemplate.datasetInstances.find((entry) => (
      entry.bindingId === ImageManipulationSystemTemplate.compositionBindings.inputDatasetBindingId
    ));
    const outputBinding = ImageManipulationSystemTemplate.datasetInstances.find((entry) => (
      entry.bindingId === ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId
    ));
    const optionalReferenceBinding = ImageManipulationSystemTemplate.datasetInstances.find((entry) => (
      entry.bindingId === ImageManipulationSystemTemplate.compositionBindings.optionalReferenceDatasetBindingId
    ));

    expect(inputBinding?.datasetAssetId).toBe(ImageManipulationInputDatasetAssetId);
    expect(outputBinding?.datasetAssetId).toBe(ImageManipulationOutputDatasetAssetId);
    expect(optionalReferenceBinding?.datasetAssetId).toBe(ImageManipulationFaceIdReferenceDatasetAssetId);

    expect(registry.get({ assetId: inputBinding?.datasetAssetId ?? "" })).toBeDefined();
    expect(registry.get({ assetId: outputBinding?.datasetAssetId ?? "" })).toBeDefined();
    expect(registry.get({ assetId: optionalReferenceBinding?.datasetAssetId ?? "" })).toBeDefined();

    const workflowTemplate = CoreImageStarterWorkflowTemplates.find((template) => (
      template.templateId === ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId
    ));
    expect(workflowTemplate?.templateId).toBe(ImageManipulationPrimaryWorkflowTemplateAssetId);
    expect(workflowTemplate?.versionId).toBe(ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId);
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

  it("fails validation when required output dataset binding is missing", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      datasetInstances: ImageManipulationSystemTemplate.datasetInstances.filter((entry) => (
        entry.bindingId !== ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId
      )),
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("output-dataset-binding-missing");
  });

  it("fails validation when required workflow binding is missing or invalid", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      primaryWorkflowAsset: {
        ...ImageManipulationSystemTemplate.primaryWorkflowAsset,
        workflowTemplateAssetId: "",
      },
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("workflow-template-binding-invalid");
  });

  it("fails validation when runtime installation asset reference is replaced", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      runtimeInstallationAsset: {
        ...ImageManipulationSystemTemplate.runtimeInstallationAsset,
        assetId: "asset:config-profile:other-runtime-installation",
      },
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("runtime-installation-asset-invalid");
  });

  it("fails validation when workflow mapping assets are replaced", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      primaryWorkflowAsset: {
        ...ImageManipulationSystemTemplate.primaryWorkflowAsset,
        datasetBindings: {
          ...ImageManipulationSystemTemplate.primaryWorkflowAsset.datasetBindings,
          inputDatasetBindingAssetId: "asset:config-profile:other-dataset-binding",
          propertyMappingAssetId: "asset:config-profile:other-property-mapping",
        },
      },
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("workflow-input-dataset-binding-asset-invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("workflow-property-mapping-asset-invalid");
  });

  it("fails validation when execution runtime metadata is removed", () => {
    const invalid = {
      ...ImageManipulationSystemTemplate,
      systemAsset: {
        ...ImageManipulationSystemTemplate.systemAsset,
        executionMetadata: undefined,
      },
    };

    const validation = validateImageManipulationSystemTemplate(invalid);

    expect(validation.status).toBe("invalid");
    expect(validation.errors.map((entry) => entry.code)).toContain("execution-metadata-missing");
  });
});
