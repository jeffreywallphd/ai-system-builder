import { describe, expect, it } from "bun:test";
import { assembleWorkflowExecutionContext } from "../WorkflowExecutionContextAssemblyService";

describe("assembleWorkflowExecutionContext", () => {
  it("resolves explicit system form and selected-image bindings for runtime inputs", () => {
    const result = assembleWorkflowExecutionContext({
      inputBindings: [
        {
          inputId: "prompt-input",
          sourceType: "runtime-parameter",
          required: true,
          valueType: "string",
          bindingKey: "inputs.prompt",
          metadata: {
            systemInputBinding: {
              sources: [
                {
                  sourceId: "form-prompt",
                  kind: "ui-form-value",
                  formKey: "prompt",
                  priority: 1,
                  required: true,
                },
              ],
            },
          },
        },
        {
          inputId: "image-input",
          sourceType: "runtime-parameter",
          required: true,
          valueType: "object",
          bindingKey: "inputs.image",
          metadata: {
            systemInputBinding: {
              sources: [
                {
                  sourceId: "selected-asset",
                  kind: "selected-image",
                  path: "assetRef",
                  priority: 1,
                  required: true,
                },
              ],
            },
          },
        },
      ],
      context: {
        metadata: {
          systemFormValues: {
            prompt: "Repair scratches",
          },
          selectedImage: {
            assetRef: {
              assetId: "asset:image:12",
              versionId: "asset:image:12:v3",
            },
            record: {
              recordId: "record:image:12",
            },
          },
        },
      },
    });

    expect(result.context.resolvedInputValues).toEqual({
      "prompt-input": "Repair scratches",
      "image-input": {
        assetId: "asset:image:12",
        versionId: "asset:image:12:v3",
      },
    });
    expect(result.context.resolvedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ inputId: "prompt-input", resolutionSource: "ui-form-value" }),
      expect.objectContaining({ inputId: "image-input", resolutionSource: "selected-image-context" }),
    ]));
  });

  it("returns explicit invalid binding configuration issues", () => {
    const result = assembleWorkflowExecutionContext({
      inputBindings: [{
        inputId: "broken",
        sourceType: "runtime-parameter",
        required: true,
        bindingKey: "inputs.broken",
        metadata: {
          systemInputBinding: {
            sources: [],
          },
        },
      }],
      context: {},
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "invalid-binding-configuration",
        severity: "error",
      }),
    ]));
    expect(result.context.unresolvedInputs).toEqual([expect.objectContaining({ inputId: "broken", required: true })]);
  });

  it("resolves dataset-instance bindings from declared dataset references in metadata", () => {
    const result = assembleWorkflowExecutionContext({
      inputBindings: [{
        inputId: "history-images",
        sourceType: "runtime-parameter",
        required: true,
        valueType: "array",
        bindingKey: "inputs.historyImages",
        metadata: {
          systemInputBinding: {
            bindingId: "binding.history-images",
            sources: [{
              sourceId: "dataset-history",
              kind: "dataset-instance-reference",
              purpose: "history",
              priority: 1,
              required: true,
              resolution: {
                shape: "collection",
              },
            }],
          },
        },
      }],
      context: {
        metadata: {
          datasetInstanceReferences: [{
            instanceId: "instance:history",
            purpose: "history",
            records: [
              { recordId: "record:1", value: { assetId: "asset:image:1" } },
              { recordId: "record:2", value: { assetId: "asset:image:2" } },
            ],
          }],
        },
      },
    });

    expect(result.context.resolvedInputs).toEqual([expect.objectContaining({
      inputId: "history-images",
      resolutionSource: "dataset-instance-reference",
    })]);
    expect(result.context.resolvedRuntimeInputs.historyImages).toEqual([
      { assetId: "asset:image:1" },
      { assetId: "asset:image:2" },
    ]);
  });

  it("resolves reusable authored bindings end-to-end across form, trigger, dataset, selected-image, and constants/defaults", () => {
    const result = assembleWorkflowExecutionContext({
      inputBindings: [
        {
          inputId: "instruction",
          sourceType: "runtime-parameter",
          required: true,
          valueType: "string",
          bindingKey: "inputs.instruction",
          metadata: {
            systemInputBinding: {
              bindingId: "binding.instruction",
              sources: [
                { sourceId: "form", kind: "ui-form-value", formKey: "instruction", priority: 1, required: true },
                { sourceId: "trigger", kind: "trigger-payload", payloadKey: "instruction", priority: 2 },
              ],
            },
          },
        },
        {
          inputId: "sourceImage",
          sourceType: "runtime-parameter",
          required: true,
          valueType: "object",
          bindingKey: "inputs.sourceImage",
          metadata: {
            systemInputBinding: {
              bindingId: "binding.source-image",
              sources: [
                { sourceId: "selected", kind: "selected-image", path: "assetRef", priority: 1, required: true },
                { sourceId: "dataset", kind: "dataset-instance-reference", purpose: "active-input", priority: 2, resolution: { shape: "record", index: 0, fieldPath: "assetRef" } },
              ],
            },
          },
        },
        {
          inputId: "stylePreset",
          sourceType: "runtime-parameter",
          required: false,
          valueType: "string",
          bindingKey: "inputs.stylePreset",
          defaultValue: "neutral",
          metadata: {
            systemInputBinding: {
              bindingId: "binding.style-preset",
              sources: [
                { sourceId: "runtime", kind: "runtime-parameter", parameterKey: "stylePreset", priority: 1 },
                { sourceId: "constant", kind: "constant-value", value: "cinematic", priority: 2 },
              ],
            },
          },
        },
      ],
      context: {
        inputValues: {},
        triggerPayload: { instruction: "trigger fallback instruction" },
        metadata: {
          systemFormValues: { instruction: "form instruction" },
          selectedImage: { assetRef: { assetId: "asset:image:selected" } },
          datasetInstances: [{
            instanceId: "instance:active",
            purpose: "active-input",
            records: [{ recordId: "record:0", value: { assetRef: { assetId: "asset:image:from-dataset" } } }],
          }],
        },
      },
    });

    expect(result.context.resolvedInputValues).toEqual({
      instruction: "form instruction",
      sourceImage: { assetId: "asset:image:selected" },
      stylePreset: "cinematic",
    });
    expect(result.context.resolvedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ inputId: "instruction", resolutionSource: "ui-form-value" }),
      expect.objectContaining({ inputId: "sourceImage", resolutionSource: "selected-image-context" }),
      expect.objectContaining({ inputId: "stylePreset", resolutionSource: "runtime-parameter" }),
    ]));
    expect(result.issues.some((issue) => `${issue.code}:${issue.message}`.toLowerCase().includes("comfy"))).toBeFalse();
  });
});
