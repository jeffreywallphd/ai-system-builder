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

  it("maps image studio handoff runtime context into dataset + selected-image binding resolution", () => {
    const result = assembleWorkflowExecutionContext({
      inputBindings: [{
        inputId: "sourceImage",
        sourceType: "runtime-parameter",
        required: true,
        valueType: "object",
        bindingKey: "inputs.sourceImage",
        metadata: {
          systemInputBinding: {
            bindingId: "binding.source-image",
            sources: [{
              sourceId: "handoff-selected",
              kind: "selected-image",
              path: "assetRef",
              priority: 1,
              required: true,
            }],
          },
        },
      }, {
        inputId: "historyCollection",
        sourceType: "runtime-parameter",
        required: true,
        valueType: "array",
        bindingKey: "inputs.historyCollection",
        metadata: {
          systemInputBinding: {
            bindingId: "binding.history-collection",
            sources: [{
              sourceId: "handoff-history",
              kind: "dataset-instance-reference",
              purpose: "history",
              priority: 1,
              required: true,
              resolution: { shape: "collection" },
            }],
          },
        },
      }],
      context: {
        metadata: {
          imageStudioHandoff: {
            handoffId: "handoff:image:5.2.3",
            sourceStudioType: "data-studio",
            sourceStudioId: "studio:data",
            targetStudioType: "workflow-studio",
            targetStudioId: "studio:workflow",
            primaryAsset: { assetId: "asset:image:1", versionId: "asset:image:1:v1" },
            referencedAssets: [],
            datasetInstances: [{
              referenceId: "history-store",
              instanceId: "instance:history",
              dataset: { assetId: "asset:dataset:history", versionId: "asset:dataset:history:v1" },
              role: "history",
            }],
            workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" }, bindingId: "binding:workflow:image" },
            systemBinding: {
              system: { assetId: "system:image", versionId: "system:image:v1" },
              workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" }, bindingId: "binding:workflow:image" },
              datasets: [{
                referenceId: "history-store",
                instanceId: "instance:history",
                dataset: { assetId: "asset:dataset:history", versionId: "asset:dataset:history:v1" },
                role: "history",
              }],
            },
            runtimeInput: {
              context: {
                selectedImages: [{
                  selectionId: "sel:1",
                  imageId: "image:1",
                  assetRef: { assetId: "asset:image:source", versionId: "asset:image:source:v2" },
                }],
                parameters: {},
                datasets: [{
                  referenceId: "history-store",
                  instanceId: "instance:history",
                  datasetAssetId: "asset:dataset:history",
                  datasetVersionId: "asset:dataset:history:v1",
                  role: "history",
                }],
                runtime: {},
                extensions: {
                  datasetSampleRecords: {
                    "history-store": [
                      { recordId: "record:1", value: { assetId: "asset:image:history:1" } },
                      { recordId: "record:2", value: { assetId: "asset:image:history:2" } },
                    ],
                  },
                },
              },
              workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" }, bindingId: "binding:workflow:image" },
              systemBinding: {
                system: { assetId: "system:image", versionId: "system:image:v1" },
                workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v1" }, bindingId: "binding:workflow:image" },
                datasets: [{
                  referenceId: "history-store",
                  instanceId: "instance:history",
                  dataset: { assetId: "asset:dataset:history", versionId: "asset:dataset:history:v1" },
                  role: "history",
                }],
              },
              trace: {
                handoffId: "handoff:image:5.2.3",
                traceId: "trace:image:5.2.3",
                sourceStudioType: "data-studio",
                sourceStudioId: "studio:data",
              },
            },
            events: [],
            persistedRelationships: [],
          },
        },
      },
    });

    expect(result.context.resolvedInputValues.sourceImage).toEqual({
      assetId: "asset:image:source",
      versionId: "asset:image:source:v2",
    });
    expect(result.context.resolvedInputValues.historyCollection).toEqual([
      { assetId: "asset:image:history:1" },
      { assetId: "asset:image:history:2" },
    ]);
    expect((result.context.metadata as Record<string, unknown>).imageStudioHandoffRuntime).toEqual(expect.objectContaining({
      handoffId: "handoff:image:5.2.3",
      traceId: "trace:image:5.2.3",
    }));
  });
});
