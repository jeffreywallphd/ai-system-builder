import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "../ImageManipulationSystemTemplate";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import {
  ImageManipulationTemplateValidationCategories,
  validateImageManipulationTemplateCompleteness,
} from "../ImageManipulationSystemCompletenessValidationService";
import { SystemBuildTemplateCatalog } from "../SystemBuildTemplateCatalog";

describe("ImageManipulationSystemCompletenessValidationService", () => {
  it("returns runnable structured validation results for the default template slice", () => {
    const result = validateImageManipulationTemplateCompleteness({
      template: ImageManipulationSystemTemplate,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      buildTemplateContent: SystemBuildTemplateCatalog[0]?.draftSeed.contentTemplate,
    });

    expect(result.status).toBe("valid");
    expect(result.runnable).toBeTrue();
    expect(result.issues).toHaveLength(0);
    expect(result.categories[ImageManipulationTemplateValidationCategories.runnableDefaults].errors).toBe(0);
    expect(result.assetValidation.status).toBe("valid");
  });

  it("fails when build-template page wiring does not resolve the runtime page asset", () => {
    const result = validateImageManipulationTemplateCompleteness({
      buildTemplateContent: JSON.stringify({
        systemSpec: {
          canvasAuthoring: {
            pageLayouts: [{
              pageId: "page-1",
              panels: [{
                panelId: "panel-1",
                content: {
                  kind: "embedded-studio",
                  studioAssetId: "system-page:other",
                },
              }],
            }],
          },
        },
      }),
    });

    expect(result.status).toBe("invalid");
    expect(result.runnable).toBeFalse();
    expect(result.issues.map((entry) => entry.code)).toContain("page-binding-unresolved-in-build-template");
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageAsset].errors).toBeGreaterThan(0);
  });

  it("fails when output storage references depend on raw paths instead of logical storage references", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetStorageInstanceRef: "C:\\runtime\\output",
          })),
        },
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("workflow-output-storage-instance-ref-raw-path-forbidden");
    expect(result.categories[ImageManipulationTemplateValidationCategories.storageBindings].errors).toBeGreaterThan(0);
  });

  it("fails when required runnable workflow defaults are missing", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        parameterDefaults: ImageManipulationWorkflowTemplate.parameterDefaults.filter((entry) => (
          entry.parameterId !== "checkpointModel"
        )),
        parameters: ImageManipulationWorkflowTemplate.parameters?.map((parameter) => (
          parameter.parameterId === "checkpointModel"
            ? { ...parameter, defaultValue: undefined }
            : parameter
        )),
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("workflow-required-default-parameter-missing");
    expect(result.categories[ImageManipulationTemplateValidationCategories.runnableDefaults].errors).toBeGreaterThan(0);
  });
});
