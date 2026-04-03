import { describe, expect, it } from "bun:test";
import {
  createWorkflowInputBindingDescriptor,
  validateWorkflowInputBindingDefinitions,
  WorkflowInputBindingContractVersion,
  WorkflowInputBindingSourceKinds,
} from "../WorkflowInputBindingDomain";

describe("WorkflowInputBindingDomain", () => {
  it("creates a versioned binding descriptor and sorts sources by priority", () => {
    const descriptor = createWorkflowInputBindingDescriptor({
      bindingId: "binding.prompt",
      inputId: "prompt",
      required: true,
      sources: [
        {
          sourceId: "fallback",
          kind: WorkflowInputBindingSourceKinds.constantValue,
          priority: 20,
          value: "fallback",
        },
        {
          sourceId: "form",
          kind: WorkflowInputBindingSourceKinds.uiFormValue,
          formKey: "prompt",
          priority: 1,
        },
      ],
    });

    expect(descriptor.contractVersion).toBe(WorkflowInputBindingContractVersion);
    expect(descriptor.sources.map((source) => source.sourceId)).toEqual(["form", "fallback"]);
  });

  it("validates dataset binding configuration and duplicate input bindings", () => {
    const diagnostics = validateWorkflowInputBindingDefinitions({
      bindings: [
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.dataset.invalid",
          inputId: "targetDataset",
          required: true,
          sources: [{
            sourceId: "dataset",
            kind: WorkflowInputBindingSourceKinds.datasetInstanceReference,
            priority: 1,
            resolution: {
              shape: "record",
            },
          }],
        }),
        createWorkflowInputBindingDescriptor({
          bindingId: "binding.dataset.duplicate",
          inputId: "targetDataset",
          required: false,
          sources: [{
            sourceId: "constant",
            kind: WorkflowInputBindingSourceKinds.constantValue,
            value: "fallback",
            priority: 1,
          }],
        }),
      ],
    });

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "invalid-binding-configuration",
        bindingId: "binding.dataset.invalid",
      }),
      expect.objectContaining({
        code: "ambiguous-binding-configuration",
        bindingId: "binding.dataset.duplicate",
      }),
    ]));
  });
});
