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
    expect(result.categories[ImageManipulationTemplateValidationCategories.runtimeDependencyReadiness].errors).toBe(0);
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

  it("fails story 10.3 wiring when runtime page run action binding is missing", () => {
    const result = validateImageManipulationTemplateCompleteness({
      template: {
        ...ImageManipulationSystemTemplate,
        uiBindingBoundary: {
          ...ImageManipulationSystemTemplate.uiBindingBoundary,
          emits: ImageManipulationSystemTemplate.uiBindingBoundary.emits.filter((eventId) => eventId !== "runRequested"),
        },
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("page-execution-action-binding-missing");
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageWorkflowRuntimeWiring].errors).toBeGreaterThan(0);
  });

  it("fails story 10.3 wiring when execution schema field is not mapped into workflow parameter overrides", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          parameterMappings: ImageManipulationWorkflowTemplate.composition!.parameterMappings.filter((entry) => (
            entry.parameterId !== "positivePrompt"
          )),
        },
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("schema-field-workflow-mapping-missing");
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageWorkflowRuntimeWiring].errors).toBeGreaterThan(0);
  });

  it("fails story 10.3 wiring when output dataset target is not aligned with preview/gallery dataset binding", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetDatasetAssetId: "asset:dataset:not-output",
          })),
        },
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("execution-output-target-dataset-mismatch");
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageWorkflowRuntimeWiring].errors).toBeGreaterThan(0);
  });

  it("fails story 10.4 compatibility when workflow output storage reference shape is incomplete", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetStorageInstanceRef: "",
          })),
        },
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("storage-reference-shape-incomplete");
    expect(result.categories[ImageManipulationTemplateValidationCategories.sharedStorageCompatibility].errors).toBeGreaterThan(0);
  });

  it("fails story 10.4 compatibility when dataset binding assumes a systems path", () => {
    const result = validateImageManipulationTemplateCompleteness({
      template: {
        ...ImageManipulationSystemTemplate,
        datasetInstances: ImageManipulationSystemTemplate.datasetInstances.map((entry) => (
          entry.bindingId === "output-image-dataset"
            ? { ...entry, instanceId: "/systems/system-a/output" }
            : entry
        )),
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.issues.map((entry) => entry.code)).toContain("dataset-binding-system-path-assumption-forbidden");
    expect(result.categories[ImageManipulationTemplateValidationCategories.sharedStorageCompatibility].errors).toBeGreaterThan(0);
  });
});
