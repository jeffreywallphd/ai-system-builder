import { describe, expect, it } from "bun:test";
import { createWorkflowInputBindingDescriptor, WorkflowInputBindingSourceKinds } from "../../../domain/workflow-studio/WorkflowInputBindingDomain";
import { previewWorkflowInputBindings } from "../WorkflowInputBindingPreviewService";

describe("previewWorkflowInputBindings", () => {
  it("returns inspectable resolved previews with source and value summaries", () => {
    const preview = previewWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.prompt",
          inputId: "instruction",
          required: false,
          valueType: "string",
          sources: [
            { sourceId: "form", kind: WorkflowInputBindingSourceKinds.uiFormValue, formKey: "instruction", priority: 1 },
          ],
        }),
      ],
      context: {
        uiFormValues: { instruction: "restyle in watercolor" },
      },
    });

    expect(preview.items[0]?.resolved).toBeTrue();
    expect(preview.items[0]?.selectedSourceId).toBe("form");
    expect(preview.items[0]?.valueSummary?.shape).toBe("string");
    expect(preview.unresolvedItems).toEqual([]);
  });

  it("reports partially resolved previews and unresolved required inputs", () => {
    const preview = previewWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.source",
          inputId: "sourceImage",
          required: true,
          sources: [
            { sourceId: "selected", kind: WorkflowInputBindingSourceKinds.selectedImage, path: "assetRef", priority: 1, required: true },
          ],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.prompt",
          inputId: "instruction",
          required: false,
          defaultValue: "",
          sources: [
            { sourceId: "runtime", kind: WorkflowInputBindingSourceKinds.runtimeParameter, parameterKey: "instruction", priority: 1 },
            { sourceId: "fallback", kind: WorkflowInputBindingSourceKinds.constantValue, value: "", priority: 2 },
          ],
        }),
      ],
      context: {
        runtimeParameters: {},
      },
    });

    expect(preview.items.find((item) => item.bindingId === "binding.prompt")?.resolved).toBeTrue();
    expect(preview.unresolvedItems).toEqual([{ bindingId: "binding.source", inputId: "sourceImage", required: true }]);
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "unresolved-required-input")).toBeTrue();
  });

  it("surfaces invalid binding diagnostics in preview output", () => {
    const preview = previewWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.dataset.invalid",
          inputId: "batchItems",
          required: true,
          valueType: "array",
          sources: [
            {
              sourceId: "dataset-missing-target",
              kind: WorkflowInputBindingSourceKinds.datasetInstanceReference,
              priority: 1,
              required: true,
            },
          ],
        }),
      ],
      context: {
        datasetInstances: [],
      },
    });

    expect(preview.items[0]?.resolved).toBeFalse();
    expect(preview.items[0]?.diagnostics.some((diagnostic) => diagnostic.code === "invalid-binding-configuration")).toBeTrue();
    expect(preview.items[0]?.diagnostics.some((diagnostic) => diagnostic.code === "dataset-instance-missing")).toBeTrue();
  });

  it("supports inspectable preview coverage for dataset + selected image + constant fallback flows", () => {
    const preview = previewWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.sourceImage",
          inputId: "sourceImage",
          required: true,
          valueType: "object",
          sources: [
            { sourceId: "selected", kind: WorkflowInputBindingSourceKinds.selectedImage, path: "assetRef", priority: 1 },
            { sourceId: "dataset", kind: WorkflowInputBindingSourceKinds.datasetInstanceReference, purpose: "active-input", priority: 2, resolution: { shape: "record", index: 0, fieldPath: "assetRef" } },
          ],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.stylePreset",
          inputId: "stylePreset",
          required: false,
          valueType: "string",
          sources: [
            { sourceId: "runtime", kind: WorkflowInputBindingSourceKinds.runtimeParameter, parameterKey: "stylePreset", priority: 1 },
            { sourceId: "constant", kind: WorkflowInputBindingSourceKinds.constantValue, value: "cinematic", priority: 2 },
          ],
        }),
      ],
      context: {
        runtimeParameters: {},
        selectedImage: { assetRef: { assetId: "asset:image:selected" } },
        datasetInstances: [{
          instanceId: "instance:active",
          purpose: "active-input",
          records: [{ recordId: "record:0", value: { assetRef: { assetId: "asset:image:from-dataset" } } }],
        }],
      },
    });

    expect(preview.items.find((item) => item.inputId === "sourceImage")?.resolved).toBeTrue();
    expect(preview.items.find((item) => item.inputId === "stylePreset")?.valueSummary?.summary).toBe("cinematic");
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "source-value-missing")).toBeFalse();
  });
});
