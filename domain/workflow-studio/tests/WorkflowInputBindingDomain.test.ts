import { describe, expect, it } from "bun:test";
import {
  createWorkflowInputBindingDescriptor,
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
});
