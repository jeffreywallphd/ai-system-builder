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
});
