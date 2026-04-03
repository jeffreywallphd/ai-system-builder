import { describe, expect, it } from "bun:test";
import { CoreImageStarterWorkflowTemplates } from "../CoreImageStarterWorkflowTemplates";
import {
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
  });
});
