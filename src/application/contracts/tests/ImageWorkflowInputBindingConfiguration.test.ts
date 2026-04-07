import { describe, expect, it } from "bun:test";
import { WorkflowInputBindingSourceKinds } from "@domain/workflow-studio/WorkflowInputBindingDomain";
import {
  createImageWorkflowInputBindingConfiguration,
  duplicateImageWorkflowInputBindingConfiguration,
  serializeImageWorkflowInputBindingConfiguration,
} from "../ImageWorkflowInputBindingConfiguration";

describe("ImageWorkflowInputBindingConfiguration", () => {
  it("supports save/load style serialization with stable binding descriptors", () => {
    const config = createImageWorkflowInputBindingConfiguration({
      bindings: [
        {
          bindingId: "binding.source",
          inputId: "sourceImage",
          required: true,
          sources: [
            {
              sourceId: "selected-image",
              kind: WorkflowInputBindingSourceKinds.selectedImage,
              path: "assetRef",
              priority: 1,
              required: true,
            },
          ],
        },
      ],
    });

    const serialized = serializeImageWorkflowInputBindingConfiguration(config);
    const loaded = createImageWorkflowInputBindingConfiguration(serialized as { bindings: ReadonlyArray<unknown>; contractVersion?: string });

    expect(loaded.bindings).toEqual(config.bindings);
  });

  it("supports duplication for cross-system reuse", () => {
    const config = createImageWorkflowInputBindingConfiguration({
      bindings: [
        {
          bindingId: "binding.instruction",
          inputId: "instruction",
          required: false,
          defaultValue: "",
          sources: [
            {
              sourceId: "form",
              kind: WorkflowInputBindingSourceKinds.uiFormValue,
              formKey: "instruction",
              priority: 1,
            },
          ],
        },
      ],
    });

    const duplicate = duplicateImageWorkflowInputBindingConfiguration(config);
    expect(duplicate).toEqual(config);
    expect(duplicate).not.toBe(config);
  });
});

