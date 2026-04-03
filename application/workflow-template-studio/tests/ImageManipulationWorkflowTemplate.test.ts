import { describe, expect, it } from "bun:test";
import { CoreImageStarterWorkflowTemplates } from "../CoreImageStarterWorkflowTemplates";
import {
  ImageManipulationFaceIdSubworkflowAssetId,
  ImageManipulationFaceIdSubworkflowVersionId,
  ImageManipulationWorkflowTemplate,
  ImageManipulationWorkflowTemplateAssetId,
  ImageManipulationWorkflowTemplateVersionId,
} from "../ImageManipulationWorkflowTemplate";
import {
  ComfyImageManipulationBaseGraphAssetId,
  ComfyImageManipulationBaseGraphVersionId,
} from "../../system-studio/ComfyImageManipulationBaseGraph";

describe("ImageManipulationWorkflowTemplate", () => {
  it("registers the default image manipulation workflow template in the starter catalog", () => {
    const template = CoreImageStarterWorkflowTemplates.find((entry) => entry.templateId === ImageManipulationWorkflowTemplateAssetId);

    expect(template?.versionId).toBe(ImageManipulationWorkflowTemplateVersionId);
    expect(template?.supportedIntent).toBe("image-to-image");
  });

  it("defines composition + dependency contracts for default runnable execution", () => {
    expect(ImageManipulationWorkflowTemplate.composition?.workflowInterfaces[0]?.workflowAssetId).toBe("asset:workflow:image-to-image");
    expect(ImageManipulationWorkflowTemplate.composition?.inputBindings.map((binding) => binding.templateInputId)).toEqual([
      "sourceImage",
      "instruction",
    ]);

    const outputBinding = ImageManipulationWorkflowTemplate.composition?.outputBindings[0];
    expect(outputBinding?.targetDatasetAssetId).toBe("asset:dataset:image-reference-output");

    const graphDependency = ImageManipulationWorkflowTemplate.workflowAssets.find((entry) => (
      entry.assetId === ComfyImageManipulationBaseGraphAssetId
    ));
    expect(graphDependency?.versionId).toBe(ComfyImageManipulationBaseGraphVersionId);

    expect(ImageManipulationWorkflowTemplate.metadata.baseGraphAssetId).toBe(ComfyImageManipulationBaseGraphAssetId);
    expect(ImageManipulationWorkflowTemplate.metadata.defaultExecutable).toBe("true");
  });

  it("ships defaults for required config parameters", () => {
    const requiredParameters = ImageManipulationWorkflowTemplate.parameters?.filter((parameter) => parameter.required) ?? [];
    const defaultById = new Map(ImageManipulationWorkflowTemplate.parameterDefaults.map((entry) => [entry.parameterId, entry.value] as const));

    for (const parameter of requiredParameters) {
      expect(defaultById.has(parameter.parameterId)).toBeTrue();
    }

    expect(defaultById.get("positivePrompt")).toBeTypeOf("string");
    expect(defaultById.get("checkpointModel")).toBe("system-default");
    expect(defaultById.get("vaeModel")).toBe("system-default");
  });

  it("keeps positive/negative prompt and model selection mappings inspectable", () => {
    const mappingById = new Map((ImageManipulationWorkflowTemplate.composition?.parameterMappings ?? [])
      .map((mapping) => [mapping.parameterId, mapping.workflowParameterId] as const));

    expect(mappingById.get("positivePrompt")).toBe("positivePrompt");
    expect(mappingById.get("negativePrompt")).toBe("negativePrompt");
    expect(mappingById.get("checkpointModel")).toBe("checkpointModel");
    expect(mappingById.get("vaeModel")).toBe("vaeModel");
  });

  it("composes FaceID as an optional subworkflow and keeps the non-FaceID path valid", () => {
    const interfaceByAssetId = new Map((ImageManipulationWorkflowTemplate.composition?.workflowInterfaces ?? [])
      .map((entry) => [entry.workflowAssetId, entry] as const));
    const faceIdInterface = interfaceByAssetId.get(ImageManipulationFaceIdSubworkflowAssetId);
    expect(faceIdInterface?.workflowAssetVersionId).toBe(ImageManipulationFaceIdSubworkflowVersionId);
    expect(faceIdInterface?.parameterIds).toEqual([
      "faceIdEnabled",
      "referenceBindings",
      "weight",
      "startStepFraction",
      "endStepFraction",
    ]);

    const mappedFaceIdControls = (ImageManipulationWorkflowTemplate.composition?.parameterMappings ?? [])
      .filter((entry) => entry.workflowAssetId === ImageManipulationFaceIdSubworkflowAssetId)
      .map((entry) => entry.parameterId);
    expect(mappedFaceIdControls).toEqual([
      "faceIdEnabled",
      "faceIdReferenceBindings",
      "faceIdWeight",
      "faceIdStartStepFraction",
      "faceIdEndStepFraction",
    ]);

    const faceIdEnabledDefault = ImageManipulationWorkflowTemplate.parameterDefaults
      .find((entry) => entry.parameterId === "faceIdEnabled");
    expect(faceIdEnabledDefault?.value).toBeFalse();

    const primaryInterface = interfaceByAssetId.get("asset:workflow:image-to-image");
    expect(primaryInterface?.inputIds).toEqual(["sourceImage", "instruction"]);
  });

  it("binds FaceID dataset references through logical controls instead of raw paths", () => {
    const referenceDefaults = ImageManipulationWorkflowTemplate.parameterDefaults
      .find((entry) => entry.parameterId === "faceIdReferenceBindings");
    expect(Array.isArray(referenceDefaults?.value)).toBeTrue();
    expect((referenceDefaults?.value as Array<Record<string, string>>)[0]).toEqual(expect.objectContaining({
      datasetBindingId: "faceid-reference",
      datasetAssetId: "asset:dataset:image-faceid-reference",
    }));

    const mapping = ImageManipulationWorkflowTemplate.composition?.systemContextMappings.find((entry) => (
      entry.mappingId === "image-manipulation.context.faceid-references"
    ));
    expect(mapping?.workflowAssetId).toBe(ImageManipulationFaceIdSubworkflowAssetId);
    expect(mapping?.targetId).toBe("referenceBindings");
  });
});
