import { describe, expect, it } from "bun:test";
import {
  createWorkflowInputBindingDescriptor,
  WorkflowInputBindingSourceKinds,
} from "../../../domain/workflow-studio/WorkflowInputBindingDomain";
import { resolveWorkflowInputBindings } from "../WorkflowInputBindingResolutionService";

describe("resolveWorkflowInputBindings", () => {
  it("resolves using deterministic precedence across form, runtime, and constant sources", () => {
    const result = resolveWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.prompt",
          inputId: "prompt",
          required: true,
          sources: [
            {
              sourceId: "form",
              kind: WorkflowInputBindingSourceKinds.uiFormValue,
              formKey: "prompt",
              priority: 1,
            },
            {
              sourceId: "runtime",
              kind: WorkflowInputBindingSourceKinds.runtimeParameter,
              parameterKey: "prompt",
              priority: 2,
            },
            {
              sourceId: "fallback",
              kind: WorkflowInputBindingSourceKinds.constantValue,
              value: "default-prompt",
              priority: 3,
            },
          ],
        }),
      ],
      context: {
        uiFormValues: { prompt: "form-prompt" },
        runtimeParameters: { prompt: "runtime-prompt" },
      },
    });

    expect(result.resolvedValues.prompt).toBe("form-prompt");
    expect(result.records[0]?.sourceId).toBe("form");
    expect(result.diagnostics).toEqual([]);
  });

  it("resolves dataset instance and selected image sources", () => {
    const result = resolveWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.selected-image",
          inputId: "sourceImage",
          required: true,
          sources: [
            {
              sourceId: "selected",
              kind: WorkflowInputBindingSourceKinds.selectedImage,
              path: "assetRef",
              priority: 1,
            },
          ],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.dataset-instance",
          inputId: "targetDataset",
          required: true,
          sources: [
            {
              sourceId: "dataset-target",
              kind: WorkflowInputBindingSourceKinds.datasetInstanceReference,
              instanceId: "instance:images",
              priority: 1,
            },
          ],
        }),
      ],
      context: {
        selectedImage: {
          assetRef: {
            assetId: "asset:image:source-1",
            versionId: "asset:image:source-1:v1",
          },
        },
        datasetInstances: [
          {
            systemId: "system:image-edit",
            instanceId: "instance:images",
            datasetAssetId: "asset:dataset:images",
            datasetVersionId: "asset:dataset:images:v4",
            purpose: "output",
          },
        ],
      },
    });

    expect(result.records).toEqual([
      expect.objectContaining({
        inputId: "sourceImage",
        sourceKind: WorkflowInputBindingSourceKinds.selectedImage,
      }),
      expect.objectContaining({
        inputId: "targetDataset",
        sourceKind: WorkflowInputBindingSourceKinds.datasetInstanceReference,
      }),
    ]);
    expect(result.resolvedValues.targetDataset).toEqual({
      systemId: "system:image-edit",
      instanceId: "instance:images",
      datasetAssetId: "asset:dataset:images",
      datasetVersionId: "asset:dataset:images:v4",
      purpose: "output",
    });
  });

  it("emits diagnostics for missing required inputs and uses defaults for optional inputs", () => {
    const result = resolveWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.required",
          inputId: "requiredPrompt",
          required: true,
          sources: [
            {
              sourceId: "runtime",
              kind: WorkflowInputBindingSourceKinds.runtimeParameter,
              parameterKey: "requiredPrompt",
              priority: 1,
            },
          ],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.optional",
          inputId: "temperature",
          required: false,
          defaultValue: 0.4,
          sources: [
            {
              sourceId: "runtime-optional",
              kind: WorkflowInputBindingSourceKinds.runtimeParameter,
              parameterKey: "temperature",
              priority: 1,
            },
          ],
        }),
      ],
      context: {
        runtimeParameters: {},
      },
    });

    expect(result.records).toEqual([
      expect.objectContaining({ inputId: "requiredPrompt", resolved: false }),
      expect.objectContaining({ inputId: "temperature", resolved: true, resolutionKind: "default", value: 0.4 }),
    ]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        inputId: "requiredPrompt",
        severity: "error",
        code: "unresolved-required-input",
      }),
    ]);
  });

  it("surfaces missing form fields and type mismatches for form-bound values", () => {
    const result = resolveWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.form-number",
          inputId: "seed",
          required: true,
          valueType: "number",
          sources: [
            {
              sourceId: "ui-seed",
              kind: WorkflowInputBindingSourceKinds.uiFormValue,
              formKey: "seed",
              priority: 1,
              required: true,
            },
          ],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.form-missing",
          inputId: "strength",
          required: true,
          valueType: "number",
          sources: [
            {
              sourceId: "ui-strength",
              kind: WorkflowInputBindingSourceKinds.uiFormValue,
              formKey: "strength",
              priority: 1,
              required: true,
            },
          ],
        }),
      ],
      context: {
        uiFormValues: {
          seed: "not-a-number",
        },
      },
    });

    expect(result.records).toEqual([
      expect.objectContaining({ inputId: "seed", resolved: false }),
      expect.objectContaining({ inputId: "strength", resolved: false }),
    ]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "type-mismatch",
        inputId: "seed",
      }),
      expect.objectContaining({
        code: "missing-field-reference",
        inputId: "strength",
      }),
    ]));
  });

  it("surfaces invalid selected-image references when a selection exists but path is wrong", () => {
    const result = resolveWorkflowInputBindings({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.selected-image-path",
          inputId: "imageLocator",
          required: true,
          sources: [
            {
              sourceId: "selection-path",
              kind: WorkflowInputBindingSourceKinds.selectedImage,
              path: "locator.path",
              priority: 1,
              required: true,
            },
          ],
        }),
      ],
      context: {
        selectedImage: {
          assetRef: {
            assetId: "asset:image:selected",
          },
        },
      },
    });

    expect(result.records).toEqual([expect.objectContaining({ inputId: "imageLocator", resolved: false })]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "invalid-selection-reference",
        inputId: "imageLocator",
      }),
      expect.objectContaining({
        code: "unresolved-required-input",
        inputId: "imageLocator",
      }),
    ]));
  });
});
